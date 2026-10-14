from rest_framework import serializers

from fiscal_app.services import test_set

BOUNDED = {'min_value': 0, 'max_value': 50,
           'error_messages': {'min_value': 'Indica entre 0 y 50.', 'max_value': 'Indica entre 0 y 50.',
                              'invalid': 'Indica entre 0 y 50.'}}


class TestSetStartSerializer(serializers.Serializer):
    """How many documents the set sends: the «Total de documentos requeridos» of the issuer's TestSetId.

    At most 50 documents per ZIP (annex §7.8); the invoices go in one ZIP and the notes in another.
    """

    __test__ = False

    invoices = serializers.IntegerField(default=test_set.SET_INVOICES, **BOUNDED)
    credit_notes = serializers.IntegerField(default=test_set.SET_CREDIT_NOTES, **BOUNDED)
    debit_notes = serializers.IntegerField(default=test_set.SET_DEBIT_NOTES, **BOUNDED)

    def validate_invoices(self, value):
        if value == 0:
            raise serializers.ValidationError('El set necesita al menos una factura.')
        return value

    def validate(self, attrs):
        if attrs['credit_notes'] + attrs['debit_notes'] > 50:
            raise serializers.ValidationError({'notes': ['Las notas crédito y débito no pueden pasar de 50 en total.']})
        return attrs


def describe_run(run):
    """A test set run as both APIs show it: its state and the DIAN's answer for every document."""
    return {
        'id': run.pk, 'state': run.state, 'error': run.error, 'created_at': run.created_at, 'updated_at': run.updated_at,
        'documents': [
            {key: entry[key] for key in ('kind', 'full_number', 'code', 'status', 'messages', 'file_name')}
            for entry in run.entries
        ],
        'phases': [{'name': phase['name'], 'zip_key': phase.get('zip_key', ''), 'errors': phase.get('errors', []),
                    'dian_status': phase.get('dian_status', '')}
                   for phase in run.phases],
    }
