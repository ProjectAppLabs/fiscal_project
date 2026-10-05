"""Simulated DIAN for development, E2E runs and tests. It signs nothing and transmits nothing.

Its codes and files say SIMULADO and have no fiscal value. It refuses production issuers, so a misconfigured server
can never mark a real document as validated.
"""

import hashlib
import json

from .gateway import DianGateway, GatewayRefused, GatewayResult, Submission

QR_BASE = {
    '1': 'https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=',
    '2': 'https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey=',
}


class SimulatedGateway(DianGateway):
    def send(self, submission: Submission) -> GatewayResult:
        if submission.environment == '1':
            raise GatewayRefused('La DIAN simulada no atiende emisores en producción.')
        seed = f'SIMULADO|{submission.issuer_nit}|{submission.prefix}{submission.number}|{submission.payload_hash}'
        cufe = hashlib.sha384(seed.encode()).hexdigest()
        summary = {
            'simulated': True, 'cufe': cufe, 'number': f'{submission.prefix}{submission.number}',
            'issuer': submission.issuer_nit, 'kind': submission.kind,
        }
        return GatewayResult(
            state='validated',
            cufe=cufe,
            qr_url=QR_BASE[submission.environment] + cufe,
            signed_xml=f'<!-- SIMULADO: sin firma ni validez fiscal -->\n<Simulated>{json.dumps(summary)}</Simulated>\n'.encode(),
            dian_response=json.dumps({'simulated': True, 'IsValid': True, 'StatusCode': '00'}).encode(),
        )

