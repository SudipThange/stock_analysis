from django.apps import AppConfig


class StockConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'stock'

    def ready(self):
        # Preload local symbol index once so autocomplete stays fast at runtime.
        from .services.symbol_index import load_symbols

        try:
            load_symbols()
        except Exception:
            # Do not block startup if CSV is absent or malformed.
            pass
