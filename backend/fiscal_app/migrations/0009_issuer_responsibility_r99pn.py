"""Issuers stored with the genericode «ZZ» get the R-99-PN of annex table 13.2.6.1 (the DIAN rejects ZZ, rule FAJ26)."""

from django.db import migrations


def forwards(apps, schema_editor):
    Issuer = apps.get_model('fiscal_app', 'Issuer')
    for issuer in Issuer.objects.all():
        codes = ['R-99-PN' if code == 'ZZ' else code for code in issuer.tax_responsibilities or []]
        codes = list(dict.fromkeys(codes)) or ['R-99-PN']
        if codes != issuer.tax_responsibilities:
            issuer.tax_responsibilities = codes
            issuer.save(update_fields=['tax_responsibilities'])


class Migration(migrations.Migration):
    dependencies = [('fiscal_app', '0008_test_set_note_counts')]
    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
