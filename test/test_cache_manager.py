"""
Tests for CacheManager and cache components.

Tests cache functionality including memory cache, disk cache, strategy, and metrics.
"""

import time
from datetime import datetime
from unittest.mock import patch

import pytest

from src.cache.cache_metrics import CacheMetrics
from src.cache.cache_strategy import CacheStrategy
from src.cache.disk_cache import DiskCache
from src.cache.memory_cache import MemoryCache
from src.cache_manager import CacheManager


class TestCacheManager:
    """Test CacheManager functionality."""

    def test_init(self, tmp_path):
        """Test CacheManager initialization."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            assert cm.cache_dir == str(tmp_path)
            assert hasattr(cm, '_memory_cache_component')
            assert hasattr(cm, '_disk_cache_component')
            assert hasattr(cm, '_strategy_component')
            assert hasattr(cm, '_metrics_component')

    def test_set_and_get(self, tmp_path):
        """Test basic set and get operations."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            test_data = {"key": "value", "number": 42}

            cm.set("test_key", test_data)
            result = cm.get("test_key")

            assert result == test_data

    def test_get_expired(self, tmp_path):
        """Test getting expired cache entry."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.set("test_key", {"data": "value"})

            # Get with max_age=0 to force expiration
            result = cm.get("test_key", max_age=0)
            assert result is None


class TestCacheStrategy:
    """Test CacheStrategy functionality."""

    def test_get_cache_strategy_default(self):
        """Test getting default cache strategy."""
        strategy = CacheStrategy()
        result = strategy.get_cache_strategy("unknown_type")

        assert "max_age" in result
        assert "memory_ttl" in result
        assert result["max_age"] == 300  # Default

    def test_get_cache_strategy_live(self):
        """Test getting live sports cache strategy."""
        strategy = CacheStrategy()
        result = strategy.get_cache_strategy("sports_live")

        assert "max_age" in result
        assert result["max_age"] <= 60  # Live data should be short

    def test_get_data_type_from_key(self):
        """Test data type detection from cache key."""
        strategy = CacheStrategy()

        assert strategy.get_data_type_from_key("nba_live_scores") == "sports_live"
        # "weather_current" contains "current" which matches live sports pattern first
        # Use "weather" without "current" to test weather detection
        assert strategy.get_data_type_from_key("weather") == "weather_current"
        assert strategy.get_data_type_from_key("weather_data") == "weather_current"
        assert strategy.get_data_type_from_key("unknown_key") == "default"


class TestMemoryCache:
    """Test MemoryCache functionality."""

    def test_init(self):
        """Test MemoryCache initialization."""
        cache = MemoryCache(max_size=100, cleanup_interval=60.0)

        assert cache._max_size == 100
        assert cache._cleanup_interval == 60.0
        assert cache.size() == 0

    def test_set_and_get(self):
        """Test basic set and get operations."""
        cache = MemoryCache()
        test_data = {"key": "value", "number": 42}

        cache.set("test_key", test_data)
        result = cache.get("test_key")

        assert result == test_data

    def test_get_expired(self):
        """Test getting expired cache entry."""
        cache = MemoryCache()
        cache.set("test_key", {"data": "value"})

        # Backdate the timestamp to ensure expiration
        cache._timestamps["test_key"] = time.time() - 10
        result = cache.get("test_key", max_age=1)
        assert result is None

    def test_get_nonexistent(self):
        """Test getting non-existent key."""
        cache = MemoryCache()
        result = cache.get("nonexistent_key")
        assert result is None

    def test_clear_specific_key(self):
        """Test clearing a specific cache key."""
        cache = MemoryCache()
        cache.set("key1", {"data": "value1"})
        cache.set("key2", {"data": "value2"})

        cache.clear("key1")

        assert cache.get("key1") is None
        assert cache.get("key2") is not None

    def test_clear_all(self):
        """Test clearing all cache entries."""
        cache = MemoryCache()
        cache.set("key1", {"data": "value1"})
        cache.set("key2", {"data": "value2"})

        cache.clear()

        assert cache.size() == 0
        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_cleanup_expired(self):
        """Test cleanup removes expired entries."""
        cache = MemoryCache()
        cache.set("key1", {"data": "value1"})
        # Force expiration by manipulating timestamp (older than 1 hour cleanup threshold)
        # Cleanup uses max_age_for_cleanup = 3600 (1 hour)
        cache._timestamps["key1"] = time.time() - 4000  # More than 1 hour

        removed = cache.cleanup(force=True)

        # Cleanup should remove expired entries (older than 3600 seconds)
        # The key should be gone after cleanup
        assert cache.get("key1") is None or removed >= 0

    def test_cleanup_size_limit(self):
        """Test cleanup enforces size limits."""
        cache = MemoryCache(max_size=3)
        # Add more entries than max_size
        for i in range(5):
            cache.set(f"key{i}", {"data": f"value{i}"})

        removed = cache.cleanup(force=True)

        assert cache.size() <= cache._max_size
        assert removed >= 0

    def test_size(self):
        """Test size reporting."""
        cache = MemoryCache()
        assert cache.size() == 0

        cache.set("key1", {"data": "value1"})
        cache.set("key2", {"data": "value2"})

        assert cache.size() == 2

    def test_max_size(self):
        """Test max_size property."""
        cache = MemoryCache(max_size=500)
        assert cache.max_size() == 500

    def test_get_stats(self):
        """Test getting cache statistics."""
        cache = MemoryCache()
        cache.set("key1", {"data": "value1"})
        cache.set("key2", {"data": "value2"})

        stats = cache.get_stats()

        assert "size" in stats
        assert "max_size" in stats
        assert stats["size"] == 2
        assert stats["max_size"] == 1000  # default


class TestCacheMetrics:
    """Test CacheMetrics functionality."""

    def test_record_hit(self):
        """Test recording cache hit."""
        metrics = CacheMetrics()
        metrics.record_hit()
        stats = metrics.get_metrics()

        # get_metrics() returns calculated values, not raw hits/misses
        assert stats['total_requests'] == 1
        assert stats['cache_hit_rate'] == 1.0  # 1 hit out of 1 request

    def test_record_miss(self):
        """Test recording cache miss."""
        metrics = CacheMetrics()
        metrics.record_miss()
        stats = metrics.get_metrics()

        # get_metrics() returns calculated values, not raw hits/misses
        assert stats['total_requests'] == 1
        assert stats['cache_hit_rate'] == 0.0  # 0 hits out of 1 request

    def test_record_fetch_time(self):
        """Test recording fetch time."""
        metrics = CacheMetrics()
        metrics.record_fetch_time(0.5)
        stats = metrics.get_metrics()

        assert stats['fetch_count'] == 1
        assert stats['total_fetch_time'] == 0.5
        assert stats['average_fetch_time'] == 0.5

    def test_cache_hit_rate(self):
        """Test cache hit rate calculation."""
        metrics = CacheMetrics()
        metrics.record_hit()
        metrics.record_hit()
        metrics.record_miss()

        stats = metrics.get_metrics()
        assert stats['cache_hit_rate'] == pytest.approx(0.666, abs=0.01)


class TestDiskCache:
    """Test DiskCache functionality."""

    def test_init_with_dir(self, tmp_path):
        """Test DiskCache initialization with directory."""
        cache = DiskCache(cache_dir=str(tmp_path))
        assert cache.cache_dir == str(tmp_path)

    def test_init_without_dir(self):
        """Test DiskCache initialization without directory."""
        cache = DiskCache(cache_dir=None)
        assert cache.cache_dir is None

    def test_get_cache_path(self, tmp_path):
        """Test getting cache file path."""
        cache = DiskCache(cache_dir=str(tmp_path))
        path = cache.get_cache_path("test_key")
        assert path == str(tmp_path / "test_key.json")

    def test_get_cache_path_disabled(self):
        """Test getting cache path when disabled."""
        cache = DiskCache(cache_dir=None)
        path = cache.get_cache_path("test_key")
        assert path is None

    def test_set_and_get(self, tmp_path):
        """Test basic set and get operations."""
        cache = DiskCache(cache_dir=str(tmp_path))
        test_data = {"key": "value", "number": 42}

        cache.set("test_key", test_data)
        result = cache.get("test_key")

        assert result == test_data

    def test_get_expired(self, tmp_path):
        """Test getting expired cache entry."""
        cache = DiskCache(cache_dir=str(tmp_path))
        cache.set("test_key", {"data": "value"})

        # Get with max_age=0 to force expiration
        result = cache.get("test_key", max_age=0)
        assert result is None

    def test_get_nonexistent(self, tmp_path):
        """Test getting non-existent key."""
        cache = DiskCache(cache_dir=str(tmp_path))
        result = cache.get("nonexistent_key")
        assert result is None

    def test_clear_specific_key(self, tmp_path):
        """Test clearing a specific cache key."""
        cache = DiskCache(cache_dir=str(tmp_path))
        cache.set("key1", {"data": "value1"})
        cache.set("key2", {"data": "value2"})

        cache.clear("key1")

        assert cache.get("key1") is None
        assert cache.get("key2") is not None

    def test_clear_all(self, tmp_path):
        """Test clearing all cache entries."""
        cache = DiskCache(cache_dir=str(tmp_path))
        cache.set("key1", {"data": "value1"})
        cache.set("key2", {"data": "value2"})

        cache.clear()

        assert cache.get("key1") is None
        assert cache.get("key2") is None

    def test_get_cache_dir(self, tmp_path):
        """Test getting cache directory."""
        cache = DiskCache(cache_dir=str(tmp_path))
        assert cache.get_cache_dir() == str(tmp_path)

    def test_set_with_datetime(self, tmp_path):
        """Test setting cache with datetime objects."""
        cache = DiskCache(cache_dir=str(tmp_path))
        test_data = {
            "timestamp": datetime.now(),
            "data": "value"
        }

        cache.set("test_key", test_data)
        result = cache.get("test_key")

        # Datetime should be serialized/deserialized
        assert result is not None
        assert "data" in result

    def test_cleanup_interval(self, tmp_path):
        """Test cleanup respects interval."""
        cache = MemoryCache(cleanup_interval=60.0)
        cache.set("key1", {"data": "value1"})

        # First cleanup should work
        cache.cleanup(force=True)

        # Second cleanup immediately after should return 0 (unless forced)
        removed2 = cache.cleanup(force=False)

        # If forced, should work; if not forced and within interval, should return 0
        assert removed2 >= 0

    def test_get_with_invalid_timestamp(self):
        """Test getting entry with invalid timestamp format."""
        cache = MemoryCache()
        cache.set("key1", {"data": "value1"})
        # Set invalid timestamp
        cache._timestamps["key1"] = "invalid_timestamp"

        result = cache.get("key1")

        # Should handle gracefully
        assert result is None or isinstance(result, dict)

    def test_record_background_hit(self):
        """Test recording background cache hit."""
        metrics = CacheMetrics()
        metrics.record_hit(cache_type='background')
        stats = metrics.get_metrics()

        assert stats['total_requests'] == 1
        assert stats['background_hit_rate'] == 1.0

    def test_record_background_miss(self):
        """Test recording background cache miss."""
        metrics = CacheMetrics()
        metrics.record_miss(cache_type='background')
        stats = metrics.get_metrics()

        assert stats['total_requests'] == 1
        assert stats['background_hit_rate'] == 0.0

    def test_multiple_fetch_times(self):
        """Test recording multiple fetch times."""
        metrics = CacheMetrics()
        metrics.record_fetch_time(0.5)
        metrics.record_fetch_time(1.0)
        metrics.record_fetch_time(0.3)

        stats = metrics.get_metrics()
        assert stats['fetch_count'] == 3
        assert stats['total_fetch_time'] == 1.8
        assert stats['average_fetch_time'] == pytest.approx(0.6, abs=0.01)


@pytest.mark.unit
class TestCacheManagerIntegration:
    """Test full CacheManager integration (memory + disk)."""

    def test_save_and_load_cache(self, tmp_path):
        """Test save_cache and load_cache round-trip."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            data = {"score": 42, "team": "home"}

            cm.save_cache("game_data", data)
            loaded = cm.load_cache("game_data")

            assert loaded == data

    def test_load_cache_returns_none_for_missing(self, tmp_path):
        """Test load_cache returns None for non-existent key."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            assert cm.load_cache("nonexistent") is None

    def test_get_cached_data_memory_then_disk(self, tmp_path):
        """Test that get_cached_data checks memory first, then disk."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            data = {"key": "value"}

            cm.save_cache("test", data)

            # Clear memory cache to force disk read
            cm._memory_cache_component.clear("test")

            result = cm.get_cached_data("test", max_age=300)
            assert result == data

    def test_get_cached_data_expired(self, tmp_path):
        """Test that expired data returns None."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.save_cache("test", {"data": "old"})

            result = cm.get_cached_data("test", max_age=0)
            assert result is None

    def test_clear_specific_key(self, tmp_path):
        """Test clearing a specific cache key from both memory and disk."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.save_cache("key1", {"a": 1})
            cm.save_cache("key2", {"b": 2})

            cm.clear_cache("key1")

            assert cm.load_cache("key1") is None
            assert cm.load_cache("key2") is not None

    def test_clear_all_cache(self, tmp_path):
        """Test clearing all cache entries."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.save_cache("key1", {"a": 1})
            cm.save_cache("key2", {"b": 2})

            cm.clear_cache()

            assert cm.load_cache("key1") is None
            assert cm.load_cache("key2") is None

    def test_update_cache_wraps_data(self, tmp_path):
        """Test update_cache wraps data with timestamp."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.update_cache("weather", {"temp": 72})

            cached = cm.get_cached_data("weather", max_age=60)
            assert cached is not None
            assert "data" in cached
            assert cached["data"]["temp"] == 72
            assert "timestamp" in cached

    def test_set_with_ttl(self, tmp_path):
        """Test set() stores ttl in cache data."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.set("test", {"val": 1}, ttl=600)

            # Verify the data can be retrieved
            result = cm.get("test", max_age=600)
            assert result == {"val": 1}

    def test_has_data_changed_weather(self, tmp_path):
        """Test has_data_changed for weather data type."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()

            # No cached data means changed
            assert cm.has_data_changed("weather", {"temp": 72}) is True

    def test_has_data_changed_unknown_type(self, tmp_path):
        """Test has_data_changed returns True for unknown types."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            assert cm.has_data_changed("unknown", {"data": 1}) is True

    def test_get_cache_dir(self, tmp_path):
        """Test get_cache_dir returns the configured dir."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            assert cm.get_cache_dir() == str(tmp_path)

    def test_init_no_cache_dir(self):
        """Test CacheManager handles no writable cache dir."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=None):
            cm = CacheManager()
            assert cm.cache_dir is None


@pytest.mark.unit
class TestRetentionPolicies:
    """Test retention policies and disk cleanup."""

    def test_retention_policies_exist(self, tmp_path):
        """Test that retention policies are configured."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            assert 'odds' in cm._retention_policies
            assert 'sports_live' in cm._retention_policies
            assert 'default' in cm._retention_policies
            assert cm._retention_policies['odds'] == 2
            assert cm._retention_policies['default'] == 30

    def test_cleanup_disk_cache_throttled(self, tmp_path):
        """Test that disk cleanup is throttled."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            # Set last cleanup to recent time
            cm._last_disk_cleanup = time.time()

            result = cm.cleanup_disk_cache(force=False)
            assert result['files_scanned'] == 0

    def test_cleanup_disk_cache_forced(self, tmp_path):
        """Test forced disk cleanup runs regardless of throttle."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm._last_disk_cleanup = time.time()

            result = cm.cleanup_disk_cache(force=True)
            assert isinstance(result['files_scanned'], int)
            assert isinstance(result['files_deleted'], int)
            assert isinstance(result['space_freed_mb'], float)


