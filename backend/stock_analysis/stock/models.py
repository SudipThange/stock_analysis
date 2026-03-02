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
        regex=r'^[A-Z\.]+$',
        message="Ticker must contain only uppercase letters and dots."
    )

    ticker = models.CharField(
        max_length=20,
        unique=True,
        validators=[ticker_validator],
        null=False,
        blank=False
    )

    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} ({self.ticker})"
