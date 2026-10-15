'use client';

import { useApiBaseUrl, useApiDocsStore } from '@/lib/stores/apiDocsStore';

/** The example business and tenant host used across the docs (never real data). */
export const EXAMPLE = {
  nit: '900373115',
  dv: '3',
  name: 'Restaurante de Prueba SAS',
  origin: 'restaurante-x.waiter.co',
  domain: 'waiter.co',
};

/** Values that change with the environment switch: habilitación (2) or producción (1). */
export function useDocVars() {
  const base = useApiBaseUrl();
  const prod = useApiDocsStore((s) => s.env === 'prod');
  return {
    base,
    prod,
    environment: prod ? '1' : '2',
    environmentName: prod ? 'producción' : 'habilitación',
    prefix: prod ? 'FE1' : 'SETP',
    number: prod ? 1 : 990000001,
    resolution: prod ? '18764000001234' : '18760000001',
    dianUrl: prod ? 'https://vpfe.dian.gov.co/WcfDianCustomerServices.svc' : 'https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc',
    portal: prod ? 'https://catalogo-vpfe.dian.gov.co/User/Login' : 'https://catalogo-vpfe-hab.dian.gov.co/User/Login',
  };
}

/** A signed request in each language: the helper every other example builds on. */
export function signingHelper(base: string) {
  return {
    python: `import hashlib, hmac, json, os, time

import requests

FISCAL_URL = os.environ.get('FISCAL_URL', '${base}')
KEY_ID = os.environ['FISCAL_KEY_ID']
SECRET = os.environ['FISCAL_SECRET']


def fiscal(method, path, payload=None, origin=''):
    """Petición firmada a Fiscal.; \`origin\` es el host del comercio (restaurante-x.waiter.co)."""
    body = json.dumps(payload).encode() if payload is not None else b''
    ts = str(int(time.time()))
    lines = [ts, method.upper(), path, hashlib.sha256(body).hexdigest()]
    if origin:
        lines.append(origin)
    signature = hmac.new(SECRET.encode(), '\\n'.join(lines).encode(), hashlib.sha256).hexdigest()
    headers = {
        'Content-Type': 'application/json',
        'X-Fiscal-Key': KEY_ID,
        'X-Fiscal-Timestamp': ts,
        'X-Fiscal-Signature': signature,
    }
    if origin:
        headers['X-Fiscal-Origin'] = origin
    # Envía exactamente los bytes que se firmaron.
    return requests.request(method, FISCAL_URL + path, data=body, headers=headers, timeout=30)`,
    node: `import { createHash, createHmac } from 'node:crypto'

const FISCAL_URL = process.env.FISCAL_URL ?? '${base}'
const KEY_ID = process.env.FISCAL_KEY_ID
const SECRET = process.env.FISCAL_SECRET

// Petición firmada a Fiscal.; \`origin\` es el host del comercio (restaurante-x.waiter.co).
export async function fiscal(method, path, payload, origin = '') {
  const body = payload === undefined ? '' : JSON.stringify(payload)
  const ts = String(Math.floor(Date.now() / 1000))
  const lines = [ts, method.toUpperCase(), path, createHash('sha256').update(body).digest('hex')]
  if (origin) lines.push(origin)
  const signature = createHmac('sha256', SECRET).update(lines.join('\\n')).digest('hex')
  const headers = {
    'Content-Type': 'application/json',
    'X-Fiscal-Key': KEY_ID,
    'X-Fiscal-Timestamp': ts,
    'X-Fiscal-Signature': signature,
  }
  if (origin) headers['X-Fiscal-Origin'] = origin
  // Envía exactamente el texto que se firmó.
  return fetch(FISCAL_URL + path, { method, headers, body: body || undefined })
}`,
    curl: `# Variables: FISCAL_URL=${base} FISCAL_KEY_ID=fk_… FISCAL_SECRET=… ORIGIN=${EXAMPLE.origin}
METHOD=GET
REQ_PATH=/api/v1/issuers/${EXAMPLE.nit}/
BODY=''
TS=$(date +%s)
BODY_HASH=$(printf '%s' "$BODY" | sha256sum | cut -d' ' -f1)
# Cinco líneas con ORIGIN; quita la última si el sistema cliente no tiene dominio.
SIGNATURE=$(printf '%s\\n%s\\n%s\\n%s\\n%s' "$TS" "$METHOD" "$REQ_PATH" "$BODY_HASH" "$ORIGIN" \\
  | openssl dgst -sha256 -hmac "$FISCAL_SECRET" -hex | sed 's/^.* //')

curl -X "$METHOD" "$FISCAL_URL$REQ_PATH" \\
  -H "X-Fiscal-Key: $FISCAL_KEY_ID" \\
  -H "X-Fiscal-Timestamp: $TS" \\
  -H "X-Fiscal-Signature: $SIGNATURE" \\
  -H "X-Fiscal-Origin: $ORIGIN"`,
  };
}

/** A call through the helper, in Python and Node.js. */
export function call(method: string, path: string, payload?: string) {
  const pyPayload = payload ? `, ${payload.replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')}` : '';
  const nodePayload = payload ? `, ${payload}` : ', undefined';
  return {
    python: `response = fiscal('${method}', '${path}'${pyPayload}, origin='${EXAMPLE.origin}')
print(response.status_code, response.json())`,
    node: `const response = await fiscal('${method}', '${path}'${nodePayload}, '${EXAMPLE.origin}')
console.log(response.status, await response.json())`,
  };
}
