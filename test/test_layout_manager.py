"""
Tests for LayoutManager.

Tests layout creation, management, rendering, and element positioning.
"""

import json
from unittest.mock import MagicMock

import pytest

from src.layout_manager import LayoutManager


class TestLayoutManager:
    """Test LayoutManager functionality."""

    @pytest.fixture
    def tmp_layout_file(self, tmp_path):
        """Create a temporary layout file."""
        layout_file = tmp_path / "custom_layouts.json"
        return str(layout_file)

    @pytest.fixture
    def mock_display_manager(self):
        """Create a mock display manager."""
        dm = MagicMock()
        dm.clear = MagicMock()
        dm.update_display = MagicMock()
        dm.draw_text = MagicMock()
        dm.draw_weather_icon = MagicMock()
        dm.small_font = MagicMock()
        dm.regular_font = MagicMock()
        dm.get_font_height = MagicMock(return_value=8)
        return dm

    @pytest.fixture
    def layout_manager(self, tmp_layout_file, mock_display_manager):
        """Create a LayoutManager instance."""
        return LayoutManager(
            display_manager=mock_display_manager,
            config_path=tmp_layout_file
        )

    def test_init(self, tmp_layout_file, mock_display_manager):
        """Test LayoutManager initialization."""
        lm = LayoutManager(
            display_manager=mock_display_manager,
            config_path=tmp_layout_file
        )

        assert lm.display_manager == mock_display_manager
        assert lm.config_path == tmp_layout_file
        assert lm.layouts == {}
        assert lm.current_layout is None

    def test_load_layouts_file_exists(self, tmp_path, mock_display_manager):
        """Test loading layouts from existing file."""
        layout_file = tmp_path / "custom_layouts.json"
        layout_data = {
            "test_layout": {
                "elements": [{"type": "text", "x": 0, "y": 0}],
                "description": "Test layout"
            }
        }
        with open(layout_file, 'w') as f:
            json.dump(layout_data, f)

        lm = LayoutManager(
            display_manager=mock_display_manager,
            config_path=str(layout_file)
        )

        assert "test_layout" in lm.layouts
        assert lm.layouts["test_layout"]["description"] == "Test layout"

    def test_load_layouts_file_not_exists(self, tmp_layout_file, mock_display_manager):
        """Test loading layouts when file doesn't exist."""
        lm = LayoutManager(
            display_manager=mock_display_manager,
            config_path=tmp_layout_file
        )

        assert lm.layouts == {}

    def test_load_layouts_corrupted_file(self, tmp_path, mock_display_manager):
        """Test loading layouts from corrupted JSON file."""
        layout_file = tmp_path / "custom_layouts.json"
        layout_file.write_text("{invalid json")

        lm = LayoutManager(
            display_manager=mock_display_manager,
            config_path=str(layout_file)
        )
        assert lm.layouts == {}

    def test_create_layout(self, layout_manager):
        """Test creating a new layout."""
        elements = [{"type": "text", "x": 10, "y": 20, "properties": {"text": "Hello"}}]

        result = layout_manager.create_layout("test_layout", elements, "Test description")

        assert result is True
        assert "test_layout" in layout_manager.layouts
        assert layout_manager.layouts["test_layout"]["elements"] == elements
        assert layout_manager.layouts["test_layout"]["description"] == "Test description"
        assert "created" in layout_manager.layouts["test_layout"]
        assert "modified" in layout_manager.layouts["test_layout"]

    def test_update_layout(self, layout_manager):
        """Test updating an existing layout."""
        elements1 = [{"type": "text", "x": 0, "y": 0}]
        layout_manager.create_layout("test_layout", elements1, "Original")

        elements2 = [{"type": "text", "x": 10, "y": 20}]
        result = layout_manager.update_layout("test_layout", elements2, "Updated")

        assert result is True
        assert layout_manager.layouts["test_layout"]["elements"] == elements2
        assert layout_manager.layouts["test_layout"]["description"] == "Updated"
        assert "modified" in layout_manager.layouts["test_layout"]

    def test_update_layout_without_description(self, layout_manager):
        """Test updating layout without changing description."""
        elements1 = [{"type": "text", "x": 0, "y": 0}]
        layout_manager.create_layout("test_layout", elements1, "Original desc")

        elements2 = [{"type": "text", "x": 10, "y": 20}]
        result = layout_manager.update_layout("test_layout", elements2)

        assert result is True
        assert layout_manager.layouts["test_layout"]["description"] == "Original desc"

    def test_update_layout_not_exists(self, layout_manager):
        """Test updating a non-existent layout."""
        elements = [{"type": "text", "x": 0, "y": 0}]
        result = layout_manager.update_layout("nonexistent", elements)

        assert result is False

    def test_delete_layout(self, layout_manager):
        """Test deleting a layout."""
        elements = [{"type": "text", "x": 0, "y": 0}]
        layout_manager.create_layout("test_layout", elements)

        result = layout_manager.delete_layout("test_layout")

        assert result is True
        assert "test_layout" not in layout_manager.layouts

    def test_delete_layout_not_exists(self, layout_manager):
        """Test deleting a non-existent layout."""
        result = layout_manager.delete_layout("nonexistent")

        assert result is False

    def test_get_layout(self, layout_manager):
        """Test getting a specific layout."""
        elements = [{"type": "text", "x": 0, "y": 0}]
        layout_manager.create_layout("test_layout", elements)

        layout = layout_manager.get_layout("test_layout")

        assert layout is not None
        assert layout["elements"] == elements

    def test_get_layout_not_exists(self, layout_manager):
        """Test getting a non-existent layout."""
        layout = layout_manager.get_layout("nonexistent")

        assert layout == {}

    def test_list_layouts(self, layout_manager):
        """Test listing all layouts."""
        layout_manager.create_layout("layout1", [])
        layout_manager.create_layout("layout2", [])
        layout_manager.create_layout("layout3", [])

        layouts = layout_manager.list_layouts()

        assert len(layouts) == 3
        assert "layout1" in layouts
        assert "layout2" in layouts
        assert "layout3" in layouts

    def test_set_current_layout(self, layout_manager):
        """Test setting the current layout."""
        layout_manager.create_layout("test_layout", [])

        result = layout_manager.set_current_layout("test_layout")

        assert result is True
        assert layout_manager.current_layout == "test_layout"

    def test_set_current_layout_not_exists(self, layout_manager):
        """Test setting a non-existent layout as current."""
        result = layout_manager.set_current_layout("nonexistent")

        assert result is False
        assert layout_manager.current_layout is None

    def test_render_layout(self, layout_manager, mock_display_manager):
        """Test rendering a layout."""
        elements = [
            {"type": "text", "x": 0, "y": 0, "properties": {"text": "Hello"}},
            {"type": "text", "x": 10, "y": 10, "properties": {"text": "World"}}
        ]
        layout_manager.create_layout("test_layout", elements)

        result = layout_manager.render_layout("test_layout")

        assert result is True
        mock_display_manager.clear.assert_called_once()
        mock_display_manager.update_display.assert_called_once()
        assert mock_display_manager.draw_text.call_count == 2

    def test_render_layout_no_display_manager(self, tmp_layout_file):
        """Test rendering without display manager."""
        lm = LayoutManager(display_manager=None, config_path=tmp_layout_file)
        lm.create_layout("test_layout", [])

        result = lm.render_layout("test_layout")

        assert result is False

    def test_render_layout_not_exists(self, layout_manager):
        """Test rendering a non-existent layout."""
        result = layout_manager.render_layout("nonexistent")

        assert result is False

    def test_render_layout_uses_current(self, layout_manager, mock_display_manager):
        """Test rendering uses current_layout when no name given."""
        elements = [{"type": "text", "x": 0, "y": 0, "properties": {"text": "Auto"}}]
        layout_manager.create_layout("auto_layout", elements)
        layout_manager.set_current_layout("auto_layout")

        result = layout_manager.render_layout()

        assert result is True
        mock_display_manager.draw_text.assert_called_once()

    def test_render_layout_no_current_no_name(self, layout_manager):
        """Test rendering with no name and no current layout set."""
        result = layout_manager.render_layout()
        assert result is False

    def test_render_element_text(self, layout_manager, mock_display_manager):
        """Test rendering a text element."""
        element = {
            "type": "text",
            "x": 10,
            "y": 20,
            "properties": {
                "text": "Hello",
                "color": [255, 0, 0],
                "font_size": "small"
            }
        }

        layout_manager.render_element(element, {})

        mock_display_manager.draw_text.assert_called_once()
        call_args = mock_display_manager.draw_text.call_args
        assert call_args[0][0] == "Hello"
        assert call_args[0][1] == 10
        assert call_args[0][2] == 20

    def test_render_element_text_large_font(self, layout_manager, mock_display_manager):
        """Test rendering text with large font size."""
        element = {
            "type": "text",
            "x": 5,
            "y": 5,
            "properties": {
                "text": "Big",
                "font_size": "large"
            }
        }
        layout_manager.render_element(element, {})
        call_args = mock_display_manager.draw_text.call_args
        assert call_args[1]['font'] == mock_display_manager.regular_font

    def test_render_element_text_normal_font(self, layout_manager, mock_display_manager):
        """Test rendering text with normal (default) font size."""
        element = {
            "type": "text",
            "x": 5,
            "y": 5,
            "properties": {
                "text": "Normal",
                "font_size": "normal"
            }
        }
        layout_manager.render_element(element, {})
        call_args = mock_display_manager.draw_text.call_args
        assert call_args[1]['font'] == mock_display_manager.regular_font

    def test_render_element_weather_icon(self, layout_manager, mock_display_manager):
        """Test rendering a weather icon element."""
        element = {
            "type": "weather_icon",
            "x": 10,
            "y": 20,
            "properties": {
                "condition": "sunny",
                "size": 16
            }
        }

        layout_manager.render_element(element, {})

        mock_display_manager.draw_weather_icon.assert_called_once_with("sunny", 10, 20, 16)

    def test_render_element_weather_icon_from_context(self, layout_manager, mock_display_manager):
        """Test rendering weather icon with data from context."""
        element = {
            "type": "weather_icon",
            "x": 10,
            "y": 20,
            "properties": {"size": 16}
        }
        data_context = {
            "weather": {
                "condition": "cloudy"
            }
        }

        layout_manager.render_element(element, data_context)

        mock_display_manager.draw_weather_icon.assert_called_once_with("cloudy", 10, 20, 16)

    def test_render_element_rectangle(self, layout_manager, mock_display_manager):
        """Test rendering a rectangle element."""
        element = {
            "type": "rectangle",
            "x": 10,
            "y": 20,
            "properties": {
                "width": 50,
                "height": 30,
                "color": [255, 0, 0],
                "filled": True
            }
        }

        mock_draw = MagicMock()
        mock_display_manager.draw = mock_draw

        layout_manager.render_element(element, {})

        mock_draw.rectangle.assert_called_once()

    def test_render_element_rectangle_outline(self, layout_manager, mock_display_manager):
        """Test rendering an outline rectangle."""
        element = {
            "type": "rectangle",
            "x": 0,
            "y": 0,
            "properties": {
                "width": 20,
                "height": 10,
                "color": [0, 255, 0],
                "filled": False
            }
        }

        mock_draw = MagicMock()
        mock_display_manager.draw = mock_draw

        layout_manager.render_element(element, {})

        mock_draw.rectangle.assert_called_once_with(
            [0, 0, 20, 10],
            outline=(0, 255, 0)
        )

    def test_render_element_unknown_type(self, layout_manager):
        """Test rendering an unknown element type."""
        element = {
            "type": "unknown_type",
            "x": 0,
            "y": 0,
            "properties": {}
        }

        layout_manager.render_element(element, {})

    def test_process_template_text(self, layout_manager):
        """Test template text processing."""
        text = "Hello {name}, temperature is {temp}°F"
        data_context = {
            "name": "World",
            "temp": 72
        }

        result = layout_manager._process_template_text(text, data_context)

        assert result == "Hello World, temperature is 72°F"

    def test_process_template_text_no_context(self, layout_manager):
        """Test template text with missing context."""
        text = "Hello {name}"
        data_context = {}

        result = layout_manager._process_template_text(text, data_context)

        assert "{name}" in result or result == "Hello "

    def test_save_layouts_error_handling(self, layout_manager):
        """Test error handling when saving layouts."""
        layout_manager.create_layout("test", [])

        layout_manager.config_path = "/nonexistent/directory/layouts.json"

        result = layout_manager.save_layouts()

        assert result is False

    def test_render_element_line(self, layout_manager, mock_display_manager):
        """Test rendering a line element."""
        element = {
            "type": "line",
            "x": 10,
            "y": 20,
            "properties": {
                "x2": 50,
                "y2": 30,
                "color": [255, 0, 0],
                "width": 2
            }
        }

        mock_draw = MagicMock()
        mock_display_manager.draw = mock_draw

        layout_manager.render_element(element, {})

        mock_draw.line.assert_called_once()

    def test_render_element_clock(self, layout_manager, mock_display_manager):
        """Test rendering a clock element."""
        element = {
            "type": "clock",
            "x": 10,
            "y": 20,
            "properties": {
                "format": "%H:%M",
                "color": [255, 255, 255]
            }
        }

        layout_manager.render_element(element, {})

        mock_display_manager.draw_text.assert_called_once()

    def test_render_element_data_text(self, layout_manager, mock_display_manager):
        """Test rendering a data text element."""
        element = {
            "type": "data_text",
            "x": 10,
            "y": 20,
            "properties": {
                "data_key": "weather.temperature",
                "format": "Temp: {value}°F",
                "color": [255, 255, 255],
                "default": "N/A"
            }
        }
        data_context = {
            "weather": {
                "temperature": 72
            }
        }

        layout_manager.render_element(element, data_context)

        mock_display_manager.draw_text.assert_called_once()
        call_args = mock_display_manager.draw_text.call_args
        assert "72" in call_args[0][0]

    def test_render_element_data_text_missing_key(self, layout_manager, mock_display_manager):
        """Test rendering data text with missing data key."""
        element = {
            "type": "data_text",
            "x": 10,
            "y": 20,
            "properties": {
                "data_key": "missing.key",
                "format": "{value}",
                "color": [255, 255, 255],
                "default": "N/A"
            }
        }

        layout_manager.render_element(element, {})

        mock_display_manager.draw_text.assert_called_once()
        call_args = mock_display_manager.draw_text.call_args
        assert "N/A" in call_args[0][0]

    def test_get_nested_value(self, layout_manager):
        """Test getting nested value from dictionary."""
        data = {"a": {"b": {"c": 42}}}
        assert layout_manager._get_nested_value(data, "a.b.c") == 42

    def test_get_nested_value_missing(self, layout_manager):
        """Test getting nested value with missing key."""
        data = {"a": {"b": 1}}
        assert layout_manager._get_nested_value(data, "a.c", default="fallback") == "fallback"

    def test_get_nested_value_single_key(self, layout_manager):
        """Test getting value with single key (no dots)."""
        data = {"key": "value"}
        assert layout_manager._get_nested_value(data, "key") == "value"

    def test_get_nested_value_empty_key(self, layout_manager):
        """Test getting value with empty string key."""
        data = {"": "empty_key_value"}
        assert layout_manager._get_nested_value(data, "") == "empty_key_value"


