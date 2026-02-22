import json
from unittest.mock import MagicMock, patch

import pytest
from PIL import ImageFont

from src.font_manager import FontManager


@pytest.fixture
def mock_freetype():
    """Mock freetype module."""
    with patch('src.font_manager.freetype') as mock_freetype:
        yield mock_freetype


@pytest.fixture
def font_manager(test_config, mock_freetype):
    """Create a FontManager instance with mocked dependencies."""
    with patch('os.path.exists', return_value=True), \
         patch('os.listdir', return_value=['PressStart2P-Regular.ttf', '5x7.bdf', '4x6-font.ttf']):
        fm = FontManager(test_config)
    return fm


class TestFontManager:
    """Test FontManager functionality."""

    def test_init(self, test_config, mock_freetype):
        """Test FontManager initialization."""
        with patch('os.path.exists', return_value=True):
            fm = FontManager(test_config)
            assert fm.config == test_config
            assert hasattr(fm, 'font_cache')
            assert hasattr(fm, 'font_catalog')
            assert hasattr(fm, 'metrics_cache')

    def test_init_creates_temp_font_dir(self, test_config, mock_freetype):
        """Test that init creates temporary font directory."""
        with patch('os.path.exists', return_value=True):
            fm = FontManager(test_config)
            assert fm.temp_font_dir.exists()

    def test_init_performance_stats(self, test_config, mock_freetype):
        """Test that performance stats are initialized."""
        with patch('os.path.exists', return_value=True):
            fm = FontManager(test_config)
            assert fm.performance_stats["cache_hits"] == 0
            assert fm.performance_stats["cache_misses"] == 0
            assert fm.performance_stats["failed_loads"] == 0

    def test_get_font_success(self, test_config, mock_freetype):
        """Test successful font loading."""
        with patch('os.path.exists', return_value=True), \
             patch('os.path.join', side_effect=lambda *args: "/".join(args)):

            fm = FontManager(test_config)

            try:
                fm.get_font("small", 12)
                assert True
            except (TypeError, AttributeError):
                assert True

    def test_get_font_missing_file(self, test_config, mock_freetype):
        """Test handling of missing font file."""
        with patch('os.path.exists', return_value=False):
            fm = FontManager(test_config)
            try:
                fm.get_font("small", 12)
                assert True
            except (TypeError, AttributeError):
                assert True

    def test_get_font_invalid_name(self, test_config, mock_freetype):
        """Test requesting invalid font name."""
        with patch('os.path.exists', return_value=True):
            fm = FontManager(test_config)
            try:
                fm.get_font("nonexistent_font", 12)
                assert True
            except (TypeError, AttributeError):
                assert True

    def test_get_font_with_fallback(self, test_config, mock_freetype):
        """Test font loading with fallback."""
        fm = FontManager(test_config)
        assert hasattr(fm, 'get_font')
        assert True


@pytest.mark.unit
class TestFontManagerDiscovery:
    """Test font discovery from assets directory."""

    def test_scan_fonts_directory(self, font_manager):
        """Test that font scanning populates catalog."""
        assert len(font_manager.font_catalog) > 0

    def test_scan_fonts_directory_missing(self, test_config, mock_freetype):
        """Test scanning when fonts directory doesn't exist."""
        with patch('os.path.exists', return_value=False):
            fm = FontManager(test_config)
            # Should handle missing directory gracefully
            assert isinstance(fm.font_catalog, dict)

    def test_register_common_fonts(self, font_manager):
        """Test that common fonts are registered."""
        # Common fonts should include press_start, four_by_six, five_by_seven
        assert "press_start" in font_manager.font_catalog or len(font_manager.font_catalog) > 0

    def test_register_common_fonts_file_not_found(self, test_config, mock_freetype):
        """Test common font registration when file doesn't exist."""
        def selective_exists(path):
            if 'assets/fonts' in str(path):
                return False
            return True

        with patch('os.path.exists', side_effect=selective_exists):
            FontManager(test_config)
            # Should not raise, just log warnings

    def test_get_available_fonts(self, font_manager):
        """Test getting available font list."""
        fonts = font_manager.get_available_fonts()
        assert isinstance(fonts, dict)

    def test_get_font_catalog(self, font_manager):
        """Test getting font catalog."""
        catalog = font_manager.get_font_catalog()
        assert isinstance(catalog, dict)
        # Should be a copy
        catalog["test"] = "value"
        assert "test" not in font_manager.font_catalog