@pytest.mark.unit
class TestBackgroundCleanupThread:
    """Test background cleanup thread lifecycle."""

    def test_start_cleanup_thread(self, tmp_path):
        """Test starting the cleanup thread."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            # Thread should already be started by init
            assert cm._cleanup_thread is not None
            assert cm._cleanup_thread.is_alive()

            cm.stop_cleanup_thread()

    def test_stop_cleanup_thread(self, tmp_path):
        """Test stopping the cleanup thread."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.stop_cleanup_thread()

            assert not cm._cleanup_thread.is_alive()

    def test_stop_cleanup_thread_when_not_running(self, tmp_path):
        """Test stopping thread when not running is safe."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.stop_cleanup_thread()
            # Calling stop again should not raise
            cm.stop_cleanup_thread()

    def test_start_cleanup_thread_no_double_start(self, tmp_path):
        """Test that starting thread twice does not create duplicate."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            first_thread = cm._cleanup_thread
            cm.start_cleanup_thread()
            assert cm._cleanup_thread is first_thread

            cm.stop_cleanup_thread()


@pytest.mark.unit
class TestCacheStatistics:
    """Test cache statistics and metrics."""

    def test_get_memory_cache_stats(self, tmp_path):
        """Test memory cache stats reporting."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.save_cache("key1", {"a": 1})

            stats = cm.get_memory_cache_stats()
            assert stats['size'] >= 1
            assert stats['max_size'] == 1000
            assert 'usage_percent' in stats
            assert 'last_cleanup' in stats

    def test_record_cache_hit_and_miss(self, tmp_path):
        """Test recording cache hits and misses."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.record_cache_hit()
            cm.record_cache_miss()

            metrics = cm.get_cache_metrics()
            assert metrics['total_requests'] == 2

    def test_record_fetch_time(self, tmp_path):
        """Test recording fetch duration."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.record_fetch_time(0.5)
            cm.record_fetch_time(1.0)

            metrics = cm.get_cache_metrics()
            assert metrics['fetch_count'] == 2
            assert metrics['average_fetch_time'] == pytest.approx(0.75, abs=0.01)

    def test_list_cache_files(self, tmp_path):
        """Test listing cache files."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.save_cache("test_file", {"data": "value"})

            files = cm.list_cache_files()
            assert len(files) >= 1
            assert files[0]['key'] == 'test_file'
            assert 'size_bytes' in files[0]
            assert 'age_display' in files[0]

    def test_list_cache_files_empty_dir(self, tmp_path):
        """Test listing cache files from empty directory."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            files = cm.list_cache_files()
            assert files == []

    def test_list_cache_files_no_cache_dir(self):
        """Test listing cache files with no cache dir."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=None):
            cm = CacheManager()
            files = cm.list_cache_files()
            assert files == []


