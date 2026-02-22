import json
import time
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


class TestDisplayControllerInitialization:
    """Test DisplayController initialization and setup."""

    def test_init_success(self, test_display_controller):
        """Test successful initialization."""
        assert test_display_controller.config_service is not None
        assert test_display_controller.display_manager is not None
        assert test_display_controller.cache_manager is not None
        assert test_display_controller.font_manager is not None
        assert test_display_controller.plugin_manager is not None
        assert test_display_controller.available_modes == []

    def test_plugin_discovery_and_loading(self, test_display_controller):
        """Test plugin discovery and loading during initialization."""
        pm = test_display_controller.plugin_manager
        pm.discover_plugins.return_value = ["plugin1", "plugin2"]
        pm.get_plugin.return_value = MagicMock()

    def test_init_sets_default_state(self, test_display_controller):
        """Test that initialization sets default state values."""
        ctrl = test_display_controller
        assert ctrl.current_mode_index == 0
        assert ctrl.mode_duration == 30
        assert ctrl.is_display_active is True
        assert ctrl.on_demand_active is False
        assert ctrl.on_demand_mode is None
        assert ctrl.on_demand_pinned is False
        assert ctrl.on_demand_status == 'idle'
        assert ctrl.vegas_coordinator is None


@pytest.mark.unit
class TestDisplayControllerModeRotation:
    """Test display mode rotation logic."""

    def test_basic_rotation(self, test_display_controller):
        """Test basic mode rotation."""
        controller = test_display_controller
        controller.available_modes = ["mode1", "mode2", "mode3"]
        controller.current_mode_index = 0
        controller.current_display_mode = "mode1"

        controller.current_mode_index = (controller.current_mode_index + 1) % len(controller.available_modes)
        controller.current_display_mode = controller.available_modes[controller.current_mode_index]
        assert controller.current_display_mode == "mode2"
        assert controller.current_mode_index == 1

        controller.current_mode_index = (controller.current_mode_index + 1) % len(controller.available_modes)
        controller.current_display_mode = controller.available_modes[controller.current_mode_index]
        assert controller.current_display_mode == "mode3"

        controller.current_mode_index = (controller.current_mode_index + 1) % len(controller.available_modes)
        controller.current_display_mode = controller.available_modes[controller.current_mode_index]
        assert controller.current_display_mode == "mode1"

    def test_rotation_with_single_mode(self, test_display_controller):
        """Test rotation with only one mode."""
        controller = test_display_controller
        controller.available_modes = ["mode1"]
        controller.current_mode_index = 0

        controller.current_mode_index = (controller.current_mode_index + 1) % len(controller.available_modes)
        assert controller.current_mode_index == 0

    def test_get_display_duration_from_plugin(self, test_display_controller):
        """Test getting display duration from plugin method."""
        ctrl = test_display_controller
        mock_plugin = MagicMock()
        mock_plugin.get_display_duration.return_value = 45
        ctrl.plugin_modes = {"my_mode": mock_plugin}
        assert ctrl._get_display_duration("my_mode") == 45

    def test_get_display_duration_from_config(self, test_display_controller):
        """Test getting display duration from config fallback."""
        ctrl = test_display_controller
        ctrl.config = {'display': {'display_durations': {'fallback_mode': 60}}}
        assert ctrl._get_display_duration("fallback_mode") == 60

    def test_get_display_duration_default(self, test_display_controller):
        """Test default display duration when not configured."""
        ctrl = test_display_controller
        ctrl.config = {'display': {'display_durations': {}}}
        assert ctrl._get_display_duration("unknown_mode") == 30


