from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def assign_owner_to_existing_portfolios(apps, schema_editor):
    Portfolio = apps.get_model('portfolio', 'Portfolio')
    User = apps.get_model('user', 'User')

    first_user = User.objects.order_by('id').first()
    if first_user is None:
        return

    Portfolio.objects.filter(owner__isnull=True).update(owner=first_user)


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0001_initial'),
        ('portfolio', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='portfolio',
            name='owner',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='portfolios', to=settings.AUTH_USER_MODEL),
        ),
        migrations.RunPython(assign_owner_to_existing_portfolios, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='portfolio',
            name='owner',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='portfolios', to=settings.AUTH_USER_MODEL),
        ),
    ]
