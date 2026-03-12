from django.db import models
from django.core.validators import RegexValidator
from portfolio.models import Portfolio   # make sure Portfolio is defined above or import properly


class Stock(models.Model):
    portfolio = models.ForeignKey(
        Portfolio,
        on_delete=models.CASCADE,
        related_name='stocks'
    )

    title_validator = RegexValidator(
        regex=r'^[A-Za-z0-9 .&\-\(\),]+$',
        message="Title may include letters, numbers, spaces, ., -, &, (, )."
    )

    title = models.CharField(
        max_length=255,
        validators=[title_validator],
        null=False,
        blank=False
    )

    ticker_validator = RegexValidator(
        regex=r'^[A-Z0-9\.\-&]+$',
        message="Ticker must contain only uppercase letters, numbers, dots, hyphens, and ampersands."
    )

    ticker = models.CharField(
        max_length=20,
        validators=[ticker_validator],
        null=False,
        blank=False
    )

    today_open = models.FloatField(null=True, blank=True)
    today_close = models.FloatField(null=True, blank=True)
    min_price = models.FloatField(null=True, blank=True)
    max_price = models.FloatField(null=True, blank=True)
    avg_price_last_month = models.FloatField(null=True, blank=True)
    pe_ratio = models.FloatField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['portfolio', 'ticker'], name='unique_ticker_per_portfolio')
        ]

    def __str__(self):
        return f"{self.title} ({self.ticker})"
