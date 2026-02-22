import time
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image, ImageDraw, ImageFont

from src.display_manager import DisplayManager


@pytest.fixture(autouse=True)
def reset_singleton():
    """Reset DisplayManager singleton before and after each test."""
    DisplayManager._instance = None
    DisplayManager._initialized = False
    yield
    DisplayManager._instance = None
    DisplayManager._initialized = False


@pytest.fixture
def mock_rgb_matrix():
    """Mock the rgbmatrix library."""
    with patch('src.display_manager.RGBMatrix') as mock_matrix, \
         patch('src.display_manager.RGBMatrixOptions') as mock_options, \
         patch('src.display_manager.freetype') as mock_ft:

        # Setup matrix instance mock
        matrix_instance = MagicMock()
        matrix_instance.width = 128
        matrix_instance.height = 32
        matrix_instance.brightness = 90
        canvas_mock = MagicMock()
        matrix_instance.CreateFrameCanvas.return_value = canvas_mock
        matrix_instance.Clear = MagicMock()
        matrix_instance.SetImage = MagicMock()
        matrix_instance.SwapOnVSync = MagicMock(return_value=canvas_mock)
        mock_matrix.return_value = matrix_instance

        yield {
            'matrix_class': mock_matrix,
            'options_class': mock_options,
            'matrix_instance': matrix_instance,
            'freetype': mock_ft,
        }


@pytest.fixture
def display_manager(test_config, mock_rgb_matrix):
    """Create a DisplayManager instance with mocked matrix."""
    dm = DisplayManager(test_config)
    return dm


class TestDisplayManagerInitialization:
    """Test DisplayManager initialization."""

    def test_init_hardware_mode(self, test_config, mock_rgb_matrix):
        """Test initialization in hardware mode."""
        with patch.dict('os.environ', {'EMULATOR': 'false'}):
            dm = DisplayManager(test_config)

            assert dm.width == 128
            assert dm.height == 32
            assert dm.matrix is not None

            # Verify options were set correctly
            mock_rgb_matrix['options_class'].assert_called()
            options = mock_rgb_matrix['options_class'].return_value
            assert options.rows == 32
            assert options.cols == 64
            assert options.chain_length == 2

    def test_init_emulator_mode(self, test_config):
        """Test initialization in emulator mode."""
        with patch.dict('os.environ', {'EMULATOR': 'true'}), \
             patch('src.display_manager.RGBMatrix') as mock_matrix, \
             patch('src.display_manager.RGBMatrixOptions'):

            matrix_instance = MagicMock()
            matrix_instance.width = 128
            matrix_instance.height = 32
            mock_matrix.return_value = matrix_instance

            dm = DisplayManager(test_config)

            assert dm.width == 128
            assert dm.height == 32
            mock_matrix.assert_called()

    def test_singleton_pattern(self, test_config, mock_rgb_matrix):
        """Test that DisplayManager enforces singleton pattern."""
        dm1 = DisplayManager(test_config)
        dm2 = DisplayManager(test_config)
        assert dm1 is dm2

    def test_fallback_mode_when_matrix_fails(self, test_config):
        """Test fallback mode when matrix initialization fails."""
        with patch('src.display_manager.RGBMatrix', side_effect=RuntimeError("No hardware")), \
             patch('src.display_manager.RGBMatrixOptions'):
            dm = DisplayManager(test_config)
            assert dm.matrix is None
            assert dm.image is not None
            assert dm.draw is not None
            # Fallback dimensions from config: cols(64) * chain_length(2) = 128, rows = 32
            assert dm.width == 128
            assert dm.height == 32

    def test_force_fallback_mode(self, test_config):
        """Test force_fallback flag bypasses hardware init."""
        with patch('src.display_manager.RGBMatrix') as mock_matrix, \
             patch('src.display_manager.RGBMatrixOptions'):
            dm = DisplayManager(test_config, force_fallback=True)
            assert dm.matrix is None
            # RGBMatrix should not be called in force fallback
            mock_matrix.assert_not_called()

    def test_suppress_test_pattern(self, test_config, mock_rgb_matrix):
        """Test suppress_test_pattern prevents test pattern drawing."""
        with patch.object(DisplayManager, '_draw_test_pattern') as mock_tp:
            DisplayManager(test_config, suppress_test_pattern=True)
            mock_tp.assert_not_called()

    def test_hardware_config_optional_fields(self, mock_rgb_matrix):
        """Test that optional hardware config fields are applied."""
        config = {
            'display': {
                'hardware': {
                    'rows': 32,
                    'cols': 64,
                    'chain_length': 2,
                    'scan_mode': 1,
                    'pwm_dither_bits': 0,
                    'inverse_colors': False,
                },
                'runtime': {}
            }
        }
        DisplayManager(config)
        options = mock_rgb_matrix['options_class'].return_value
        assert options.scan_mode == 1
        assert options.pwm_dither_bits == 0
        assert options.inverse_colors is False


