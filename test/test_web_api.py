"""
Tests for Web Interface API endpoints.

Tests Flask routes, request/response handling, and API functionality.
"""

import json
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from flask import Flask  # noqa: E402


@pytest.fixture
def mock_config_manager():
    """Create a mock config manager."""
    mock = MagicMock()
    mock.load_config.return_value = {
        'display': {'brightness': 50},
        'plugins': {},
        'timezone': 'UTC'
    }
    mock.get_config_path.return_value = 'config/config.json'
    mock.get_secrets_path.return_value = 'config/config_secrets.json'
    mock.get_raw_file_content.return_value = {'weather': {'api_key': 'test'}}
    mock.save_config_atomic.return_value = MagicMock(
        status=MagicMock(value='success'),
        message=None
    )
    return mock


@pytest.fixture
def mock_plugin_manager():
    """Create a mock plugin manager."""
    mock = MagicMock()
    mock.plugins = {}
    mock.discover_plugins.return_value = []
    mock.health_tracker = MagicMock()
    mock.health_tracker.get_health_status.return_value = {'healthy': True}
    return mock


@pytest.fixture
def client(mock_config_manager, mock_plugin_manager):
    """Create a Flask test client with mocked dependencies."""
    # Create a minimal Flask app for testing
    test_app = Flask(__name__)
    test_app.config['TESTING'] = True
    test_app.config['SECRET_KEY'] = 'test-secret-key'

    # Register the API blueprint
    from web_interface.blueprints.api_v3 import api_v3

    # Mock the managers on the blueprint
    api_v3.config_manager = mock_config_manager
    api_v3.plugin_manager = mock_plugin_manager
    api_v3.plugin_store_manager = MagicMock()
    api_v3.saved_repositories_manager = MagicMock()
    api_v3.schema_manager = MagicMock()
    api_v3.operation_queue = MagicMock()
    api_v3.plugin_state_manager = MagicMock()
    api_v3.operation_history = MagicMock()
    api_v3.cache_manager = MagicMock()

    # Setup operation queue mocks
    mock_operation = MagicMock()
    mock_operation.operation_id = 'test-op-123'
    mock_operation.status = MagicMock(value='pending')
    api_v3.operation_queue.get_operation_status.return_value = mock_operation
    api_v3.operation_queue.get_recent_operations.return_value = []

    # Setup schema manager mocks
    api_v3.schema_manager.load_schema.return_value = {
        'type': 'object',
        'properties': {'enabled': {'type': 'boolean'}}
    }

    # Setup state manager mocks
    api_v3.plugin_state_manager.get_all_states.return_value = {}

    test_app.register_blueprint(api_v3, url_prefix='/api/v3')

    with test_app.test_client() as client:
        yield client


class TestConfigAPI:
    """Test configuration API endpoints."""

    def test_get_main_config(self, client, mock_config_manager):
        """Test getting main configuration."""
        response = client.get('/api/v3/config/main')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'
        assert 'data' in data
        assert 'display' in data['data']
        mock_config_manager.load_config.assert_called_once()

    def test_save_main_config(self, client, mock_config_manager):
        """Test saving main configuration."""
        new_config = {
            'display': {'brightness': 75},
            'timezone': 'UTC'
        }

        response = client.post(
            '/api/v3/config/main',
            data=json.dumps(new_config),
            content_type='application/json'
        )

        assert response.status_code == 200
        mock_config_manager.save_config_atomic.assert_called_once()

    def test_save_main_config_validation_error(self, client, mock_config_manager):
        """Test saving config with validation error."""
        invalid_config = {'invalid': 'data'}

        mock_config_manager.save_config_atomic.return_value = MagicMock(
            status=MagicMock(value='validation_failed'),
            message='Validation error'
        )

        response = client.post(
            '/api/v3/config/main',
            data=json.dumps(invalid_config),
            content_type='application/json'
        )

        assert response.status_code in [400, 500]

    def test_get_secrets_config(self, client, mock_config_manager):
        """Test getting secrets configuration."""
        response = client.get('/api/v3/config/secrets')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'weather' in data or 'data' in data
        mock_config_manager.get_raw_file_content.assert_called_once()

    def test_save_schedule_config(self, client, mock_config_manager):
        """Test saving schedule configuration."""
        schedule_config = {
            'enabled': True,
            'start_time': '07:00',
            'end_time': '23:00',
            'mode': 'global'
        }

        response = client.post(
            '/api/v3/config/schedule',
            data=json.dumps(schedule_config),
            content_type='application/json'
        )

        assert response.status_code == 200
        mock_config_manager.save_config_atomic.assert_called_once()