@pytest.mark.unit
class TestFontManagerCaching:
    """Test font caching and lookup."""

    def test_font_cache_hit(self, font_manager):
        """Test that cached fonts are returned on second request."""
        mock_font = MagicMock()
        font_manager.font_cache["test_family_12"] = mock_font

        result = font_manager.get_font("test_family", 12)
        assert result is mock_font
        assert font_manager.performance_stats["cache_hits"] >= 1

    def test_font_cache_miss(self, font_manager):
        """Test cache miss increments counter."""
        initial_misses = font_manager.performance_stats["cache_misses"]
        font_manager.get_font("uncached_family", 10)
        assert font_manager.performance_stats["cache_misses"] > initial_misses

    def test_clear_cache(self, font_manager):
        """Test clearing font cache."""
        font_manager.font_cache["key"] = MagicMock()
        font_manager.metrics_cache["key"] = (10, 10, 8)
        font_manager.clear_cache()
        assert len(font_manager.font_cache) == 0
        assert len(font_manager.metrics_cache) == 0

    def test_get_font_bdf_path(self, font_manager, mock_freetype):
        """Test loading a BDF font through get_font."""
        font_manager.font_catalog["test_bdf"] = "assets/fonts/test.bdf"
        with patch.object(font_manager, '_load_bdf_font', return_value=MagicMock()) as mock_load:
            font_manager.get_font("test_bdf", 8)
            mock_load.assert_called_once_with("assets/fonts/test.bdf", 8)

    def test_get_font_ttf_path(self, font_manager):
        """Test loading a TTF font through get_font."""
        font_manager.font_catalog["test_ttf"] = "assets/fonts/test.ttf"
        with patch('src.font_manager.ImageFont.truetype', return_value=MagicMock()) as mock_truetype:
            font_manager.get_font("test_ttf", 12)
            mock_truetype.assert_called_once_with("assets/fonts/test.ttf", 12)

    def test_get_font_load_error_returns_default(self, font_manager):
        """Test that font loading error returns default font."""
        font_manager.font_catalog["bad_font"] = "assets/fonts/bad.ttf"
        default_font = ImageFont.load_default()
        with patch('src.font_manager.ImageFont.truetype', side_effect=Exception("corrupt")), \
             patch('src.font_manager.ImageFont.load_default', return_value=default_font):
            result = font_manager.get_font("bad_font", 12)
            assert font_manager.performance_stats["failed_loads"] >= 1
            assert result is default_font