@pytest.mark.unit
class TestDisplayControllerOnDemand:
    """Test on-demand request handling."""

    def test_activate_on_demand(self, test_display_controller):
        """Test activating on-demand mode."""
        controller = test_display_controller
        controller.available_modes = ["mode1", "mode2"]
        controller.plugin_modes = {"mode1": MagicMock(), "mode2": MagicMock(), "od_mode": MagicMock()}
        controller.mode_to_plugin_id = {"od_mode": "od_plugin"}
        controller.plugin_display_modes = {"od_plugin": ["od_mode"]}

        request = {
            "action": "start",
            "plugin_id": "od_plugin",
            "mode": "od_mode",
            "duration": 60
        }

        controller._activate_on_demand(request)

        assert controller.on_demand_active is True
        assert controller.on_demand_mode == "od_mode"
        assert controller.on_demand_duration == 60.0
        assert controller.on_demand_schedule_override is True
        assert controller.force_change is True

    def test_activate_on_demand_invalid_mode(self, test_display_controller):
        """Test activating on-demand with invalid mode."""
        controller = test_display_controller
        controller.plugin_modes = {}

        request = {
            "action": "start",
            "plugin_id": "bad_plugin",
            "mode": "nonexistent_mode",
        }
        controller._activate_on_demand(request)
        assert controller.on_demand_active is False
        assert controller.on_demand_status == 'error'
        assert controller.on_demand_last_error == 'invalid-mode'

    def test_activate_on_demand_missing_mode_and_plugin(self, test_display_controller):
        """Test activating on-demand with no mode or plugin."""
        controller = test_display_controller
        request = {"action": "start"}
        controller._activate_on_demand(request)
        assert controller.on_demand_status == 'error'
        assert controller.on_demand_last_error == 'missing-mode'

    def test_activate_on_demand_no_plugin_for_mode(self, test_display_controller):
        """Test activating on-demand when mode has no associated plugin."""
        controller = test_display_controller
        controller.plugin_modes = {"orphan_mode": MagicMock()}
        controller.mode_to_plugin_id = {}
        request = {"action": "start", "mode": "orphan_mode"}
        controller._activate_on_demand(request)
        assert controller.on_demand_status == 'error'
        assert controller.on_demand_last_error == 'unknown-plugin'

    def test_activate_on_demand_invalid_duration(self, test_display_controller):
        """Test on-demand with invalid duration value."""
        controller = test_display_controller
        mock_plugin = MagicMock()
        controller.plugin_modes = {"test_mode": mock_plugin}
        controller.mode_to_plugin_id = {"test_mode": "test_plugin"}
        controller.plugin_display_modes = {"test_plugin": ["test_mode"]}

        request = {"action": "start", "mode": "test_mode", "duration": "not_a_number"}
        controller._activate_on_demand(request)
        assert controller.on_demand_duration is None  # Invalid gets set to None

    def test_activate_on_demand_pinned(self, test_display_controller):
        """Test activating on-demand with pinned flag."""
        controller = test_display_controller
        mock_plugin = MagicMock()
        controller.plugin_modes = {"test_mode": mock_plugin}
        controller.mode_to_plugin_id = {"test_mode": "test_plugin"}
        controller.plugin_display_modes = {"test_plugin": ["test_mode"]}

        request = {"action": "start", "mode": "test_mode", "pinned": True}
        controller._activate_on_demand(request)
        assert controller.on_demand_pinned is True

    def test_on_demand_expiration(self, test_display_controller):
        """Test on-demand mode expiration."""
        controller = test_display_controller
        controller.on_demand_active = True
        controller.on_demand_mode = "od_mode"
        controller.on_demand_expires_at = time.time() - 10

        controller._check_on_demand_expiration()

        assert controller.on_demand_active is False
        assert controller.on_demand_mode is None
        assert controller.on_demand_last_event == "expired"

    def test_on_demand_expiration_not_expired(self, test_display_controller):
        """Test on-demand mode not yet expired."""
        controller = test_display_controller
        controller.on_demand_active = True
        controller.on_demand_mode = "od_mode"
        controller.on_demand_expires_at = time.time() + 1000

        controller._check_on_demand_expiration()
        assert controller.on_demand_active is True

    def test_on_demand_expiration_no_expiry(self, test_display_controller):
        """Test on-demand mode with no expiration (pinned)."""
        controller = test_display_controller
        controller.on_demand_active = True
        controller.on_demand_expires_at = None

        controller._check_on_demand_expiration()
        assert controller.on_demand_active is True

    def test_on_demand_schedule_override(self, test_display_controller):
        """Test that on-demand overrides schedule."""
        controller = test_display_controller
        controller.is_display_active = False
        controller.on_demand_active = True

        if controller.on_demand_active and not controller.is_display_active:
            controller.on_demand_schedule_override = True
            controller.is_display_active = True

        assert controller.is_display_active is True
        assert controller.on_demand_schedule_override is True

    def test_clear_on_demand(self, test_display_controller):
        """Test clearing on-demand mode."""
        controller = test_display_controller
        controller.on_demand_active = True
        controller.on_demand_mode = "test_mode"
        controller.on_demand_plugin_id = "test_plugin"
        controller.on_demand_modes = ["test_mode"]
        controller.available_modes = ["mode1", "mode2"]
        controller.current_mode_index = 0
        controller.rotation_resume_index = 1

        controller._clear_on_demand(reason='test-clear')

        assert controller.on_demand_active is False
        assert controller.on_demand_mode is None
        assert controller.on_demand_plugin_id is None
        assert controller.on_demand_last_event == 'test-clear'
        assert controller.force_change is True

    def test_clear_on_demand_resumes_rotation(self, test_display_controller):
        """Test that clearing on-demand resumes rotation at saved index."""
        controller = test_display_controller
        controller.on_demand_active = True
        controller.on_demand_status = 'active'
        controller.available_modes = ["m1", "m2", "m3"]
        controller.rotation_resume_index = 2

        controller._clear_on_demand(reason='expired')
        assert controller.current_mode_index == 2
        assert controller.current_display_mode == "m3"

    def test_get_on_demand_remaining(self, test_display_controller):
        """Test calculating remaining on-demand time."""
        controller = test_display_controller
        controller.on_demand_active = True
        controller.on_demand_expires_at = time.time() + 30

        remaining = controller._get_on_demand_remaining()
        assert remaining is not None
        assert 29 <= remaining <= 31

    def test_set_on_demand_error(self, test_display_controller):
        """Test setting on-demand error state."""
        controller = test_display_controller
        controller._set_on_demand_error("test-error")
        assert controller.on_demand_status == 'error'
        assert controller.on_demand_last_error == "test-error"
        assert controller.on_demand_active is False

    def test_poll_on_demand_requests_start(self, test_display_controller):
        """Test polling for on-demand start request."""
        controller = test_display_controller
        mock_plugin = MagicMock()
        controller.plugin_modes = {"test_mode": mock_plugin}
        controller.mode_to_plugin_id = {"test_mode": "test_plugin"}
        controller.plugin_display_modes = {"test_plugin": ["test_mode"]}

        request = {
            'request_id': 'req-123',
            'action': 'start',
            'plugin_id': 'test_plugin',
            'mode': 'test_mode',
            'duration': 60,
        }
        controller.cache_manager._memory_cache['display_on_demand_request'] = request

        controller._poll_on_demand_requests()
        assert controller.on_demand_active is True
        assert controller.on_demand_request_id == 'req-123'

    def test_poll_on_demand_requests_stop(self, test_display_controller):
        """Test polling for on-demand stop request."""
        controller = test_display_controller
        controller.on_demand_active = True
        controller.on_demand_mode = "test_mode"
        controller.on_demand_modes = ["test_mode"]
        controller.on_demand_status = 'active'
        controller.available_modes = ["mode1"]
        controller.current_mode_index = 0

        request = {
            'request_id': 'stop-123',
            'action': 'stop',
        }
        controller.cache_manager._memory_cache['display_on_demand_request'] = request

        controller._poll_on_demand_requests()
        assert controller.on_demand_active is False

    def test_poll_on_demand_requests_duplicate(self, test_display_controller):
        """Test that duplicate request IDs are ignored."""
        controller = test_display_controller
        controller.on_demand_request_id = 'req-dup'

        request = {
            'request_id': 'req-dup',
            'action': 'start',
            'mode': 'test_mode',
        }
        controller.cache_manager._memory_cache['display_on_demand_request'] = request

        controller._poll_on_demand_requests()
        # Should not activate since it's a duplicate
        assert controller.on_demand_active is False

    def test_resolve_mode_for_plugin_direct_mode(self, test_display_controller):
        """Test resolving a valid direct mode."""
        controller = test_display_controller
        controller.plugin_modes = {"hockey_live": MagicMock()}
        result = controller._resolve_mode_for_plugin("hockey", "hockey_live")
        assert result == "hockey_live"

    def test_resolve_mode_for_plugin_from_plugin_id(self, test_display_controller):
        """Test resolving mode when only plugin_id is provided."""
        controller = test_display_controller
        controller.plugin_display_modes = {"hockey": ["hockey_live", "hockey_recent"]}
        result = controller._resolve_mode_for_plugin("hockey", None)
        assert result == "hockey_live"


