# Fiscal. · Contrato v1 para los sistemas cliente

> **Borrador anterior al inventario.** Se rehace en Z1 con la forma exacta del documento comercial que sale del
> [inventario](inventario/README.md). Lo de la firma HMAC y la idempotencia se mantiene.

Todo lo que un sistema cliente (Waiter u otro) necesita para hablar con el microservicio fiscal. Lo marcado
**(pendiente, fase)** todavía no existe.

## Registro de un sistema cliente

Lo hace ProjectApp en el servidor del servicio:

```bash
venv/bin/python manage.py create_client waiter --webhook-url https://<waiter>/internal/fiscal/events
```

Muestra una sola vez `FISCAL_KEY_ID` y `FISCAL_SECRET`, que van al `.env` del sistema cliente. El secreto se puede
rotar; el anterior deja de servir en ese momento.

## Firma de cada petición

Toda petición, salvo `GET /v1/health`, lleva tres cabeceras:

| Cabecera | Valor |
|---|---|
| `X-Fiscal-Key` | `FISCAL_KEY_ID` |
| `X-Fiscal-Timestamp` | Segundos Unix de cuando se firmó |
| `X-Fiscal-Signature` | `hex(HMAC-SHA256(FISCAL_SECRET, texto canónico))` |

Texto canónico: cuatro líneas unidas con `\n`, sin salto final:

```
<timestamp>
<MÉTODO en mayúsculas>
<ruta con su consulta, por ejemplo /v1/documents/15>
<sha256 en hex del cuerpo exacto que se envía; de b"" si no hay cuerpo>
```

Implementación de referencia en Python (`core/signing.py`):

```python
import hashlib, hmac, time

def headers(key_id, secret, method, path, body=b''):
    ts = str(int(time.time()))
    canonical = '\n'.join([ts, method.upper(), path, hashlib.sha256(body).hexdigest()]).encode()
    sig = hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()
    return {'X-Fiscal-Key': key_id, 'X-Fiscal-Timestamp': ts, 'X-Fiscal-Signature': sig}
```

Se rechaza una firma con más de 5 minutos de diferencia con la hora del servidor: ambos lados deben tener la hora
sincronizada (NTP).

## Errores

Siempre con la misma forma y el mensaje en español, listo para mostrar:

```json
{"error": {"code": "issuer_not_found", "message": "No hay un emisor con ese NIT."}}
```

| Código | HTTP | Cuándo |
|---|---|---|
| `signature_missing`, `signature_expired`, `signature_invalid` | 401/403 | Firma ausente, vieja o que no coincide |
| `invalid_nit`, `invalid_dv`, `invalid_legal_name`, `invalid_environment` | 400 | Datos del emisor |
| `invalid_certificate`, `certificate_expired` | 400 | El .p12 no abre, no trae llave o ya venció |
| `issuer_not_found`, `document_not_found` | 404 | No existe o es de otro sistema cliente |
| `invalid_idempotency_key`, `invalid_kind`, `invalid_number`, `invalid_document` | 400 | Datos del documento |
| `idempotency_conflict` | 409 | La misma clave con otro contenido |
| `duplicate_number` | 409 | Ese número ya existe para el emisor y el tipo |

## Salud

`GET /v1/health` → `200 {"status": "ok"}`. Sin firma; no revela datos.

## Emisores

`PUT /v1/issuers/<nit>` crea (201) o actualiza (200) una empresa. El NIT va sin puntos ni dígito de verificación.

```json
{"dv": "4", "legal_name": "Restaurante de Prueba SAS", "environment": "habilitacion",
 "software_id": "…", "software_pin": "…", "test_set_id": "…"}
```

`environment` es `habilitacion` (por omisión) o `produccion`. `software_id`, `software_pin` y `test_set_id` los da la
DIAN al registrar el software propio de la empresa en su portal.

`GET /v1/issuers/<nit>` devuelve los datos sin el PIN (`has_software_pin`) y el certificado activo:

```json
{"nit": "800197268", "dv": "4", "legal_name": "…", "environment": "habilitacion", "software_id": "…",
 "has_software_pin": true, "test_set_id": "…",
 "certificate": {"subject": "CN=…", "serial": "…", "not_before": "…", "not_after": "…"}}
```

`PUT /v1/issuers/<nit>/certificate` con `{"p12": "<base64 del .p12>", "password": "…"}` reemplaza el certificado
activo. Responde titular, serie y vigencia; el archivo y la contraseña nunca vuelven a salir.

**(pendiente, Z2)** `POST /v1/issuers/<nit>/test-set`: corre el set de pruebas de habilitación.
**(pendiente, Z2)** `GET /v1/issuers/<nit>/numbering`: rangos autorizados por la DIAN.

## Documentos

`POST /v1/documents` encola un documento:

```json
{
  "idempotency_key": "<org>:<id del documento en el sistema cliente>",
  "issuer": "800197268",
  "kind": "pos",
  "number": "POS-1",
  "document": { "…": "documento comercial: líneas, impuestos, comprador, resolución, totales" }
}
```

- `kind`: `pos` (documento equivalente tiquete POS), `invoice`, `credit_note` o `debit_note`.
- `number` lo asigna el sistema cliente con su resolución de numeración. El servicio nunca lo cambia.
- **Idempotencia:** reenviar exactamente el mismo cuerpo con la misma clave devuelve `200` con el mismo documento.
  Ante un corte de red, el sistema cliente debe reenviar sin miedo. La misma clave con otro contenido da
  `409 idempotency_conflict`.
- La forma exacta de `document` se fija en Z2 a partir del documento comercial que hoy arma Waiter en `billing`.
  En Z1 se acepta cualquier objeto.

Respuesta `202` (nuevo) o `200` (ya existía):

```json
{"id": 15, "idempotency_key": "…", "issuer": "800197268", "kind": "pos", "number": "POS-1", "state": "queued",
 "code": "", "qr": "", "errors": [], "attempts": 0, "created_at": "…", "accepted_at": null}
```

`GET /v1/documents/<id>` devuelve lo mismo, actualizado.

**Estados:** `queued` (en cola), `processing` (transmitiendo), `accepted` (con `code`, el CUFE o CUDE, y `qr`),
`rejected` (con `errors`: código de la regla de la DIAN y mensaje) y `contingency` **(pendiente, Z4)**.

**(pendiente, Z4)** Enlaces al XML firmado, la respuesta de la DIAN, el `AttachedDocument` y el PDF.

## Avisos al sistema cliente (pendiente, Z1)

Cuando cambia el estado de un documento, el servicio hace `POST` al `webhook_url` del sistema cliente con el mismo
cuerpo de `GET /v1/documents/<id>`, firmado con las mismas tres cabeceras y el mismo secreto. El sistema cliente:

- verifica la firma y la hora antes de creer el aviso;
- acepta esa ruta solo desde la red del servicio fiscal, aunque el resto de su sistema esté en internet;
- responde `2xx` rápido; si no, el aviso se reintenta;
- consulta además sus documentos pendientes cada minuto, por si un aviso se pierde.