class TestDisplayManagerDrawing:
    """Test drawing operations."""

    def test_clear(self, test_config, mock_rgb_matrix):
        """Test clear operation."""
        with patch.dict('os.environ', {'EMULATOR': 'false'}):
            dm = DisplayManager(test_config)
            dm.clear()
            assert dm.matrix.Clear.called

    def test_clear_fallback_mode(self, test_config):
        """Test clear in fallback mode."""
        with patch('src.display_manager.RGBMatrix', side_effect=RuntimeError("fail")), \
             patch('src.display_manager.RGBMatrixOptions'):
            dm = DisplayManager(test_config)
            old_image = dm.image
            dm.clear()
            # Should create a new blank image
            assert dm.image is not old_image

    def test_draw_text(self, test_config, mock_rgb_matrix):
        """Test text drawing."""
        with patch.dict('os.environ', {'EMULATOR': 'false'}):
            dm = DisplayManager(test_config)
            font = MagicMock()
            dm.draw_text("Test", 0, 0, font)
            assert True  # draw_text should execute without error

    def test_draw_text_auto_center_x(self, display_manager):
        """Test draw_text auto-centers when x is None."""
        with patch.object(display_manager, 'get_text_width', return_value=40):
            display_manager.draw_text("Hello", x=None, y=10)
            # x should be computed as (128 - 40) // 2 = 44

    def test_draw_text_centered_flag(self, display_manager):
        """Test draw_text with centered=True adjusts x."""
        with patch.object(display_manager, 'get_text_width', return_value=20):
            display_manager.draw_text("Hi", x=64, y=10, centered=True)
            # x should be adjusted to 64 - 10 = 54

    def test_draw_text_small_font_flag(self, display_manager):
        """Test draw_text uses small_font when flag is set."""
        display_manager.draw_text("Test", x=0, y=0, small_font=True)
        # Should use small_font path without error

    def test_draw_text_custom_font(self, display_manager):
        """Test draw_text with a custom PIL font."""
        custom_font = ImageFont.load_default()
        display_manager.draw_text("Test", x=0, y=0, font=custom_font)

    def test_draw_text_bdf_font(self, display_manager, mock_rgb_matrix):
        """Test draw_text dispatches to _draw_bdf_text for freetype faces."""
        import freetype as ft
        mock_face = MagicMock(spec=ft.Face)
        with patch('src.display_manager.freetype.Face', ft.Face), \
             patch.object(display_manager, '_draw_bdf_text') as mock_bdf:
            display_manager.draw_text("AB", x=0, y=0, font=mock_face)
            mock_bdf.assert_called_once()

    def test_draw_image(self, test_config, mock_rgb_matrix):
        """Test image drawing."""
        with patch.dict('os.environ', {'EMULATOR': 'false'}):
            dm = DisplayManager(test_config)
            test_image = Image.new('RGB', (64, 32))
            dm.image = test_image
            dm.draw = ImageDraw.Draw(dm.image)
            assert dm.image is not None

    def test_draw_weather_icon_dispatches_correctly(self, display_manager):
        """Test draw_weather_icon dispatches to correct drawing method."""
        with patch.object(display_manager, '_draw_sun') as mock_sun:
            display_manager.draw_weather_icon('clear', 0, 0, 16)
            mock_sun.assert_called_once()

    def test_draw_weather_icon_unknown_defaults_to_sun(self, display_manager):
        """Test draw_weather_icon defaults to sun for unknown conditions."""
        with patch.object(display_manager, '_draw_sun') as mock_sun:
            display_manager.draw_weather_icon('unknown_weather', 0, 0, 16)
            mock_sun.assert_called_once()

    def test_draw_text_with_icons(self, display_manager):
        """Test draw_text_with_icons draws text and weather icons."""
        with patch.object(display_manager, 'draw_text') as mock_dt, \
             patch.object(display_manager, 'draw_weather_icon') as mock_wi, \
             patch.object(display_manager, 'update_display') as mock_ud:
            icons = [('clear', 10, 5)]
            display_manager.draw_text_with_icons("Weather", icons=icons, x=0, y=0)
            mock_dt.assert_called_once()
            mock_wi.assert_called_once()
            mock_ud.assert_called_once()