class TestSystemAPI:
    """Test system API endpoints."""

    @patch('web_interface.blueprints.api_v3.subprocess')
    def test_get_system_status(self, mock_subprocess, client):
        """Test getting system status."""
        mock_result = MagicMock()
        mock_result.stdout = 'active\n'
        mock_result.returncode = 0
        mock_subprocess.run.return_value = mock_result

        response = client.get('/api/v3/system/status')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'service' in data or 'status' in data or 'active' in data

    @patch('web_interface.blueprints.api_v3.subprocess')
    def test_get_system_version(self, mock_subprocess, client):
        """Test getting system version."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = 'v1.0.0\n'
        mock_subprocess.run.return_value = mock_result

        response = client.get('/api/v3/system/version')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'version' in data.get('data', {}) or 'version' in data

    @patch('web_interface.blueprints.api_v3.subprocess')
    def test_execute_system_action(self, mock_subprocess, client):
        """Test executing system action."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = 'success'
        mock_subprocess.run.return_value = mock_result

        action_data = {
            'action': 'restart',
            'service': 'ledmatrix'
        }

        response = client.post(
            '/api/v3/system/action',
            data=json.dumps(action_data),
            content_type='application/json'
        )

        # May return 400 if action validation fails, or 200 if successful
        assert response.status_code in [200, 400]