@pytest.mark.unit
class TestDisplayControllerLivePriority:
    """Test live priority content switching."""

    def test_live_priority_detection(self, test_display_controller, mock_plugin_with_live):
        """Test detection of live priority content."""
        controller = test_display_controller
        normal_plugin = MagicMock()
        normal_plugin.has_live_priority = MagicMock(return_value=False)
        normal_plugin.has_live_content = MagicMock(return_value=False)

        controller.plugin_modes = {
            "test_plugin_live": mock_plugin_with_live,
            "normal_mode": normal_plugin
        }
        controller.mode_to_plugin_id = {"test_plugin_live": "test_plugin", "normal_mode": "normal_plugin"}

        live_mode = controller._check_live_priority()
        assert live_mode == "test_plugin_live"

    def test_live_priority_switch(self, test_display_controller, mock_plugin_with_live):
        """Test switching to live priority mode."""
        controller = test_display_controller
        controller.available_modes = ["normal_mode", "test_plugin_live"]
        controller.current_display_mode = "normal_mode"

        normal_plugin = MagicMock()
        normal_plugin.has_live_priority = MagicMock(return_value=False)
        normal_plugin.has_live_content = MagicMock(return_value=False)

        controller.plugin_modes = {
            "test_plugin_live": mock_plugin_with_live,
            "normal_mode": normal_plugin
        }
        controller.mode_to_plugin_id = {"test_plugin_live": "test_plugin", "normal_mode": "normal_plugin"}

        live_priority_mode = controller._check_live_priority()
        if live_priority_mode and controller.current_display_mode != live_priority_mode:
            controller.current_display_mode = live_priority_mode
            controller.force_change = True

        assert controller.current_display_mode == "test_plugin_live"
        assert controller.force_change is True

    def test_no_live_priority(self, test_display_controller):
        """Test when no live priority content exists."""
        controller = test_display_controller
        normal_plugin = MagicMock()
        normal_plugin.has_live_priority = MagicMock(return_value=False)
        normal_plugin.has_live_content = MagicMock(return_value=False)
        controller.plugin_modes = {"normal_mode": normal_plugin}

        live_mode = controller._check_live_priority()
        assert live_mode is None


