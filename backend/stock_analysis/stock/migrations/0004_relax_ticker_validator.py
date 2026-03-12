from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('stock', '0003_ticker_unique_per_portfolio'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stock',
            name='ticker',
            field=models.CharField(
                max_length=20,
                validators=[
                    django.core.validators.RegexValidator(
                        regex='^[A-Z0-9\\.\\-&]+$',
                        message='Ticker must contain only uppercase letters, numbers, dots, hyphens, and ampersands.',
                    )
                ],
            ),
        ),
    ]
