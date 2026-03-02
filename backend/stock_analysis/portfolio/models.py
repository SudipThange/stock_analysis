from django.db import models
from django.core.validators import RegexValidator


class Portfolio(models.Model):
    title_validator = RegexValidator(
        regex=r'^[A-Za-z ]+$',
        message="Title must contain only letters and spaces."
    )

    title = models.CharField(
        max_length=255,
        validators=[title_validator],
        null=False,
        blank=False
    )

    desc = models.TextField(
        max_length=500,
        null=False,
        blank=False
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title