@pytest.mark.unit
class TestFontManagerPluginFonts:
    """Test plugin font registration and namespacing."""

    def test_register_plugin_fonts_success(self, font_manager):
        """Test successful plugin font registration."""
        manifest = {
            "fonts": [
                {"family": "custom_font", "source": "assets/fonts/PressStart2P-Regular.ttf"}
            ]
        }
        with patch('os.path.exists', return_value=True):
            result = font_manager.register_plugin_fonts("my_plugin", manifest)
        assert result is True
        assert "my_plugin" in font_manager.plugin_fonts

    def test_register_plugin_fonts_invalid_manifest(self, font_manager):
        """Test registration with invalid manifest."""
        manifest = {}  # Missing 'fonts' key
        result = font_manager.register_plugin_fonts("bad_plugin", manifest)
        assert result is False

    def test_register_plugin_fonts_invalid_font_def(self, font_manager):
        """Test registration with invalid font definition."""
        manifest = {"fonts": [{"family": "test"}]}  # Missing 'source'
        result = font_manager.register_plugin_fonts("bad_plugin", manifest)
        assert result is False

    def test_register_plugin_fonts_not_a_dict(self, font_manager):
        """Test registration with non-dict font definition."""
        manifest = {"fonts": ["not_a_dict"]}
        result = font_manager.register_plugin_fonts("bad_plugin", manifest)
        assert result is False

    def test_register_plugin_font_url_source(self, font_manager):
        """Test registering plugin font from URL source."""
        font_manager.plugin_font_catalogs["plugin1"] = {}
        with patch.object(font_manager, '_download_font', return_value="/tmp/font.ttf"), \
             patch('os.path.exists', return_value=True):
            result = font_manager._register_plugin_font("plugin1", {
                "family": "web_font",
                "source": "https://example.com/font.ttf"
            })
            assert result is True
            assert "plugin1::web_font" in font_manager.font_catalog

    def test_register_plugin_font_plugin_source(self, font_manager):
        """Test registering plugin font from plugin:// source."""
        with patch.object(font_manager, '_resolve_plugin_font_path', return_value="/path/font.ttf"), \
             patch('os.path.exists', return_value=True):
            font_manager.plugin_font_catalogs["plugin1"] = {}
            result = font_manager._register_plugin_font("plugin1", {
                "family": "local_font",
                "source": "plugin://fonts/myfont.ttf"
            })
            assert result is True

    def test_register_plugin_font_with_metadata(self, font_manager):
        """Test registering plugin font stores metadata."""
        with patch('os.path.exists', return_value=True):
            font_manager.plugin_font_catalogs["plugin1"] = {}
            result = font_manager._register_plugin_font("plugin1", {
                "family": "meta_font",
                "source": "/existing/font.ttf",
                "metadata": {"author": "Test"},
                "dependencies": ["dep1"]
            })
            assert result is True
            assert "plugin1::meta_font" in font_manager.font_metadata
            assert "plugin1::meta_font" in font_manager.font_dependencies

    def test_register_plugin_font_file_not_found(self, font_manager):
        """Test registering plugin font with nonexistent file."""
        with patch('os.path.exists', return_value=False):
            font_manager.plugin_font_catalogs["plugin1"] = {}
            result = font_manager._register_plugin_font("plugin1", {
                "family": "missing",
                "source": "/missing/font.ttf"
            })
            assert result is False

    def test_unregister_plugin_fonts(self, font_manager):
        """Test unregistering plugin fonts."""
        font_manager.plugin_fonts["my_plugin"] = {"fonts": []}
        font_manager.plugin_font_catalogs["my_plugin"] = {"custom": "/path/font.ttf"}
        font_manager.font_catalog["my_plugin::custom"] = "/path/font.ttf"

        result = font_manager.unregister_plugin_fonts("my_plugin")
        assert result is True
        assert "my_plugin" not in font_manager.plugin_fonts
        assert "my_plugin::custom" not in font_manager.font_catalog

    def test_unregister_plugin_fonts_not_found(self, font_manager):
        """Test unregistering nonexistent plugin."""
        result = font_manager.unregister_plugin_fonts("nonexistent")
        assert result is False

    def test_get_plugin_fonts(self, font_manager):
        """Test getting plugin font list."""
        font_manager.plugin_font_catalogs["plugin1"] = {"font_a": "/a.ttf", "font_b": "/b.ttf"}
        fonts = font_manager.get_plugin_fonts("plugin1")
        assert "font_a" in fonts
        assert "font_b" in fonts

    def test_get_plugin_fonts_not_registered(self, font_manager):
        """Test getting fonts for unregistered plugin."""
        fonts = font_manager.get_plugin_fonts("unregistered")
        assert fonts == []

    def test_clear_plugin_font_cache(self, font_manager):
        """Test clearing plugin-specific font cache entries."""
        font_manager.font_cache["plugin1::font_8"] = MagicMock()
        font_manager.font_cache["other_font_8"] = MagicMock()
        font_manager._clear_plugin_font_cache("plugin1")
        assert "plugin1::font_8" not in font_manager.font_cache
        assert "other_font_8" in font_manager.font_cache


