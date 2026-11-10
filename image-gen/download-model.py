"""Compatibility entry point for the pinned installer."""
import runpy, sys
from pathlib import Path
sys.argv = [sys.argv[0], "--models", "base"]
runpy.run_path(str(Path(__file__).with_name("install-models.py")), run_name="__main__")