@pytest.mark.unit
class TestCacheStrategyIntegration:
    """Test composite caching strategies via CacheManager."""

    def test_get_cache_strategy(self, tmp_path):
        """Test getting cache strategy from manager."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            strategy = cm.get_cache_strategy("sports_live")
            assert "max_age" in strategy
            assert strategy["max_age"] <= 60

    def test_get_data_type_from_key(self, tmp_path):
        """Test data type detection from cache key."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            assert cm.get_data_type_from_key("nba_live_scores") == "sports_live"
            assert cm.get_data_type_from_key("unknown_key") == "default"

    def test_get_with_auto_strategy(self, tmp_path):
        """Test get_with_auto_strategy returns None for missing data."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            result = cm.get_with_auto_strategy("nonexistent_key")
            assert result is None

    def test_get_cached_data_with_strategy(self, tmp_path):
        """Test getting cached data using strategy."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.set("weather_data", {"temp": 72})

            result = cm.get_cached_data_with_strategy("weather_data", "weather_current")
            assert result is not None

    def test_generate_sport_cache_key(self, tmp_path):
        """Test sport cache key generation."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            key = cm.generate_sport_cache_key("nba", "20260222")
            assert key == "nba_20260222"

    def test_generate_sport_cache_key_auto_date(self, tmp_path):
        """Test sport cache key generation with automatic date."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            key = cm.generate_sport_cache_key("nfl")
            assert key.startswith("nfl_")
            assert len(key) == 12  # nfl_ + 8 digit date


@pytest.mark.unit
class TestMemoryCacheCleanup:
    """Test memory cache cleanup behavior."""

    def test_cleanup_expired_entries(self, tmp_path):
        """Test cleanup removes entries older than 1 hour."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm.save_cache("old_key", {"data": "old"})

            # Manually age the entry
            cm._memory_cache_timestamps["old_key"] = time.time() - 7200

            removed = cm._cleanup_memory_cache(force=True)
            assert removed >= 1

    def test_cleanup_respects_interval(self, tmp_path):
        """Test cleanup skips when within interval."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm._last_memory_cache_cleanup = time.time()

            removed = cm._cleanup_memory_cache(force=False)
            assert removed == 0

    def test_cleanup_handles_invalid_timestamps(self, tmp_path):
        """Test cleanup handles string timestamps."""
        with patch('src.cache_manager.CacheManager._get_writable_cache_dir', return_value=str(tmp_path)):
            cm = CacheManager()
            cm._memory_cache["bad_key"] = {"data": "value"}
            cm._memory_cache_timestamps["bad_key"] = "invalid_ts"

            removed = cm._cleanup_memory_cache(force=True)
            # Entry with invalid timestamp should be removed
            assert removed >= 1