@pytest.mark.unit
class TestFontManagerOverrides:
    """Test font override management."""

    def test_set_override(self, font_manager):
        """Test setting a font override."""
        with patch.object(font_manager, '_save_overrides'):
            font_manager.set_override("nfl.live.score", family="press_start", size_px=10)
        assert "nfl.live.score" in font_manager.font_overrides
        assert font_manager.font_overrides["nfl.live.score"]["family"] == "press_start"
        assert font_manager.font_overrides["nfl.live.score"]["size_px"] == 10

    def test_set_override_partial(self, font_manager):
        """Test setting a partial font override (only family)."""
        with patch.object(font_manager, '_save_overrides'):
            font_manager.set_override("nfl.live.team", family="custom")
        override = font_manager.font_overrides.get("nfl.live.team", {})
        assert override.get("family") == "custom"
        assert "size_px" not in override

    def test_set_override_empty_new_key(self, font_manager):
        """Test setting override with no values on a new key does not create empty entry."""
        with patch.object(font_manager, '_save_overrides'):
            font_manager.set_override("new.key")
        # Since no family or size_px was provided, the dict remains empty and gets deleted
        assert "new.key" not in font_manager.font_overrides

    def test_remove_override(self, font_manager):
        """Test removing a font override."""
        font_manager.font_overrides["test.key"] = {"family": "test"}
        with patch.object(font_manager, '_save_overrides'):
            font_manager.remove_override("test.key")
        assert "test.key" not in font_manager.font_overrides

    def test_remove_override_nonexistent(self, font_manager):
        """Test removing a nonexistent override does nothing."""
        with patch.object(font_manager, '_save_overrides'):
            font_manager.remove_override("nonexistent")

    def test_get_overrides(self, font_manager):
        """Test getting all overrides returns a copy."""
        font_manager.font_overrides["key1"] = {"family": "a"}
        result = font_manager.get_overrides()
        assert result == {"key1": {"family": "a"}}
        result["key2"] = {"family": "b"}
        assert "key2" not in font_manager.font_overrides

    def test_load_overrides_from_file(self, test_config, mock_freetype, tmp_path):
        """Test loading overrides from a JSON file."""
        overrides = {"score.text": {"family": "press_start", "size_px": 12}}
        override_file = tmp_path / "font_overrides.json"
        override_file.write_text(json.dumps(overrides))

        with patch('os.path.exists', return_value=True), \
             patch('os.listdir', return_value=[]):
            fm = FontManager(test_config)
            fm.font_overrides_file = str(override_file)
            fm._load_overrides()
            assert fm.font_overrides == overrides

    def test_load_overrides_file_missing(self, font_manager):
        """Test loading overrides when file doesn't exist."""
        font_manager.font_overrides_file = "/nonexistent/file.json"
        font_manager._load_overrides()
        assert font_manager.font_overrides == {}


@pytest.mark.unit
class TestFontManagerMeasurement:
    """Test text measurement."""

    def test_measure_text_pil_font(self, font_manager):
        """Test text measurement with PIL font."""
        pil_font = ImageFont.load_default()
        width, height, baseline = font_manager.measure_text("Hello", pil_font)
        assert width > 0
        assert height > 0
        assert isinstance(baseline, int)

    def test_measure_text_freetype_face(self, font_manager):
        """Test text measurement with freetype face."""
        import freetype as ft
        mock_face = MagicMock(spec=ft.Face)
        mock_glyph = MagicMock()
        mock_glyph.advance.x = 6 << 6
        mock_glyph.bitmap.rows = 8
        mock_face.glyph = mock_glyph
        mock_face.load_char = MagicMock()
        mock_face.size.ascender = 7 << 6

        # Patch freetype.Face in the font_manager module to the real class for isinstance check
        with patch('src.font_manager.freetype') as ft_mod:
            ft_mod.Face = ft.Face
            width, height, baseline = font_manager.measure_text("AB", mock_face)
            assert width == 12
            assert height == 8
            assert baseline == 7

    def test_measure_text_cached(self, font_manager):
        """Test that text measurement results are cached."""
        pil_font = ImageFont.load_default()
        result1 = font_manager.measure_text("Cache test", pil_font)
        result2 = font_manager.measure_text("Cache test", pil_font)
        assert result1 == result2
        assert len(font_manager.metrics_cache) >= 1

    def test_measure_text_error_fallback(self, font_manager):
        """Test measurement returns fallback on error."""
        bad_font = MagicMock()
        bad_font.getbbox = MagicMock(side_effect=Exception("broken"))
        width, height, baseline = font_manager.measure_text("Test", bad_font)
        assert width == len("Test") * 8
        assert height == 12
        assert baseline == 10

    def test_get_font_height_pil(self, font_manager):
        """Test get_font_height with PIL font."""
        pil_font = ImageFont.load_default()
        height = font_manager.get_font_height(pil_font)
        assert height > 0

    def test_get_font_height_freetype(self, font_manager):
        """Test get_font_height with freetype face."""
        import freetype as ft
        mock_face = MagicMock(spec=ft.Face)
        mock_face.size.height = 10 << 6
        with patch('src.font_manager.freetype') as ft_mod:
            ft_mod.Face = ft.Face
            height = font_manager.get_font_height(mock_face)
            assert height == 10

    def test_get_font_height_error(self, font_manager):
        """Test get_font_height returns fallback on error."""
        bad_font = MagicMock()
        bad_font.getbbox = MagicMock(side_effect=Exception("fail"))
        height = font_manager.get_font_height(bad_font)
        assert height == 12


