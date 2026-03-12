from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('stock', '0002_stock_avg_price_last_month_stock_max_price_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='stock',
            name='ticker',
            field=models.CharField(max_length=20, validators=[django.core.validators.RegexValidator(message='Ticker must contain only uppercase letters and dots.', regex='^[A-Z\\.]+$')]),
        ),
        migrations.AddConstraint(
            model_name='stock',
            constraint=models.UniqueConstraint(fields=('portfolio', 'ticker'), name='unique_ticker_per_portfolio'),
        ),
    ]