@pytest.mark.unit
class TestDisplayControllerDynamicDuration:
    """Test dynamic duration handling."""

    def test_plugin_supports_dynamic(self, test_display_controller, mock_plugin_with_dynamic):
        """Test checking if plugin supports dynamic duration."""
        controller = test_display_controller
        assert controller._plugin_supports_dynamic(mock_plugin_with_dynamic) is True

        mock_normal = MagicMock()
        mock_normal.supports_dynamic_duration.side_effect = AttributeError
        assert controller._plugin_supports_dynamic(mock_normal) is False

    def test_get_dynamic_cap(self, test_display_controller, mock_plugin_with_dynamic):
        """Test retrieving dynamic duration cap."""
        controller = test_display_controller
        cap = controller._plugin_dynamic_cap(mock_plugin_with_dynamic)
        assert cap == 180.0

    def test_global_cap_fallback(self, test_display_controller):
        """Test global dynamic duration cap."""
        controller = test_display_controller
        controller.global_dynamic_config = {"max_duration_seconds": 120}
        assert controller._get_global_dynamic_cap() == 120.0

        controller.global_dynamic_config = {}
        assert controller._get_global_dynamic_cap() == 180.0

    def test_global_cap_invalid_value(self, test_display_controller):
        """Test global cap with invalid string value."""
        controller = test_display_controller
        controller.global_dynamic_config = {"max_duration_seconds": "bad"}
        assert controller._get_global_dynamic_cap() is None

    def test_plugin_cycle_duration(self, test_display_controller):
        """Test getting plugin cycle duration."""
        mock_plugin = MagicMock()
        mock_plugin.get_cycle_duration.return_value = 90.0
        result = test_display_controller._plugin_cycle_duration(mock_plugin, "mode_a")
        assert result == 90.0

    def test_plugin_reset_cycle(self, test_display_controller):
        """Test resetting plugin cycle state."""
        mock_plugin = MagicMock()
        test_display_controller._plugin_reset_cycle(mock_plugin)
        mock_plugin.reset_cycle_state.assert_called_once()

    def test_plugin_cycle_complete(self, test_display_controller):
        """Test checking if plugin cycle is complete."""
        mock_plugin = MagicMock()
        mock_plugin.is_cycle_complete.return_value = True
        assert test_display_controller._plugin_cycle_complete(mock_plugin) is True