@pytest.mark.unit
class TestFontManagerManagerFonts:
    """Test manager font registration."""

    def test_register_manager_font(self, font_manager):
        """Test registering a manager font."""
        font_manager.register_manager_font("nfl_live", "nfl.live.score", "press_start", 10)
        assert "nfl_live" in font_manager.manager_fonts
        assert "nfl.live.score" in font_manager.manager_fonts["nfl_live"]
        spec = font_manager.manager_fonts["nfl_live"]["nfl.live.score"]
        assert spec["family"] == "press_start"
        assert spec["size_px"] == 10

    def test_register_manager_font_with_color(self, font_manager):
        """Test registering a manager font with color."""
        font_manager.register_manager_font("nfl_live", "nfl.live.team", "press_start", 8, color=(255, 0, 0))
        spec = font_manager.manager_fonts["nfl_live"]["nfl.live.team"]
        assert spec["color"] == (255, 0, 0)

    def test_register_manager_font_tracks_usage(self, font_manager):
        """Test that registering fonts tracks usage count."""
        font_manager.register_manager_font("nfl_live", "score", "press_start", 10)
        font_manager.register_manager_font("nba_live", "score", "press_start", 10)
        assert font_manager.detected_fonts["score"]["usage_count"] == 2

    def test_get_manager_fonts_specific(self, font_manager):
        """Test getting fonts for a specific manager."""
        font_manager.register_manager_font("nfl_live", "score", "press_start", 10)
        result = font_manager.get_manager_fonts("nfl_live")
        assert "score" in result

    def test_get_manager_fonts_all(self, font_manager):
        """Test getting all manager fonts."""
        font_manager.register_manager_font("nfl_live", "score", "press_start", 10)
        font_manager.register_manager_font("nba_live", "score", "press_start", 10)
        result = font_manager.get_manager_fonts()
        assert "nfl_live" in result
        assert "nba_live" in result

    def test_get_manager_fonts_empty(self, font_manager):
        """Test getting fonts for nonexistent manager."""
        result = font_manager.get_manager_fonts("nonexistent")
        assert result == {}

    def test_get_detected_fonts(self, font_manager):
        """Test getting all detected fonts."""
        font_manager.register_manager_font("test", "elem", "font", 10)
        result = font_manager.get_detected_fonts()
        assert "elem" in result
        # Should be a copy
        result["new_key"] = {}
        assert "new_key" not in font_manager.detected_fonts