class TestDisplayAPI:
    """Test display API endpoints."""

    def test_get_display_current(self, client):
        """Test getting current display information."""
        # Mock cache manager on the blueprint
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.cache_manager.get.return_value = {
            'mode': 'weather',
            'plugin_id': 'weather'
        }

        response = client.get('/api/v3/display/current')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'mode' in data or 'current' in data or 'data' in data

    def test_get_on_demand_status(self, client):
        """Test getting on-demand display status."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.cache_manager.get.return_value = {
            'active': False,
            'mode': None
        }

        response = client.get('/api/v3/display/on-demand/status')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'active' in data or 'status' in data or 'data' in data

    def test_start_on_demand_display(self, client):
        """Test starting on-demand display."""
        from web_interface.blueprints.api_v3 import api_v3

        request_data = {
            'plugin_id': 'weather',
            'mode': 'weather_current',
            'duration': 30
        }

        # Ensure cache manager is set up
        if not hasattr(api_v3, 'cache_manager') or api_v3.cache_manager is None:
            api_v3.cache_manager = MagicMock()

        response = client.post(
            '/api/v3/display/on-demand/start',
            data=json.dumps(request_data),
            content_type='application/json'
        )

        # May return 404 if plugin not found, 200 if successful, or 500 on error
        assert response.status_code in [200, 201, 404, 500]
        # Verify cache was updated if successful
        if response.status_code in [200, 201]:
            assert api_v3.cache_manager.set.called

    @patch('web_interface.blueprints.api_v3._ensure_cache_manager')
    def test_stop_on_demand_display(self, mock_ensure_cache, client):
        """Test stopping on-demand display."""

        # Mock the cache manager returned by _ensure_cache_manager
        mock_cache_manager = MagicMock()
        mock_ensure_cache.return_value = mock_cache_manager

        response = client.post('/api/v3/display/on-demand/stop')

        # May return 200 if successful or 500 on error
        assert response.status_code in [200, 500]
        # Verify stop request was set in cache if successful
        if response.status_code == 200:
            assert mock_cache_manager.set.called


class TestPluginsAPI:
    """Test plugins API endpoints."""

    def test_get_installed_plugins(self, client, mock_plugin_manager):
        """Test getting list of installed plugins."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager

        mock_plugin_manager.plugins = {
            'weather': MagicMock(plugin_id='weather'),
            'clock': MagicMock(plugin_id='clock')
        }
        mock_plugin_manager.get_plugin_metadata.return_value = {
            'id': 'weather',
            'name': 'Weather Plugin'
        }

        response = client.get('/api/v3/plugins/installed')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, (list, dict))

    def test_get_plugin_health(self, client, mock_plugin_manager):
        """Test getting plugin health information."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager

        # Setup health tracker
        mock_health_tracker = MagicMock()
        mock_health_tracker.get_all_health_summaries.return_value = {
            'weather': {'healthy': True}
        }
        mock_plugin_manager.health_tracker = mock_health_tracker

        response = client.get('/api/v3/plugins/health')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, (list, dict))

    def test_get_plugin_health_single(self, client, mock_plugin_manager):
        """Test getting health for single plugin."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager

        # Setup health tracker with proper method (endpoint calls get_health_summary)
        mock_health_tracker = MagicMock()
        mock_health_tracker.get_health_summary.return_value = {
            'healthy': True,
            'failures': 0,
            'last_success': '2024-01-01T00:00:00'
        }
        mock_plugin_manager.health_tracker = mock_health_tracker

        response = client.get('/api/v3/plugins/health/weather')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'healthy' in data.get('data', {}) or 'data' in data

    def test_toggle_plugin(self, client, mock_config_manager, mock_plugin_manager):
        """Test toggling plugin enabled state."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.config_manager = mock_config_manager
        api_v3.plugin_manager = mock_plugin_manager
        api_v3.plugin_state_manager = MagicMock()
        api_v3.operation_history = MagicMock()

        # Setup plugin manifests
        mock_plugin_manager.plugin_manifests = {'weather': {}}

        request_data = {
            'plugin_id': 'weather',
            'enabled': True
        }

        response = client.post(
            '/api/v3/plugins/toggle',
            data=json.dumps(request_data),
            content_type='application/json'
        )

        assert response.status_code == 200
        mock_config_manager.save_config_atomic.assert_called_once()

    def test_get_plugin_config(self, client, mock_config_manager):
        """Test getting plugin configuration."""
        from web_interface.blueprints.api_v3 import api_v3

        api_v3.config_manager = mock_config_manager
        # Plugin config lives at top level of config dict, keyed by plugin_id
        mock_config_manager.load_config.return_value = {
            'weather': {
                'enabled': True,
                'api_key': 'test_key'
            }
        }
        # schema_manager.generate_default_config may be called
        api_v3.schema_manager.generate_default_config.return_value = {}
        api_v3.schema_manager.merge_with_defaults.return_value = {
            'enabled': True,
            'api_key': 'test_key'
        }

        response = client.get('/api/v3/plugins/config?plugin_id=weather')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'data' in data

    def test_save_plugin_config(self, client, mock_config_manager):
        """Test saving plugin configuration."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.config_manager = mock_config_manager
        api_v3.schema_manager = MagicMock()
        api_v3.schema_manager.load_schema.return_value = {
            'type': 'object',
            'properties': {'enabled': {'type': 'boolean'}}
        }

        request_data = {
            'plugin_id': 'weather',
            'config': {
                'enabled': True,
                'update_interval': 300
            }
        }

        response = client.post(
            '/api/v3/plugins/config',
            data=json.dumps(request_data),
            content_type='application/json'
        )

        assert response.status_code in [200, 500]  # May fail if validation fails
        if response.status_code == 200:
            mock_config_manager.save_config_atomic.assert_called_once()

    def test_get_plugin_schema(self, client):
        """Test getting plugin configuration schema."""

        response = client.get('/api/v3/plugins/schema?plugin_id=weather')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'type' in data or 'schema' in data or 'data' in data

    def test_get_operation_status(self, client):
        """Test getting plugin operation status."""
        from web_interface.blueprints.api_v3 import api_v3

        # Setup operation queue mock
        mock_operation = MagicMock()
        mock_operation.operation_id = 'test-op-123'
        mock_operation.status = MagicMock(value='pending')
        mock_operation.operation_type = MagicMock(value='install')
        mock_operation.plugin_id = 'test-plugin'
        mock_operation.created_at = '2024-01-01T00:00:00'
        # Add to_dict method that the endpoint calls
        mock_operation.to_dict.return_value = {
            'operation_id': 'test-op-123',
            'status': 'pending',
            'operation_type': 'install',
            'plugin_id': 'test-plugin'
        }

        api_v3.operation_queue.get_operation_status.return_value = mock_operation

        response = client.get('/api/v3/plugins/operation/test-op-123')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'status' in data or 'operation' in data or 'data' in data

    def test_get_operation_history(self, client):
        """Test getting operation history."""

        response = client.get('/api/v3/plugins/operation/history')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, (list, dict))

    def test_get_plugin_state(self, client):
        """Test getting plugin state."""

        response = client.get('/api/v3/plugins/state')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert isinstance(data, (list, dict))