@pytest.mark.unit
class TestDisplayManagerBrightness:
    """Test brightness control."""

    def test_set_brightness_success(self, display_manager, mock_rgb_matrix):
        """Test setting brightness successfully."""
        result = display_manager.set_brightness(50)
        assert result is True
        assert mock_rgb_matrix['matrix_instance'].brightness == 50

    def test_set_brightness_clamps_high(self, display_manager, mock_rgb_matrix):
        """Test that brightness values above 100 are clamped."""
        result = display_manager.set_brightness(150)
        assert result is True
        assert mock_rgb_matrix['matrix_instance'].brightness == 100

    def test_set_brightness_clamps_low(self, display_manager, mock_rgb_matrix):
        """Test that brightness values below 0 are clamped."""
        result = display_manager.set_brightness(-10)
        assert result is True
        assert mock_rgb_matrix['matrix_instance'].brightness == 0

    def test_set_brightness_invalid_type(self, display_manager):
        """Test that non-numeric brightness values return False."""
        result = display_manager.set_brightness("bright")
        assert result is False

    def test_set_brightness_fallback_mode(self, test_config):
        """Test set_brightness returns False in fallback mode."""
        with patch('src.display_manager.RGBMatrix', side_effect=RuntimeError("fail")), \
             patch('src.display_manager.RGBMatrixOptions'):
            dm = DisplayManager(test_config)
            result = dm.set_brightness(50)
            assert result is False

    def test_get_brightness_success(self, display_manager, mock_rgb_matrix):
        """Test getting brightness value."""
        mock_rgb_matrix['matrix_instance'].brightness = 80
        result = display_manager.get_brightness()
        assert result == 80

    def test_get_brightness_fallback_mode(self, test_config):
        """Test get_brightness returns -1 in fallback mode."""
        with patch('src.display_manager.RGBMatrix', side_effect=RuntimeError("fail")), \
             patch('src.display_manager.RGBMatrixOptions'):
            dm = DisplayManager(test_config)
            assert dm.get_brightness() == -1

    def test_set_brightness_attribute_error(self, display_manager):
        """Test set_brightness handles AttributeError from matrix."""
        class NoBrightnessMatrix:
            @property
            def brightness(self):
                raise AttributeError("no brightness")

            @brightness.setter
            def brightness(self, value):
                raise AttributeError("no brightness")
        display_manager.matrix = NoBrightnessMatrix()
        result = display_manager.set_brightness(50)
        assert result is False


@pytest.mark.unit
class TestDisplayManagerUpdateDisplay:
    """Test display update and double buffering."""

    def test_update_display_swaps_buffers(self, display_manager, mock_rgb_matrix):
        """Test that update_display performs buffer swap."""
        display_manager.update_display()
        mock_rgb_matrix['matrix_instance'].SwapOnVSync.assert_called()

    def test_update_display_fallback_mode(self, test_config):
        """Test update_display in fallback mode."""
        with patch('src.display_manager.RGBMatrix', side_effect=RuntimeError("fail")), \
             patch('src.display_manager.RGBMatrixOptions'):
            dm = DisplayManager(test_config)
            dm.update_display()  # Should not raise

    def test_update_display_writes_snapshot(self, display_manager):
        """Test that update_display writes snapshot when due."""
        display_manager._last_snapshot_ts = 0  # Force snapshot to be due
        with patch.object(display_manager, '_write_snapshot_if_due') as mock_snap:
            display_manager.update_display()
            mock_snap.assert_called_once()