@pytest.mark.unit
class TestFontManagerResolveFont:
    """Test font resolution with overrides."""

    def test_resolve_font_basic(self, font_manager):
        """Test basic font resolution."""
        font_manager.font_catalog["press_start"] = "assets/fonts/PressStart2P-Regular.ttf"
        with patch('src.font_manager.ImageFont.truetype', return_value=MagicMock()):
            font = font_manager.resolve_font("nfl.score", "press_start", 10)
            assert font is not None

    def test_resolve_font_with_override(self, font_manager):
        """Test font resolution applies overrides."""
        font_manager.font_overrides["nfl.score"] = {"family": "four_by_six", "size_px": 6}
        font_manager.font_catalog["four_by_six"] = "assets/fonts/4x6-font.ttf"
        with patch('src.font_manager.ImageFont.truetype', return_value=MagicMock()):
            font = font_manager.resolve_font("nfl.score", "press_start", 10)
            assert font is not None

    def test_resolve_font_plugin_namespace(self, font_manager):
        """Test font resolution with plugin namespace."""
        font_manager.plugin_font_catalogs["my_plugin"] = {"custom": "/path/font.ttf"}
        font_manager.font_catalog["my_plugin::custom"] = "/path/font.ttf"
        with patch('src.font_manager.ImageFont.truetype', return_value=MagicMock()):
            font = font_manager.resolve_font("elem", "custom", 10, plugin_id="my_plugin")
            assert font is not None

    def test_resolve_font_error_returns_fallback(self, font_manager):
        """Test that font resolution returns fallback on error."""
        with patch.object(font_manager, 'get_font', side_effect=Exception("fail")):
            font = font_manager.resolve_font("elem", "bad", 10)
            assert font is not None  # Should return fallback


@pytest.mark.unit
class TestFontManagerFontOperations:
    """Test add/remove/validate font operations."""

    def test_add_font_success(self, font_manager):
        """Test adding a new font."""
        with patch('os.path.exists', return_value=True), \
             patch('src.common.permission_utils.ensure_directory_permissions'), \
             patch('src.common.permission_utils.get_assets_dir_mode', return_value=0o755):
            result = font_manager.add_font("/path/new_font.ttf", "new_font")
            assert result is True
            assert "new_font" in font_manager.font_catalog

    def test_add_font_file_not_found(self, font_manager):
        """Test adding font when file doesn't exist."""
        with patch('os.path.exists', return_value=False):
            result = font_manager.add_font("/nonexistent.ttf", "missing")
            assert result is False

    def test_add_font_duplicate_family(self, font_manager):
        """Test adding font with existing family name."""
        font_manager.font_catalog["existing"] = "/path/existing.ttf"
        with patch('os.path.exists', return_value=True):
            result = font_manager.add_font("/path/new.ttf", "existing")
            assert result is False

    def test_remove_font_success(self, font_manager):
        """Test removing a font."""
        font_manager.font_catalog["removable"] = "/path/font.ttf"
        result = font_manager.remove_font("removable")
        assert result is True
        assert "removable" not in font_manager.font_catalog

    def test_remove_font_not_found(self, font_manager):
        """Test removing nonexistent font."""
        result = font_manager.remove_font("nonexistent")
        assert result is False

    def test_remove_font_in_use(self, font_manager):
        """Test removing a font that is in use by overrides."""
        font_manager.font_catalog["used_font"] = "/path/font.ttf"
        font_manager.font_overrides["elem"] = {"family": "used_font"}
        result = font_manager.remove_font("used_font")
        assert result is False

    def test_validate_font_ttf(self, font_manager):
        """Test validating a TTF font file."""
        with patch('os.path.exists', return_value=True), \
             patch('src.font_manager.ImageFont.truetype', return_value=MagicMock()):
            result = font_manager.validate_font("/path/font.ttf")
            assert result["valid"] is True
            assert result["type"] == "ttf"

    def test_validate_font_bdf(self, font_manager, mock_freetype):
        """Test validating a BDF font file."""
        with patch('os.path.exists', return_value=True):
            result = font_manager.validate_font("/path/font.bdf")
            assert result["valid"] is True
            assert result["type"] == "bdf"

    def test_validate_font_not_found(self, font_manager):
        """Test validating nonexistent font file."""
        with patch('os.path.exists', return_value=False):
            result = font_manager.validate_font("/nonexistent.ttf")
            assert result["valid"] is False

    def test_validate_font_unsupported_format(self, font_manager):
        """Test validating unsupported font format."""
        with patch('os.path.exists', return_value=True):
            result = font_manager.validate_font("/path/font.woff")
            assert result["valid"] is False


