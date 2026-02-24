"""System service — system stats and service control."""

import subprocess
import time
from typing import Any

import psutil


class SystemService:
    """System monitoring with throttled reads."""

    _cache: dict[str, Any] | None = None
    _cache_time: float = 0
    _cache_ttl: float = 5.0  # seconds

    @classmethod
    def get_status(cls) -> dict[str, Any]:
        now = time.time()
        if cls._cache and (now - cls._cache_time) < cls._cache_ttl:
            return cls._cache

        cpu_temp = 0.0
        try:
            with open("/sys/class/thermal/thermal_zone0/temp") as f:
                cpu_temp = round(float(f.read()) / 1000.0, 1)
        except (FileNotFoundError, ValueError):
            pass

        service_active = False
        try:
            result = subprocess.run(
                ["systemctl", "is-active", "ledmatrix"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            service_active = result.stdout.strip() == "active"
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass

        cls._cache = {
            "cpu_percent": psutil.cpu_percent(interval=0),
            "memory_percent": round(psutil.virtual_memory().percent, 1),
            "cpu_temp": cpu_temp,
            "service_active": service_active,
            "timestamp": now,
        }
        cls._cache_time = now
        return cls._cache

    @classmethod
    def run_action(cls, action: str) -> dict[str, str]:
        """Run a system action (restart, stop)."""
        allowed = {"restart": "restart", "stop": "stop"}
        cmd = allowed.get(action)
        if not cmd:
            return {"status": "error", "message": f"Unknown action: {action}"}
        try:
            subprocess.run(
                ["sudo", "systemctl", cmd, "ledmatrix"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            cls._cache = None  # Invalidate
            return {"status": "ok", "message": f"Service {cmd} initiated"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
