"""Tests for the XAdES-EPES signature of the DIAN (annex FE 1.9 §10) over Fiscal. documents and official examples."""

from datetime import UTC, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import BestAvailableEncryption, pkcs12
from cryptography.x509.oid import NameOID
from lxml import etree

from dian import signing
from dian.ubl.common import NS
from dian.ubl.invoice import build_invoice
from dian.xsd import errors
from fiscal_app.models import SoftwareRegistration
from fiscal_app.services.document_validation import validate_document
from fiscal_app.services.self_signed import SIGNING_KEY_USAGE
from fiscal_app.services.ubl_mapping import document_spec, resolution_of
from fiscal_app.tests.conftest import restaurant_bill

EXAMPLES = Path(signing.__file__).resolve().parent / 'resources' / 'examples'
SIGNED_AT = datetime(2026, 10, 4, 13, 6, 30, tzinfo=ZoneInfo('America/Bogota'))
CA_USAGE = x509.KeyUsage(
    digital_signature=False, content_commitment=False, key_encipherment=False, data_encipherment=False,
    key_agreement=False, key_cert_sign=True, crl_sign=True, encipher_only=False, decipher_only=False,
)
SIGN_ONLY_USAGE = x509.KeyUsage(
    digital_signature=True, content_commitment=False, key_encipherment=False, data_encipherment=False,
    key_agreement=False, key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False,
)


def issue(name, key, issuer_name, issuer_key, usage, algorithm=hashes.SHA256):
    """A certificate for `name` signed by the issuer, valid around SIGNED_AT."""
    return (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, name)]))
        .issuer_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, issuer_name)]))
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(datetime(2026, 1, 1, tzinfo=UTC))
        .not_valid_after(datetime(2027, 1, 1, tzinfo=UTC))
        .add_extension(usage, critical=True)
        .sign(issuer_key, algorithm())
    )


@pytest.fixture(scope='module')
def chain():
    """Root CA → intermediate CA → issuer certificate, like the ONAC-accredited entities issue them."""
    keys = [rsa.generate_private_key(public_exponent=65537, key_size=2048) for _ in range(3)]
    root = issue('Raíz de Prueba', keys[0], 'Raíz de Prueba', keys[0], CA_USAGE)
    intermediate = issue('Subordinada de Prueba', keys[1], 'Raíz de Prueba', keys[0], CA_USAGE)
    leaf = issue('Restaurante de Prueba SAS', keys[2], 'Subordinada de Prueba', keys[1], SIGNING_KEY_USAGE)
    return keys[2], leaf, intermediate, root, keys[1]


@pytest.fixture(scope='module')
def credentials(chain):
    """Credentials loaded from a .p12 whose extra certificates come root first, out of order."""
    key, leaf, intermediate, root, _ = chain
    raw = pkcs12.serialize_key_and_certificates(b'x', key, leaf, [root, intermediate], BestAvailableEncryption(b'clave'))
    return signing.load_pkcs12(raw, 'clave')


@pytest.fixture
def invoice(ready_issuer, make_document, invoice_range):
    """The restaurant bill of contract v1 as an unsigned UBL invoice."""
    payload, _problems = validate_document('invoice', restaurant_bill())
    document = make_document(payload=payload, issue_datetime=datetime(2026, 10, 4, 13, 5, tzinfo=ZoneInfo('America/Bogota')))
    spec = document_spec(document, SoftwareRegistration.objects.get(issuer=ready_issuer))
    return build_invoice(spec, resolution_of(invoice_range))


def signed_bytes(invoice, credentials):
    signing.sign(invoice.root, credentials, SIGNED_AT)
    return invoice.tostring()


@pytest.mark.parametrize('name', ['ConsumidorFinal.xml', 'CreditNote.xml', 'DebitNote.xml', 'GenericaPagoAnticipado.xml'])
def test_official_signed_examples_verify(name):
    """Fails if canonicalization or digests differ from the signers that produced the DIAN's own examples."""
    root = etree.parse(str(EXAMPLES / name)).getroot()

    certificate = signing.verify(root)

    assert 'Persona Juri' in certificate.subject.rfc4514_string()


def test_policy_digest_is_the_one_of_the_official_examples():
    """Fails if the policy hash drifts from the SHA-256 of the DIAN policy PDF that the official examples carry."""
    digests = set()
    for path in EXAMPLES.glob('*.xml'):
        policy_hash = etree.parse(str(path)).getroot().find('.//xades:SigPolicyHash', NS)
        if policy_hash.find('ds:DigestMethod', NS).get('Algorithm') == signing.SHA256:
            digests.add(policy_hash.findtext('ds:DigestValue', namespaces=NS))

    assert digests == {signing.POLICY_DIGEST}


@pytest.mark.django_db
def test_signed_invoice_verifies_after_serializing(invoice, credentials, chain):
    """Fails if the signature does not survive serialization, the form in which the DIAN receives it."""
    data = signed_bytes(invoice, credentials)

    certificate = signing.verify(etree.fromstring(data))

    assert certificate == chain[1]