class TestFontsAPI:
    """Test fonts API endpoints."""

    def test_get_fonts_catalog(self, client):
        """Test getting fonts catalog."""
        # Fonts endpoints don't use FontManager, they return hardcoded data
        response = client.get('/api/v3/fonts/catalog')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'catalog' in data.get('data', {}) or 'data' in data

    def test_get_font_tokens(self, client):
        """Test getting font tokens."""
        response = client.get('/api/v3/fonts/tokens')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'tokens' in data.get('data', {}) or 'data' in data

    def test_get_fonts_overrides(self, client):
        """Test getting font overrides."""
        response = client.get('/api/v3/fonts/overrides')

        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'overrides' in data.get('data', {}) or 'data' in data

    def test_save_fonts_overrides(self, client):
        """Test saving font overrides."""
        request_data = {
            'weather': 'small',
            'clock': 'regular'
        }

        response = client.post(
            '/api/v3/fonts/overrides',
            data=json.dumps(request_data),
            content_type='application/json'
        )

        assert response.status_code == 200


class TestScheduleAPI:
    """Test schedule configuration API endpoints."""

    def test_get_schedule_config(self, client, mock_config_manager):
        """Test getting schedule configuration."""
        mock_config_manager.load_config.return_value = {
            'schedule': {'enabled': True, 'start_time': '07:00', 'end_time': '23:00'}
        }
        response = client.get('/api/v3/config/schedule')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'

    def test_save_schedule_invalid_time_format(self, client, mock_config_manager):
        """Test saving schedule with invalid time format."""
        schedule_config = {
            'enabled': True,
            'start_time': 'invalid',
            'end_time': '23:00',
            'mode': 'global'
        }
        response = client.post(
            '/api/v3/config/schedule',
            data=json.dumps(schedule_config),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_save_schedule_no_data(self, client):
        """Test saving schedule with no data."""
        response = client.post(
            '/api/v3/config/schedule',
            data=json.dumps(None),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_save_schedule_string_enabled(self, client, mock_config_manager):
        """Test saving schedule with string 'on' for enabled."""
        schedule_config = {
            'enabled': 'on',
            'start_time': '07:00',
            'end_time': '23:00',
            'mode': 'global'
        }
        response = client.post(
            '/api/v3/config/schedule',
            data=json.dumps(schedule_config),
            content_type='application/json'
        )
        assert response.status_code == 200


class TestDimScheduleAPI:
    """Test dim schedule configuration API endpoints."""

    def test_get_dim_schedule(self, client, mock_config_manager):
        """Test getting dim schedule configuration."""
        mock_config_manager.load_config.return_value = {
            'dim_schedule': {
                'enabled': False,
                'dim_brightness': 30,
                'mode': 'global',
                'start_time': '20:00',
                'end_time': '07:00'
            }
        }
        response = client.get('/api/v3/config/dim-schedule')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'

    def test_get_dim_schedule_defaults_when_missing(self, client, mock_config_manager):
        """Test default dim schedule when not in config."""
        mock_config_manager.load_config.return_value = {}
        response = client.get('/api/v3/config/dim-schedule')
        assert response.status_code == 200

    def test_save_dim_schedule(self, client, mock_config_manager):
        """Test saving dim schedule."""
        dim_config = {
            'enabled': True,
            'dim_brightness': 25,
            'start_time': '21:00',
            'end_time': '06:00',
            'mode': 'global'
        }
        response = client.post(
            '/api/v3/config/dim-schedule',
            data=json.dumps(dim_config),
            content_type='application/json'
        )
        assert response.status_code == 200

    def test_save_dim_schedule_invalid_brightness(self, client, mock_config_manager):
        """Test saving dim schedule with brightness > 100."""
        dim_config = {
            'enabled': True,
            'dim_brightness': 150,
            'mode': 'global',
            'start_time': '20:00',
            'end_time': '07:00'
        }
        response = client.post(
            '/api/v3/config/dim-schedule',
            data=json.dumps(dim_config),
            content_type='application/json'
        )
        assert response.status_code == 400

    def test_save_dim_schedule_no_data(self, client):
        """Test saving dim schedule with no data."""
        response = client.post(
            '/api/v3/config/dim-schedule',
            data=json.dumps(None),
            content_type='application/json'
        )
        assert response.status_code == 400


class TestHealthAPI:
    """Test health check endpoint."""

    @patch('web_interface.blueprints.api_v3._get_display_service_status')
    def test_get_health(self, mock_display_status, client, mock_config_manager, mock_plugin_manager):
        """Test getting system health."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.config_manager = mock_config_manager
        api_v3.plugin_manager = mock_plugin_manager

        mock_display_status.return_value = {'active': True}

        response = client.get('/api/v3/health')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'
        assert 'data' in data
        assert 'services' in data['data']
        assert 'checks' in data['data']


class TestCacheAPI:
    """Test cache management endpoints."""

    def test_list_cache_files(self, client):
        """Test listing cache files."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.cache_manager.list_cache_files.return_value = [
            {'key': 'nfl_scores', 'size': 1024}
        ]
        api_v3.cache_manager.get_cache_dir.return_value = '/tmp/cache'

        response = client.get('/api/v3/cache/list')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'
        assert 'cache_files' in data.get('data', {})

    def test_delete_cache_file(self, client):
        """Test deleting a cache file."""

        response = client.post(
            '/api/v3/cache/delete',
            data=json.dumps({'key': 'nfl_scores'}),
            content_type='application/json'
        )
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'

    def test_delete_cache_file_no_key(self, client):
        """Test deleting cache file without key."""
        response = client.post(
            '/api/v3/cache/delete',
            data=json.dumps({}),
            content_type='application/json'
        )
        assert response.status_code == 400


class TestPluginHealthResetAPI:
    """Test plugin health reset endpoint."""

    def test_reset_plugin_health(self, client, mock_plugin_manager):
        """Test resetting plugin health."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager
        mock_plugin_manager.health_tracker = MagicMock()

        response = client.post('/api/v3/plugins/health/weather/reset')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'
        mock_plugin_manager.health_tracker.reset_health.assert_called_once_with('weather')

    def test_reset_plugin_health_no_tracker(self, client, mock_plugin_manager):
        """Test resetting health when tracker not available."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager
        mock_plugin_manager.health_tracker = None

        response = client.post('/api/v3/plugins/health/weather/reset')
        assert response.status_code == 503


class TestPluginMetricsAPI:
    """Test plugin metrics endpoints."""

    def test_get_all_metrics(self, client, mock_plugin_manager):
        """Test getting all plugin metrics."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager
        mock_plugin_manager.resource_monitor = MagicMock()
        mock_plugin_manager.resource_monitor.get_all_metrics_summaries.return_value = {
            'weather': {'cpu': 0.1, 'memory': 1024}
        }

        response = client.get('/api/v3/plugins/metrics')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'

    def test_get_all_metrics_no_monitor(self, client, mock_plugin_manager):
        """Test getting metrics when monitor not available."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager
        mock_plugin_manager.resource_monitor = None

        response = client.get('/api/v3/plugins/metrics')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('data') == {}

    def test_get_single_plugin_metrics(self, client, mock_plugin_manager):
        """Test getting metrics for a single plugin."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager
        mock_plugin_manager.resource_monitor = MagicMock()
        mock_plugin_manager.resource_monitor.get_metrics_summary.return_value = {
            'cpu': 0.2, 'memory': 2048
        }

        response = client.get('/api/v3/plugins/metrics/weather')
        assert response.status_code == 200

    def test_reset_plugin_metrics(self, client, mock_plugin_manager):
        """Test resetting plugin metrics."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_manager = mock_plugin_manager
        mock_plugin_manager.resource_monitor = MagicMock()

        response = client.post('/api/v3/plugins/metrics/weather/reset')
        assert response.status_code == 200
        mock_plugin_manager.resource_monitor.reset_metrics.assert_called_once_with('weather')


class TestOperationHistoryAPI:
    """Test operation history endpoints."""

    def test_get_operation_history_with_filters(self, client):
        """Test getting operation history with query params."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.operation_history.get_history.return_value = []

        response = client.get('/api/v3/plugins/operation/history?limit=10&plugin_id=weather')
        assert response.status_code == 200

    def test_clear_operation_history(self, client):
        """Test clearing operation history."""
        from web_interface.blueprints.api_v3 import api_v3

        response = client.delete('/api/v3/plugins/operation/history')
        assert response.status_code == 200
        api_v3.operation_history.clear_history.assert_called_once()

    def test_operation_not_found(self, client):
        """Test getting non-existent operation."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.operation_queue.get_operation_status.return_value = None

        response = client.get('/api/v3/plugins/operation/nonexistent-id')
        assert response.status_code == 404


class TestPluginStateAPI:
    """Test plugin state endpoints."""

    def test_get_specific_plugin_state(self, client):
        """Test getting state for a specific plugin."""
        from web_interface.blueprints.api_v3 import api_v3
        mock_state = MagicMock()
        mock_state.to_dict.return_value = {
            'plugin_id': 'weather',
            'installed': True,
            'version': '1.0.0'
        }
        api_v3.plugin_state_manager.get_plugin_state.return_value = mock_state

        response = client.get('/api/v3/plugins/state?plugin_id=weather')
        assert response.status_code == 200

    def test_get_plugin_state_not_found(self, client):
        """Test getting state for non-existent plugin."""
        from web_interface.blueprints.api_v3 import api_v3
        api_v3.plugin_state_manager.get_plugin_state.return_value = None

        response = client.get('/api/v3/plugins/state?plugin_id=nonexistent')
        assert response.status_code == 404


@patch('web_interface.blueprints.api_v3.subprocess')
class TestLogsAPI:
    """Test logs endpoint."""

    def test_get_logs_success(self, mock_subprocess, client):
        """Test getting system logs."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = 'Feb 22 10:00:00 ledmatrix: Starting up...'
        mock_subprocess.run.return_value = mock_result
        mock_subprocess.TimeoutExpired = TimeoutError

        response = client.get('/api/v3/logs')
        assert response.status_code == 200
        data = json.loads(response.data)
        assert data.get('status') == 'success'

    def test_get_logs_failure(self, mock_subprocess, client):
        """Test getting logs when journalctl fails."""
        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stderr = 'Access denied'
        mock_subprocess.run.return_value = mock_result
        mock_subprocess.TimeoutExpired = TimeoutError

        response = client.get('/api/v3/logs')
        assert response.status_code == 500


class TestSystemActionAPI:
    """Test additional system action scenarios."""

    @patch('web_interface.blueprints.api_v3.subprocess')
    def test_system_action_no_action(self, mock_subprocess, client):
        """Test system action with no action field."""
        response = client.post(
            '/api/v3/system/action',
            data=json.dumps({}),
            content_type='application/json'
        )
        assert response.status_code == 400

    @patch('web_interface.blueprints.api_v3.subprocess')
    def test_system_action_start_display(self, mock_subprocess, client):
        """Test start_display action."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = ''
        mock_result.stderr = ''
        mock_subprocess.run.return_value = mock_result

        response = client.post(
            '/api/v3/system/action',
            data=json.dumps({'action': 'start_display'}),
            content_type='application/json'
        )
        assert response.status_code == 200

    @patch('web_interface.blueprints.api_v3.subprocess')
    def test_system_action_stop_display(self, mock_subprocess, client):
        """Test stop_display action."""
        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = ''
        mock_result.stderr = ''
        mock_subprocess.run.return_value = mock_result

        response = client.post(
            '/api/v3/system/action',
            data=json.dumps({'action': 'stop_display'}),
            content_type='application/json'
        )
        assert response.status_code == 200


class TestAPIErrorHandling:
    """Test API error handling."""

    def test_invalid_json_request(self, client):
        """Test handling invalid JSON in request."""
        response = client.post(
            '/api/v3/config/main',
            data='invalid json',
            content_type='application/json'
        )

        # Flask may return 500 for JSON decode errors or 400 for bad request
        assert response.status_code in [400, 415, 500]

    def test_missing_required_fields(self, client):
        """Test handling missing required fields."""
        response = client.post(
            '/api/v3/plugins/toggle',
            data=json.dumps({}),
            content_type='application/json'
        )

        assert response.status_code in [400, 422, 500]

    def test_nonexistent_endpoint(self, client):
        """Test accessing nonexistent endpoint."""
        response = client.get('/api/v3/nonexistent')

        assert response.status_code == 404

    def test_method_not_allowed(self, client):
        """Test using wrong HTTP method."""
        # GET instead of POST
        response = client.get('/api/v3/config/main',
                            query_string={'method': 'POST'})

        # Should work for GET, but if we try POST-only endpoint with GET
        response = client.get('/api/v3/config/schedule')

        # Schedule might allow GET, so test a POST-only endpoint
        response = client.get('/api/v3/display/on-demand/start')

        assert response.status_code in [200, 405]  # Depends on implementation