@pytest.mark.unit
class TestLayoutManagerMultiElement:
    """Test multi-element rendering scenarios."""

    @pytest.fixture
    def mock_display_manager(self):
        """Create a mock display manager for multi-element tests."""
        dm = MagicMock()
        dm.clear = MagicMock()
        dm.update_display = MagicMock()
        dm.draw_text = MagicMock()
        dm.draw_weather_icon = MagicMock()
        dm.small_font = MagicMock()
        dm.regular_font = MagicMock()
        dm.get_font_height = MagicMock(return_value=8)
        return dm

    @pytest.fixture
    def layout_manager(self, tmp_path, mock_display_manager):
        """Create a layout manager for multi-element tests."""
        layout_file = tmp_path / "layouts.json"
        return LayoutManager(
            display_manager=mock_display_manager,
            config_path=str(layout_file)
        )

    def test_render_dashboard_layout(self, layout_manager, mock_display_manager):
        """Test rendering a complex dashboard with multiple element types."""
        elements = [
            {"type": "clock", "x": 2, "y": 2, "properties": {"format": "%H:%M", "color": [255, 255, 255]}},
            {"type": "weather_icon", "x": 50, "y": 2, "properties": {"size": 16}},
            {"type": "data_text", "x": 70, "y": 5, "properties": {
                "data_key": "weather.temperature",
                "format": "{value}°",
                "color": [255, 200, 0],
                "default": "--°"
            }},
            {"type": "line", "x": 0, "y": 15, "properties": {"x2": 128, "y2": 15, "color": [100, 100, 100]}},
            {"type": "text", "x": 2, "y": 18, "properties": {"text": "Status: OK", "color": [0, 255, 0]}},
        ]
        layout_manager.create_layout("dashboard", elements, "Dashboard")

        data_context = {"weather": {"temperature": 72, "condition": "sunny"}}
        result = layout_manager.render_layout("dashboard", data_context)

        assert result is True
        mock_display_manager.clear.assert_called_once()
        mock_display_manager.update_display.assert_called_once()
        # clock + data_text + text = 3 draw_text calls
        assert mock_display_manager.draw_text.call_count == 3
        mock_display_manager.draw_weather_icon.assert_called_once()

    def test_render_multiple_rectangles(self, layout_manager, mock_display_manager):
        """Test rendering multiple rectangles."""
        mock_draw = MagicMock()
        mock_display_manager.draw = mock_draw

        elements = [
            {"type": "rectangle", "x": 0, "y": 0, "properties": {"width": 10, "height": 10, "filled": True, "color": [255, 0, 0]}},
            {"type": "rectangle", "x": 20, "y": 0, "properties": {"width": 10, "height": 10, "filled": False, "color": [0, 255, 0]}},
            {"type": "rectangle", "x": 40, "y": 0, "properties": {"width": 10, "height": 10, "filled": True, "color": [0, 0, 255]}},
        ]
        layout_manager.create_layout("rects", elements)
        result = layout_manager.render_layout("rects")

        assert result is True
        assert mock_draw.rectangle.call_count == 3

    def test_render_empty_layout(self, layout_manager, mock_display_manager):
        """Test rendering a layout with no elements."""
        layout_manager.create_layout("empty", [])

        result = layout_manager.render_layout("empty")

        assert result is True
        mock_display_manager.clear.assert_called_once()
        mock_display_manager.update_display.assert_called_once()
        mock_display_manager.draw_text.assert_not_called()

    def test_render_layout_with_template_data(self, layout_manager, mock_display_manager):
        """Test rendering layout with template variable substitution."""
        elements = [
            {"type": "text", "x": 0, "y": 0, "properties": {"text": "Hello {user}!", "color": [255, 255, 255]}}
        ]
        layout_manager.create_layout("template", elements)

        result = layout_manager.render_layout("template", {"user": "Alice"})
        assert result is True
        call_args = mock_display_manager.draw_text.call_args
        assert "Alice" in call_args[0][0]

    def test_render_element_with_defaults(self, layout_manager, mock_display_manager):
        """Test rendering elements with default property values."""
        # Element with minimal properties (should use defaults)
        element = {"type": "text", "x": 0, "y": 0, "properties": {}}
        layout_manager.render_element(element, {})
        call_args = mock_display_manager.draw_text.call_args
        assert call_args[0][0] == "Sample Text"  # Default text

    def test_render_line_with_defaults(self, layout_manager, mock_display_manager):
        """Test rendering a line with default end coordinates."""
        mock_draw = MagicMock()
        mock_display_manager.draw = mock_draw

        element = {"type": "line", "x": 5, "y": 10, "properties": {}}
        layout_manager.render_element(element, {})
        mock_draw.line.assert_called_once_with([5, 10, 15, 10], fill=(255, 255, 255), width=1)