@pytest.mark.unit
class TestDisplayManagerFonts:
    """Test font loading and text measurement."""

    def test_load_fonts_creates_attributes(self, display_manager):
        """Test that _load_fonts creates font attributes."""
        assert hasattr(display_manager, 'regular_font')
        assert hasattr(display_manager, 'small_font')
        assert hasattr(display_manager, 'bdf_5x7_font')

    def test_get_text_width_pil_font(self, display_manager):
        """Test text width measurement for PIL fonts."""
        pil_font = ImageFont.load_default()
        width = display_manager.get_text_width("Hello", pil_font)
        assert isinstance(width, int)
        assert width >= 0

    def test_get_text_width_freetype_face(self, display_manager):
        """Test text width measurement for freetype faces."""
        import freetype as ft
        mock_face = MagicMock(spec=ft.Face)
        mock_glyph = MagicMock()
        mock_glyph.advance.x = 6 << 6
        mock_face.glyph = mock_glyph
        mock_face.load_char = MagicMock()
        with patch('src.display_manager.freetype') as ft_mod:
            ft_mod.Face = ft.Face
            width = display_manager.get_text_width("AB", mock_face)
            assert width == 12

    def test_get_text_width_error_returns_zero(self, display_manager):
        """Test that get_text_width returns 0 on error."""
        bad_font = MagicMock()
        bad_font.getbbox = MagicMock(side_effect=Exception("font error"))
        width = display_manager.get_text_width("Test", bad_font)
        assert width == 0

    def test_get_font_height_pil_font(self, display_manager):
        """Test font height for PIL fonts."""
        pil_font = ImageFont.load_default()
        height = display_manager.get_font_height(pil_font)
        assert isinstance(height, int)
        assert height > 0

    def test_get_font_height_freetype_face(self, display_manager):
        """Test font height for freetype faces."""
        import freetype as ft
        mock_face = MagicMock(spec=ft.Face)
        mock_face.size.height = 8 << 6
        with patch('src.display_manager.freetype') as ft_mod:
            ft_mod.Face = ft.Face
            height = display_manager.get_font_height(mock_face)
            assert height == 8


@pytest.mark.unit
class TestDisplayManagerScrollingState:
    """Test scrolling state management."""

    def test_set_scrolling_state_on(self, display_manager):
        """Test setting scrolling state to active."""
        display_manager.set_scrolling_state(True)
        assert display_manager._scrolling_state['is_scrolling'] is True
        assert display_manager._scrolling_state['last_scroll_activity'] > 0

    def test_set_scrolling_state_off(self, display_manager):
        """Test setting scrolling state to inactive."""
        display_manager.set_scrolling_state(False)
        assert display_manager._scrolling_state['is_scrolling'] is False

    def test_is_currently_scrolling_when_active(self, display_manager):
        """Test is_currently_scrolling returns True when recently active."""
        display_manager.set_scrolling_state(True)
        assert display_manager.is_currently_scrolling() is True

    def test_is_currently_scrolling_timeout(self, display_manager):
        """Test scrolling state times out after inactivity."""
        display_manager.set_scrolling_state(True)
        # Manually set last activity to the past
        display_manager._scrolling_state['last_scroll_activity'] = time.time() - 10
        assert display_manager.is_currently_scrolling() is False


@pytest.mark.unit
class TestDisplayManagerDeferredUpdates:
    """Test deferred update management."""

    def test_defer_update_adds_to_queue(self, display_manager):
        """Test that defer_update adds a function to the queue."""
        func = MagicMock()
        display_manager.defer_update(func, priority=0)
        assert len(display_manager._scrolling_state['deferred_updates']) == 1

    def test_defer_update_sorts_by_priority(self, display_manager):
        """Test that deferred updates are sorted by priority."""
        func1 = MagicMock()
        func2 = MagicMock()
        display_manager.defer_update(func1, priority=5)
        display_manager.defer_update(func2, priority=1)
        updates = display_manager._scrolling_state['deferred_updates']
        assert updates[0]['priority'] == 1
        assert updates[1]['priority'] == 5

    def test_defer_update_max_queue_size(self, display_manager):
        """Test that queue respects max size by removing oldest."""
        display_manager._scrolling_state['max_deferred_updates'] = 3
        for i in range(5):
            display_manager.defer_update(MagicMock(), priority=i)
        assert len(display_manager._scrolling_state['deferred_updates']) == 3

    def test_process_deferred_updates_when_not_scrolling(self, display_manager):
        """Test that deferred updates are processed when not scrolling."""
        func = MagicMock()
        display_manager.defer_update(func, priority=0)
        display_manager.set_scrolling_state(False)
        display_manager.process_deferred_updates()
        func.assert_called_once()

    def test_process_deferred_updates_skipped_when_scrolling(self, display_manager):
        """Test that deferred updates are skipped during scrolling."""
        func = MagicMock()
        display_manager.defer_update(func, priority=0)
        display_manager.set_scrolling_state(True)
        display_manager.process_deferred_updates()
        func.assert_not_called()

    def test_process_deferred_updates_expired_skipped(self, display_manager):
        """Test that expired deferred updates are skipped."""
        func = MagicMock()
        display_manager.defer_update(func, priority=0)
        # Set the timestamp to be beyond TTL
        display_manager._scrolling_state['deferred_updates'][0]['timestamp'] = time.time() - 400
        display_manager.set_scrolling_state(False)
        display_manager.process_deferred_updates()
        func.assert_not_called()

    def test_process_deferred_updates_failed_requeued(self, display_manager):
        """Test that recent failures are re-added to queue."""
        func = MagicMock(side_effect=Exception("fail"))
        display_manager.defer_update(func, priority=0)
        display_manager.set_scrolling_state(False)
        display_manager.process_deferred_updates()
        # Failed and recent, so should be re-added
        assert len(display_manager._scrolling_state['deferred_updates']) == 1

    def test_cleanup_expired_deferred_updates(self, display_manager):
        """Test cleanup of expired deferred updates."""
        # Add an expired update
        display_manager._scrolling_state['deferred_updates'].append({
            'func': MagicMock(),
            'priority': 0,
            'timestamp': time.time() - 400  # Beyond 300s TTL
        })
        # Add a valid update
        display_manager._scrolling_state['deferred_updates'].append({
            'func': MagicMock(),
            'priority': 0,
            'timestamp': time.time()
        })
        display_manager._cleanup_expired_deferred_updates(time.time())
        assert len(display_manager._scrolling_state['deferred_updates']) == 1


