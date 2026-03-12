"""
Production settings entrypoint.

Use with:
DJANGO_SETTINGS_MODULE=stock_analysis.settings_prod
"""

import os

os.environ.setdefault('DJANGO_ENV', 'production')
os.environ.setdefault('DJANGO_DEBUG', '0')

from .settings import *  # noqa: F401,F403

if DEBUG:
    raise RuntimeError('Production settings cannot run with DEBUG=True.')