@pytest.mark.unit
class TestLayoutManagerPresets:
    """Test preset layout functionality."""

    @pytest.fixture
    def mock_display_manager(self):
        dm = MagicMock()
        dm.clear = MagicMock()
        dm.update_display = MagicMock()
        dm.draw_text = MagicMock()
        dm.draw_weather_icon = MagicMock()
        dm.small_font = MagicMock()
        dm.regular_font = MagicMock()
        return dm

    @pytest.fixture
    def layout_manager(self, tmp_path, mock_display_manager):
        layout_file = tmp_path / "layouts.json"
        return LayoutManager(
            display_manager=mock_display_manager,
            config_path=str(layout_file)
        )

    def test_create_preset_layouts(self, layout_manager):
        """Test creating preset layouts."""
        layout_manager.create_preset_layouts()

        layouts = layout_manager.list_layouts()
        assert "basic_clock" in layouts
        assert "weather_display" in layouts
        assert "dashboard" in layouts

    def test_preset_basic_clock_has_elements(self, layout_manager):
        """Test that basic_clock preset has expected elements."""
        layout_manager.create_preset_layouts()
        layout = layout_manager.get_layout("basic_clock")
        assert len(layout["elements"]) == 2
        assert layout["elements"][0]["type"] == "clock"

    def test_preset_weather_has_icon(self, layout_manager):
        """Test that weather preset has weather_icon element."""
        layout_manager.create_preset_layouts()
        layout = layout_manager.get_layout("weather_display")
        types = [e["type"] for e in layout["elements"]]
        assert "weather_icon" in types

    def test_get_layout_preview(self, layout_manager):
        """Test getting layout preview."""
        elements = [
            {"type": "text", "x": 0, "y": 0, "properties": {"text": "Hi"}},
            {"type": "clock", "x": 50, "y": 0, "properties": {"format": "%H:%M"}}
        ]
        layout_manager.create_layout("preview_test", elements, "Preview test")

        preview = layout_manager.get_layout_preview("preview_test")

        assert preview["name"] == "preview_test"
        assert preview["element_count"] == 2
        assert len(preview["elements"]) == 2
        assert preview["elements"][0]["type"] == "text"
        assert preview["elements"][1]["type"] == "clock"

    def test_get_layout_preview_not_exists(self, layout_manager):
        """Test getting preview for nonexistent layout."""
        preview = layout_manager.get_layout_preview("nonexistent")
        assert preview == {}

    def test_get_layout_preview_positions(self, layout_manager):
        """Test that preview includes element positions."""
        elements = [{"type": "text", "x": 10, "y": 20, "properties": {}}]
        layout_manager.create_layout("pos_test", elements)

        preview = layout_manager.get_layout_preview("pos_test")
        assert preview["elements"][0]["position"] == "(10, 20)"

    def test_get_layout_preview_property_keys(self, layout_manager):
        """Test that preview lists property keys."""
        elements = [{"type": "text", "x": 0, "y": 0, "properties": {"text": "Hi", "color": [255, 0, 0]}}]
        layout_manager.create_layout("props_test", elements)

        preview = layout_manager.get_layout_preview("props_test")
        assert "text" in preview["elements"][0]["properties"]
        assert "color" in preview["elements"][0]["properties"]
