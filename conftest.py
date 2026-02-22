"""
Root-level conftest.py for LEDMatrix tests.

Sets up environment and mocks before any test collection occurs.
"""

import os
import sys
from unittest.mock import MagicMock

# Ensure EMULATOR mode is set before any import of display_manager
os.environ["EMULATOR"] = "true"

# Mock rgbmatrix module in case RGBMatrixEmulator is not installed or import fails
# This prevents collection errors on non-Pi environments
if "rgbmatrix" not in sys.modules:
    rgbmatrix_mock = MagicMock()
    rgbmatrix_mock.RGBMatrix = MagicMock
    rgbmatrix_mock.RGBMatrixOptions = MagicMock
    sys.modules["rgbmatrix"] = rgbmatrix_mock