@pytest.mark.unit
class TestDisplayControllerSchedule:
    """Test schedule management."""

    def test_schedule_disabled(self, test_display_controller):
        """Test when schedule is disabled."""
        controller = test_display_controller
        controller.config = {"schedule": {"enabled": False}}

        controller._check_schedule()
        assert controller.is_display_active is True

    def test_schedule_missing(self, test_display_controller):
        """Test when schedule config is missing entirely."""
        controller = test_display_controller
        controller.config = {}
        controller._check_schedule()
        assert controller.is_display_active is True

    def test_active_hours(self, test_display_controller):
        """Test active hours check."""
        controller = test_display_controller
        with patch('src.display_controller.datetime') as mock_datetime:
            mock_datetime.now.return_value.strftime.return_value.lower.return_value = "monday"
            mock_datetime.now.return_value.time.return_value = datetime.strptime("12:00", "%H:%M").time()
            mock_datetime.strptime = datetime.strptime

            controller.config = {
                "schedule": {
                    "enabled": True,
                    "start_time": "09:00",
                    "end_time": "17:00"
                }
            }

            controller._check_schedule()
            assert controller.is_display_active is True

    def test_inactive_hours(self, test_display_controller):
        """Test inactive hours check."""
        controller = test_display_controller
        with patch('src.display_controller.datetime') as mock_datetime:
            mock_datetime.now.return_value.strftime.return_value.lower.return_value = "monday"
            mock_datetime.now.return_value.time.return_value = datetime.strptime("20:00", "%H:%M").time()
            mock_datetime.strptime = datetime.strptime

            controller.config = {
                "schedule": {
                    "enabled": True,
                    "start_time": "09:00",
                    "end_time": "17:00"
                }
            }

            controller._check_schedule()
            assert controller.is_display_active is False

    def test_overnight_schedule_active_late(self, test_display_controller):
        """Test overnight schedule when current time is late (after start)."""
        controller = test_display_controller
        with patch('src.display_controller.datetime') as mock_datetime:
            mock_datetime.now.return_value.strftime.return_value.lower.return_value = "monday"
            mock_datetime.now.return_value.time.return_value = datetime.strptime("23:00", "%H:%M").time()
            mock_datetime.strptime = datetime.strptime

            controller.config = {
                "schedule": {
                    "enabled": True,
                    "start_time": "20:00",
                    "end_time": "06:00"
                }
            }
            controller._check_schedule()
            assert controller.is_display_active is True

    def test_per_day_schedule_disabled_day(self, test_display_controller):
        """Test per-day schedule when current day is disabled."""
        controller = test_display_controller
        with patch('src.display_controller.datetime') as mock_datetime:
            mock_datetime.now.return_value.strftime.return_value.lower.return_value = "monday"
            mock_datetime.now.return_value.time.return_value = datetime.strptime("12:00", "%H:%M").time()
            mock_datetime.strptime = datetime.strptime

            controller.config = {
                "schedule": {
                    "enabled": True,
                    "start_time": "09:00",
                    "end_time": "17:00",
                    "days": {
                        "monday": {"enabled": False}
                    }
                }
            }
            controller._check_schedule()
            assert controller.is_display_active is False