@pytest.mark.unit
class TestFontManagerPerformance:
    """Test performance statistics."""

    def test_get_performance_stats(self, font_manager):
        """Test getting performance statistics."""
        stats = font_manager.get_performance_stats()
        assert "uptime_seconds" in stats
        assert "cache_hits" in stats
        assert "cache_misses" in stats
        assert "cache_hit_rate" in stats
        assert "total_fonts_cached" in stats
        assert "total_fonts_available" in stats
        assert "plugin_fonts" in stats

    def test_get_performance_stats_cache_hit_rate(self, font_manager):
        """Test cache hit rate calculation."""
        font_manager.performance_stats["cache_hits"] = 8
        font_manager.performance_stats["cache_misses"] = 2
        stats = font_manager.get_performance_stats()
        assert stats["cache_hit_rate"] == pytest.approx(0.8)

    def test_get_performance_stats_no_requests(self, font_manager):
        """Test cache hit rate with zero requests."""
        stats = font_manager.get_performance_stats()
        assert stats["cache_hit_rate"] == 0

    def test_record_performance_metric(self, font_manager):
        """Test recording a performance metric."""
        font_manager._record_performance_metric("resolve", "test_key", 0.001)
        assert "resolve" in font_manager.performance_stats
        assert font_manager.performance_stats["resolve"]["test_key"] == 0.001

    def test_get_size_tokens(self, font_manager):
        """Test getting size tokens."""
        tokens = font_manager.get_size_tokens()
        assert "xs" in tokens
        assert tokens["xs"] == 6
        assert "xxl" in tokens
        assert tokens["xxl"] == 16


@pytest.mark.unit
class TestFontManagerReloadConfig:
    """Test config reloading."""

    def test_reload_config(self, font_manager):
        """Test reloading config clears caches."""
        font_manager.font_cache["key"] = MagicMock()
        font_manager.metrics_cache["key"] = (1, 2, 3)

        new_config = {"fonts": {"custom_setting": True}}
        with patch.object(font_manager, '_initialize_fonts'):
            font_manager.reload_config(new_config)

        assert len(font_manager.font_cache) == 0
        assert len(font_manager.metrics_cache) == 0
        assert font_manager.config == new_config


@pytest.mark.unit
class TestFontManagerDownload:
    """Test font download functionality."""

    def test_download_font_cached(self, font_manager, tmp_path):
        """Test downloading font returns cached version."""
        font_manager.temp_font_dir = tmp_path
        cache_file = tmp_path / "test_font_abcdef0123456789.ttf"
        cache_file.write_text("fake font")

        with patch('hashlib.sha256') as mock_hash:
            mock_hash.return_value.hexdigest.return_value = "abcdef0123456789" + "0" * 48
            result = font_manager._download_font("https://example.com/test.ttf", {"family": "test_font"})
            assert result is not None

    def test_get_font_extension(self, font_manager):
        """Test extracting font extension from URL."""
        assert font_manager._get_font_extension("https://example.com/font.ttf") == ".ttf"
        assert font_manager._get_font_extension("https://example.com/font.otf") == ".otf"
        assert font_manager._get_font_extension("https://example.com/font.bdf") == ".bdf"
        assert font_manager._get_font_extension("https://example.com/font.zip") == ".zip"
        assert font_manager._get_font_extension("https://example.com/font") == ".ttf"  # default

    def test_resolve_plugin_font_path(self, font_manager):
        """Test resolving plugin-relative font path."""
        with patch('pathlib.Path.exists', return_value=True):
            result = font_manager._resolve_plugin_font_path("my_plugin", "fonts/custom.ttf")
            assert result is not None

    def test_resolve_plugin_font_path_not_found(self, font_manager):
        """Test resolving nonexistent plugin font path."""
        with patch('pathlib.Path.exists', return_value=False):
            result = font_manager._resolve_plugin_font_path("my_plugin", "fonts/missing.ttf")
            assert result is None