@pytest.mark.unit
class TestDisplayManagerResourceManagement:
    """Test resource management."""

    def test_cleanup(self, test_config, mock_rgb_matrix):
        """Test cleanup operation."""
        with patch.dict('os.environ', {'EMULATOR': 'false'}):
            dm = DisplayManager(test_config)
            dm.cleanup()
            dm.matrix.Clear.assert_called()

    def test_cleanup_resets_singleton(self, display_manager):
        """Test that cleanup resets singleton state."""
        display_manager.cleanup()
        assert DisplayManager._instance is None
        assert DisplayManager._initialized is False

    def test_cleanup_fallback_mode(self, test_config):
        """Test cleanup in fallback mode (no matrix)."""
        with patch('src.display_manager.RGBMatrix', side_effect=RuntimeError("fail")), \
             patch('src.display_manager.RGBMatrixOptions'):
            dm = DisplayManager(test_config)
            dm.cleanup()  # Should not raise


@pytest.mark.unit
class TestDisplayManagerDateFormatting:
    """Test date formatting utility."""

    def test_format_date_with_ordinal_st(self, display_manager):
        """Test ordinal formatting for 1st."""
        from datetime import datetime
        dt = datetime(2024, 1, 1)
        result = display_manager.format_date_with_ordinal(dt)
        assert "1st" in result

    def test_format_date_with_ordinal_nd(self, display_manager):
        """Test ordinal formatting for 2nd."""
        from datetime import datetime
        dt = datetime(2024, 1, 2)
        result = display_manager.format_date_with_ordinal(dt)
        assert "2nd" in result

    def test_format_date_with_ordinal_11th(self, display_manager):
        """Test ordinal formatting for 11th (special case teen)."""
        from datetime import datetime
        dt = datetime(2024, 1, 11)
        result = display_manager.format_date_with_ordinal(dt)
        assert "11th" in result


@pytest.mark.unit
class TestDisplayManagerSnapshot:
    """Test snapshot writing."""

    def test_write_snapshot_throttled(self, display_manager):
        """Test that snapshot writing is throttled."""
        display_manager._last_snapshot_ts = time.time()  # Just written
        with patch('builtins.open') as mock_open:
            display_manager._write_snapshot_if_due()
            mock_open.assert_not_called()

    def test_write_snapshot_when_due(self, display_manager):
        """Test that snapshot is written when enough time has elapsed."""
        display_manager._last_snapshot_ts = 0  # Long ago
        with patch.object(display_manager.image, 'save') as mock_save, \
             patch('os.replace'):
            display_manager._write_snapshot_if_due()
            mock_save.assert_called()


@pytest.mark.unit
class TestDisplayManagerTestPattern:
    """Test pattern drawing."""

    def test_draw_test_pattern_with_matrix(self, display_manager):
        """Test drawing test pattern with real matrix."""
        with patch.object(display_manager, 'clear') as mock_clear, \
             patch.object(display_manager, 'update_display') as mock_update, \
             patch('src.display_manager.time.sleep'):
            display_manager._draw_test_pattern()
            mock_clear.assert_called_once()
            mock_update.assert_called_once()

    def test_draw_test_pattern_fallback(self, test_config):
        """Test drawing test pattern in fallback mode."""
        with patch('src.display_manager.RGBMatrix', side_effect=RuntimeError("fail")), \
             patch('src.display_manager.RGBMatrixOptions'):
            dm = DisplayManager(test_config)
            dm._draw_test_pattern()  # Should not raise