@pytest.mark.unit
class TestDisplayControllerVegasMode:
    """Test Vegas mode integration."""

    def test_vegas_mode_not_active_no_coordinator(self, test_display_controller):
        """Test Vegas mode not active when coordinator is None."""
        controller = test_display_controller
        assert controller._is_vegas_mode_active() is False

    def test_vegas_mode_not_active_on_demand(self, test_display_controller):
        """Test Vegas mode not active during on-demand."""
        controller = test_display_controller
        controller.vegas_coordinator = MagicMock()
        controller.vegas_coordinator.is_enabled = True
        controller.on_demand_active = True
        assert controller._is_vegas_mode_active() is False

    def test_vegas_mode_active(self, test_display_controller):
        """Test Vegas mode is active when enabled and no on-demand."""
        controller = test_display_controller
        controller.vegas_coordinator = MagicMock()
        controller.vegas_coordinator.is_enabled = True
        controller.on_demand_active = False
        assert controller._is_vegas_mode_active() is True

    def test_check_vegas_interrupt_on_demand(self, test_display_controller):
        """Test Vegas interrupt check with on-demand active."""
        controller = test_display_controller
        controller.on_demand_active = True
        assert controller._check_vegas_interrupt() is True

    def test_check_vegas_interrupt_none(self, test_display_controller):
        """Test Vegas interrupt returns False when nothing pending."""
        controller = test_display_controller
        controller.on_demand_active = False
        with patch.object(controller, '_check_wifi_status_message', return_value=None):
            assert controller._check_vegas_interrupt() is False


@pytest.mark.unit
class TestDisplayControllerPluginUpdates:
    """Test plugin update management."""

    def test_update_modules(self, test_display_controller):
        """Test _update_modules calls plugin updates."""
        controller = test_display_controller
        mock_plugin = MagicMock()
        mock_plugin.update = MagicMock()
        controller.plugin_manager.loaded_plugins = {"test": mock_plugin}
        controller.plugin_manager.health_tracker = None
        controller.plugin_manager.plugin_executor = None
        delattr(controller.plugin_manager, 'plugin_executor')

        controller._update_modules()
        mock_plugin.update.assert_called_once()

    def test_update_modules_circuit_breaker_skip(self, test_display_controller):
        """Test _update_modules skips plugins with circuit breaker active."""
        controller = test_display_controller
        mock_plugin = MagicMock()
        controller.plugin_manager.loaded_plugins = {"broken": mock_plugin}
        controller.plugin_manager.health_tracker = MagicMock()
        controller.plugin_manager.health_tracker.should_skip_plugin.return_value = True

        controller._update_modules()
        mock_plugin.update.assert_not_called()

    def test_tick_plugin_updates(self, test_display_controller):
        """Test _tick_plugin_updates calls scheduled updates."""
        controller = test_display_controller
        controller.plugin_manager.run_scheduled_updates = MagicMock()
        controller._tick_plugin_updates()
        controller.plugin_manager.run_scheduled_updates.assert_called_once()

    def test_sleep_with_plugin_updates(self, test_display_controller):
        """Test _sleep_with_plugin_updates sleeps while ticking updates."""
        controller = test_display_controller
        with patch('src.display_controller.time.sleep'), \
             patch.object(controller, '_tick_plugin_updates') as mock_tick:
            controller._sleep_with_plugin_updates(0.1, tick_interval=0.05)
            assert mock_tick.called


