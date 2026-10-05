# Fiscal. · Contrato v1 de la API para sistemas cliente

> Estado: autenticación, emisores, certificados, software y rangos (F1 PR 3). Los documentos entran en F1 PR 4 y los
> avisos de vuelta en F1 PR 5. Reemplaza al borrador previo al inventario.

API de máquina para los sistemas que usan Fiscal. (Waiter primero; después otras casas de software). Base:
`/api/v1/`. Cuerpos JSON en UTF-8.

## Registro de un sistema cliente

Lo hace ProjectApp en el servidor de Fiscal.:

```bash
python manage.py create_client_system "Waiter" --webhook-url https://<waiter>/internal/fiscal/events
```

El comando imprime `FISCAL_KEY_ID` y `FISCAL_SECRET` **una sola vez**; van al `.env` del sistema cliente.

- **Rotación:** `python manage.py rotate_client_secret <key_id> --grace-hours 24` emite un secreto nuevo. El
  anterior sigue sirviendo durante el periodo de gracia, para cambiarlo sin cortar el servicio; los más viejos dejan de
  servir de inmediato. Nunca hay más de dos secretos vigentes.

## Firma de cada petición

Toda petición lleva tres cabeceras:

| Cabecera | Valor |
|---|---|
| `X-Fiscal-Key` | `FISCAL_KEY_ID` |
| `X-Fiscal-Timestamp` | Segundos Unix del momento de la firma |
| `X-Fiscal-Signature` | `hex(HMAC-SHA256(FISCAL_SECRET, texto_canónico))` |

El texto canónico son cuatro líneas unidas con `\n`, sin salto final:

```
<timestamp>
<MÉTODO en mayúsculas>
<ruta con su consulta, p. ej. /api/v1/issuers/900373115/>
<sha256 en hex del cuerpo exacto enviado; de b"" si no hay cuerpo>
```

Implementación de referencia (Python), la misma de `fiscal_app/authentication/signing.py`:

```python
import hashlib, hmac, time

def signed_headers(key_id, secret, method, path, body=b''):
    ts = str(int(time.time()))
    canonical = '\n'.join([ts, method.upper(), path, hashlib.sha256(body).hexdigest()]).encode()
    signature = hmac.new(secret.encode(), canonical, hashlib.sha256).hexdigest()
    return {'X-Fiscal-Key': key_id, 'X-Fiscal-Timestamp': ts, 'X-Fiscal-Signature': signature}
```

- Una firma con más de **5 minutos** de diferencia con la hora del servidor se rechaza, así que los dos equipos deben
  tener NTP.
- **Un JWT de operador no abre esta API:** es solo para sistemas cliente.

## Errores

Toda respuesta de error tiene la forma:

```json
{"error": {"code": "issuer_not_found", "message": "No hay un emisor con ese NIT."}}
```

`message` está en español y listo para mostrar. Los errores de validación de campos agregan `fields`, con el detalle
por campo.

| Código | HTTP | Cuándo |
|---|---|---|
| `signature_missing` | 401 | Falta alguna de las tres cabeceras |
| `signature_expired` | 401 | La hora de la firma está fuera de la ventana de 5 minutos |
| `signature_invalid` | 401 | La firma no coincide, el `key_id` no existe o el cliente está inactivo |
| `issuer_not_found` | 404 | El NIT no existe en **este** sistema cliente (uno de otro cliente responde igual) |
| `invalid_data` | 400 | Validación de campos; ver `fields` |
| `invalid_nit`, `invalid_dv` | 400 | NIT mal formado o dígito de verificación que no le corresponde |
| `municipality_department_mismatch` | 400 | El municipio DANE no pertenece al departamento |
| `invalid_certificate`, `certificate_expired` | 400 | El `.p12` no abre, no trae la llave o ya venció |
| `invalid_range`, `invalid_validity`, `technical_key_required` | 400 | Rango invertido, vigencia invertida o rango de facturación sin clave técnica |
| `duplicate_range` | 409 | Esa resolución y ese prefijo ya están registrados |

## Emisores

### `PUT /api/v1/issuers/{nit}/update/`

Crea (`201`) o actualiza (`200`) un comercio. El NIT va en la URL, sin puntos ni dígito de verificación.

```json
{
  "dv": "3",
  "person_type": "1",
  "legal_name": "Restaurante de Prueba SAS",
  "trade_name": "La Prueba",
  "tax_responsibilities": ["O-13"],
  "tax_scheme": "04",
  "address_line": "Calle 10 # 43-12",
  "municipality_code": "05001",
  "department_code": "05",
  "postal_code": "050021",
  "email": "facturacion@restaurante.test",
  "phone": "",
  "environment": "2"
}
```

| Campo | Regla (códigos de la DIAN, caja de herramientas FE 1.9) |
|---|---|
| `person_type` | `TipoOrganizacion`: `1` jurídica, `2` natural |
| `tax_responsibilities` | `TipoResponsabilidad`: `O-13`, `O-15`, `O-23`, `O-47`, `ZZ`… Se pasan a mayúsculas |
| `tax_scheme` | Tributo del emisor: `01` IVA, `04` INC, `ZZ` no aplica |
| `municipality_code` y `department_code` | Códigos DANE de 5 y 2 dígitos; el municipio debe empezar por el departamento |
| `environment` | `TipoAmbiente`: `2` pruebas (habilitación), `1` producción |

### `GET /api/v1/issuers/{nit}/`

Datos del emisor, con:
- `certificate`: el certificado activo (titular, emisor, serie y vigencia) o `null`;
- `software_registrations`: los registros del software, con `has_software_pin` en lugar del PIN;
- `numbering_ranges`: los rangos, con `has_technical_key` en lugar de la clave.

### `PUT /api/v1/issuers/{nit}/certificate/update/`

```json
{"p12": "<base64 del .p12>", "password": "…"}
```

Reemplaza el certificado activo. El certificado es del comercio (D7). Responde titular, emisor, serie y vigencia; el
archivo y la contraseña quedan cifrados y no vuelven a salir.

### `PUT /api/v1/issuers/{nit}/software/update/`

Lo que devuelve el portal de la DIAN cuando el comercio registra el software «propio o adquirido», con ProjectApp como
fabricante:

```json
{"environment": "2", "software_id": "<uuid>", "software_pin": "<pin elegido>", "test_set_id": "<uuid>"}
```

Queda como el registro activo de ese ambiente. El PIN se guarda cifrado, porque entra en cada CUDE y en el
`SoftwareSecurityCode`.

## Rangos de numeración

### `POST /api/v1/issuers/{nit}/ranges/create/`

```json
{
  "kind": "invoice",
  "resolution_number": "18764000001234",
  "resolution_date": "2026-09-01",
  "prefix": "FE1",
  "number_from": 1,
  "number_to": 5000,
  "valid_from": "2026-09-01",
  "valid_to": "2028-09-01",
  "technical_key": "<de GetNumberingRange>",
  "establishment": "Sede Poblado"
}
```

- `kind`: `invoice` o `contingency` (factura de papel o talonario para la contingencia del emisor, tipo 03).
- `prefix`: hasta 4 caracteres alfanuméricos, en mayúsculas. Obligatorio cuando hay más de un local.
- `technical_key`: obligatoria en los rangos de facturación, porque entra en el CUFE. Se guarda cifrada y no vuelve a
  salir.

### `GET /api/v1/issuers/{nit}/ranges/`

Lista los rangos del emisor, sin claves técnicas.