@pytest.mark.django_db
def test_changing_one_byte_breaks_the_signature(invoice, credentials):
    """Fails if a signed invoice whose total was altered still passes as validly signed."""
    data = signed_bytes(invoice, credentials)
    tampered = data.replace(b'<cbc:PayableAmount currencyID="COP">', b'<cbc:PayableAmount currencyID="COP">1', 1)

    with pytest.raises(signing.SigningError, match='cambió tras firmarse'):
        signing.verify(etree.fromstring(tampered))


@pytest.mark.django_db
def test_reformatting_after_signing_breaks_the_signature(invoice, credentials):
    """Fails if pretty-printing a signed document goes unnoticed: the DIAN would reject it."""
    data = signed_bytes(invoice, credentials)
    pretty = etree.tostring(etree.fromstring(data), pretty_print=True)

    with pytest.raises(signing.SigningError):
        signing.verify(etree.fromstring(pretty))


@pytest.mark.django_db
def test_signed_invoice_is_still_valid_against_the_xsd(invoice, credentials):
    """Fails if the ds:Signature breaks the official schemas (xmldsig and XAdES 1.3.2 are validated)."""
    data = signed_bytes(invoice, credentials)

    assert errors(etree.fromstring(data)) == []


@pytest.mark.django_db
def test_signature_goes_in_the_second_extension(invoice, credentials):
    """Fails if the signature is not in the second ext:UBLExtension, after sts:DianExtensions (§10.8)."""
    root = etree.fromstring(signed_bytes(invoice, credentials))

    contents = root.findall('ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent', NS)

    assert [etree.QName(content[0]).localname for content in contents] == ['DianExtensions', 'Signature']


@pytest.mark.django_db
def test_signed_properties_follow_the_dian_policy(invoice, credentials):
    """Fails if the policy URL, its hash, the signer role or the Colombian signing time are not as in §10.10–§10.12."""
    root = etree.fromstring(signed_bytes(invoice, credentials))
    properties = root.find('.//xades:SignedSignatureProperties', NS)

    assert properties.findtext('xades:SigningTime', namespaces=NS) == '2026-10-04T13:06:30.000-05:00'
    assert properties.findtext('.//xades:Identifier', namespaces=NS) == signing.POLICY_URL
    assert properties.findtext('.//xades:SigPolicyHash/ds:DigestValue', namespaces=NS) == signing.POLICY_DIGEST
    assert properties.findtext('.//xades:ClaimedRole', namespaces=NS) == 'supplier'


@pytest.mark.django_db
def test_signing_certificate_lists_the_chain_up_to_the_root(invoice, credentials, chain):
    """Fails if SigningCertificate misses a certificate of the chain or lists it out of order (DC25–DC46)."""
    _key, leaf, intermediate, root_ca, _ = chain
    root = etree.fromstring(signed_bytes(invoice, credentials))

    serials = [int(text) for text in root.xpath('.//xades:Cert/xades:IssuerSerial/ds:X509SerialNumber/text()', namespaces=NS)]

    assert serials == [leaf.serial_number, intermediate.serial_number, root_ca.serial_number]


@pytest.mark.django_db
def test_signature_references_document_keyinfo_and_signed_properties(invoice, credentials):
    """Fails if SignedInfo does not cover the whole document, the KeyInfo and the SignedProperties (§10.9)."""
    root = etree.fromstring(signed_bytes(invoice, credentials))

    references = root.findall('.//ds:SignedInfo/ds:Reference', NS)

    assert references[0].get('URI') == ''
    assert references[1].get('URI') == '#' + root.find('.//ds:KeyInfo', NS).get('Id')
    assert references[2].get('URI') == '#' + root.find('.//xades:SignedProperties', NS).get('Id')
    assert references[2].get('Type') == signing.SIGNED_PROPERTIES_TYPE


@pytest.mark.django_db
def test_document_cannot_be_signed_twice(invoice, credentials):
    """Fails if a second signature is appended to an already signed document."""
    signing.sign(invoice.root, credentials, SIGNED_AT)

    with pytest.raises(signing.SigningError, match='ya está firmado'):
        signing.sign(invoice.root, credentials, SIGNED_AT)


@pytest.mark.django_db
def test_signing_outside_the_certificate_validity_is_refused(invoice, credentials):
    """Fails if a document is signed with a date outside the certificate validity, which the DIAN rejects."""
    with pytest.raises(signing.SigningError, match='no está vigente'):
        signing.sign(invoice.root, credentials, datetime(2027, 1, 2, tzinfo=UTC))


def test_certificate_without_non_repudiation_is_refused(chain):
    """Fails if a certificate without Non Repudiation is accepted for signing (§10.14, Regla-2)."""
    _key, _leaf, intermediate, _root, intermediate_key = chain
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    leaf = issue('Sin No Repudio', key, 'Subordinada de Prueba', intermediate_key, SIGN_ONLY_USAGE)

    with pytest.raises(signing.SigningError, match='no repudio'):
        signing.check_certificate(signing.SigningCredentials(key, leaf, (intermediate,)))


def test_wrong_password_does_not_open_the_certificate(chain):
    """Fails if a .p12 opens with a wrong password or the error repeats the password."""
    key, leaf, *_ = chain
    raw = pkcs12.serialize_key_and_certificates(b'x', key, leaf, None, BestAvailableEncryption(b'clave'))

    with pytest.raises(signing.SigningError) as error:
        signing.load_pkcs12(raw, 'otra-clave')

    assert 'otra-clave' not in str(error.value)