@pytest.mark.unit
class TestDisplayControllerRun:
    """Test the run loop at a high level."""

    def test_run_no_modes_exits(self, test_display_controller):
        """Test that run() exits immediately when no modes are available."""
        controller = test_display_controller
        controller.available_modes = []
        controller.run()
        controller.display_manager.cleanup.assert_called()


@pytest.mark.unit
class TestDisplayControllerWifiStatus:
    """Test WiFi status message handling."""

    def test_check_wifi_status_no_file(self, test_display_controller):
        """Test wifi status check when file doesn't exist."""
        controller = test_display_controller
        controller.wifi_status_file = Path("/nonexistent/wifi_status.json")
        result = controller._check_wifi_status_message()
        assert result is None

    def test_check_wifi_status_valid(self, test_display_controller, tmp_path):
        """Test wifi status check with valid file."""
        controller = test_display_controller
        status_file = tmp_path / "wifi_status.json"
        data = {
            "message": "Connected to WiFi",
            "timestamp": time.time(),
            "duration": 60
        }
        status_file.write_text(json.dumps(data))
        controller.wifi_status_file = status_file

        result = controller._check_wifi_status_message()
        assert result is not None
        assert result['message'] == "Connected to WiFi"

    def test_check_wifi_status_expired(self, test_display_controller, tmp_path):
        """Test wifi status check with expired message."""
        controller = test_display_controller
        status_file = tmp_path / "wifi_status.json"
        data = {
            "message": "Old message",
            "timestamp": time.time() - 100,
            "duration": 5
        }
        status_file.write_text(json.dumps(data))
        controller.wifi_status_file = status_file

        result = controller._check_wifi_status_message()
        assert result is None

    def test_display_wifi_status_message(self, test_display_controller):
        """Test displaying a wifi status message."""
        controller = test_display_controller
        controller.display_manager.width = 128
        controller.display_manager.height = 32
        controller.display_manager.get_font_height = MagicMock(return_value=8)
        controller.display_manager.small_font = MagicMock()
        status_data = {
            'message': 'WiFi OK',
            'expires_at': time.time() + 30,
        }
        result = controller._display_wifi_status_message(status_data)
        assert result is True
        assert controller.wifi_status_active is True

    def test_cleanup_expired_wifi_status(self, test_display_controller, tmp_path):
        """Test cleanup of expired wifi status."""
        controller = test_display_controller
        status_file = tmp_path / "wifi_status.json"
        status_file.write_text("{}")
        controller.wifi_status_file = status_file
        controller.wifi_status_active = True
        controller.wifi_status_expires_at = time.time() - 10

        controller._cleanup_expired_wifi_status()
        assert controller.wifi_status_active is False
        assert controller.wifi_status_expires_at is None


@pytest.mark.unit
class TestDisplayControllerOnDemandModePopulation:
    """Test on-demand mode population from plugin."""

    def test_populate_on_demand_modes_basic(self, test_display_controller):
        """Test populating on-demand modes from plugin display modes."""
        controller = test_display_controller
        controller.on_demand_active = True
        controller.on_demand_plugin_id = "sports"

        mock_plugin = MagicMock()
        controller.plugin_display_modes = {"sports": ["sports_live", "sports_recent"]}
        controller.plugin_modes = {"sports_live": mock_plugin, "sports_recent": mock_plugin}
        controller.mode_to_plugin_id = {"sports_live": "sports", "sports_recent": "sports"}

        controller._populate_on_demand_modes_from_plugin()
        assert "sports_recent" in controller.on_demand_modes


@pytest.mark.unit
class TestDisplayControllerCleanup:
    """Test cleanup behavior."""

    def test_cleanup(self, test_display_controller):
        """Test cleanup shuts down services."""
        controller = test_display_controller
        controller.cleanup()
        controller.display_manager.cleanup.assert_called()
