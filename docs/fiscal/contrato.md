# Fiscal. · Contrato v1 de la API para sistemas cliente

> Estado: autenticación, emisores, certificados, software y rangos (F1 PR 3) y documentos con validación previa
> (F1 PR 4). Los avisos de vuelta y la transmisión llegan en F1 PR 5. Reemplaza al borrador previo al inventario.

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
| `issuer_not_ready` | 409 | El emisor no tiene certificado vigente o registro del software en su ambiente |
| `number_out_of_range` | 400 | El número no está en un rango vigente del emisor para la fecha de emisión |
| `issue_datetime_in_future`, `issue_datetime_too_old` | 400 | Fecha de emisión futura, o de hace más de 24 h sin ser contingencia |
| `invalid_document` | 400 | El documento tiene problemas que la DIAN rechazaría; ver `problems` |
| `idempotency_conflict`, `duplicate_number` | 409 | Misma clave con otro contenido; número repetido |
| `document_not_found` | 404 | El documento no existe en **este** sistema cliente |

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

## Documentos

### `POST /api/v1/documents/create/`

```json
{
  "idempotency_key": "waiter:<org>:<id del documento en Waiter>",
  "issuer": "900373115",
  "kind": "invoice",
  "prefix": "SETP",
  "number": 990000001,
  "issue_datetime": "2026-10-04T13:05:00-05:00",
  "document": { "…": "documento comercial, abajo" }
}
```

- `kind`: `invoice`, `credit_note` o `debit_note` (D2: factura electrónica para todo).
- `prefix` y `number`: la numeración la asigna el sistema cliente. En una factura, el número debe estar en un rango
  vigente del emisor para la fecha de emisión; las notas se numeran sin resolución.
- `issue_datetime`: con zona horaria; Fiscal. la usa en hora de Colombia (−05:00). No puede ser futura, y fuera de
  una contingencia no puede tener más de 24 horas, porque la DIAN exige que la fecha de emisión sea la de firma (FAD09e).
- **Idempotencia:**
  - el mismo cuerpo con la misma clave responde `200` con el mismo documento, así que tras un corte de red se reenvía
    sin miedo;
  - la misma clave con otro contenido responde `409 idempotency_conflict`.
- Responde `202` con el documento en estado `queued`.

#### Documento comercial

Los montos van como texto con hasta dos decimales (`"36900.00"`); nunca negativos. Ejemplo de una cuenta de
restaurante: 2 hamburguesas y 1 limonada con INC 8 %, canje de puntos y propina del 10 %.

```json
{
  "buyer": {"final_consumer": true},
  "sale_channel": "on_site",
  "lines": [
    {"code": "HAM-01", "description": "Hamburguesa de la casa", "quantity": "2", "unit_code": "94",
     "unit_price": "18450.00", "line_extension": "36900.00",
     "taxes": [{"code": "04", "rate": "8.00", "taxable_amount": "36900.00", "amount": "2952.00"}]},
    {"code": "LIM-01", "description": "Limonada natural", "quantity": "1", "unit_code": "94",
     "unit_price": "6000.00", "line_extension": "6000.00",
     "taxes": [{"code": "04", "rate": "8.00", "taxable_amount": "6000.00", "amount": "480.00"}]}
  ],
  "allowances": [{"reason": "Canje de puntos", "amount": "5000.00"}],
  "charges": [{"kind": "tip", "reason": "Propina voluntaria", "amount": "4290.00"}],
  "totals": {"line_extension": "42900.00", "tax_exclusive": "42900.00", "tax_inclusive": "46332.00",
             "allowance_total": "5000.00", "charge_total": "4290.00", "payable": "45622.00"},
  "payment": {"form": "1", "means": ["10"]}
}
```

| Bloque | Reglas |
|---|---|
| `buyer` | `{"final_consumer": true}`: Fiscal. lo informa como `222222222222`, tipo `13`, `R-99-PN` (anexo FE 1.9, FAK62 y FAK26). Si no, `id_type` (TipoIdFiscal: 13 cédula, 31 NIT…), `id_number` sin puntos, `dv` si es NIT (FAK64), `person_type`, `name`, `tax_responsibilities` (TipoResponsabilidad o `R-99-PN`), `tax_scheme` (01, 04 o ZZ), `email` y `address` opcionales |
| `sale_channel` y `delivery_address` | `on_site` o `delivery`. Un domicilio a consumidor final o a una persona con cédula debe llevar `delivery_address` (`line` y `municipality_code` DANE) (Res. 000227 de 2025, art. 1.5.1.2.2.1 num. 3) |
| `lines` | Entre 1 y 500. `quantity` > 0 (FAV04b); `unit_code` de UnidadesMedida (FAV05; 94 = unidad); `line_extension` = cantidad × precio − descuentos + cargos de la línea (FAV06) |
| `lines[].taxes` | Un tributo por código en cada línea. Etapa 1: `01` IVA y `04` INC, con las tarifas de su lista (IVA 0, 5, 16, 19; INC 2, 4, 8, 16). `taxable_amount` = valor de la línea, así que **la propina nunca entra en la base**. `amount` = base × tarifa (FAS07) |
| `allowances` | Descuentos globales (por ejemplo, el canje de puntos). **Nunca como línea negativa** |
| `charges` | Cargos globales. La propina va con `"kind": "tip"`, sin impuestos y como máximo el 10 % del consumo (Ley 1935 de 2018) |
| `totals` | Se comprueban como los compara la DIAN: FAU02 (suma de líneas), FAU04 (suma de bases), FAU06 (bruto + tributos), FAU08 (descuentos), FAU10 (cargos), FAU14 (`payable` = con tributos − descuentos + cargos + `rounding`) |
| `payment` | `form` de FormasPago (1 contado, 2 crédito; a crédito exige `due_date`, FAN04); `means`: lista de MediosPago (10 efectivo, 48 tarjeta crédito, 49 tarjeta débito…) (FAN03) |
| `billing_reference` (notas) | `document_id` (id en Fiscal. de la factura que corrige), `concept_code` (ConceptoNotaCredito: 2 = anulación…; ConceptoNotaDebito) y `reason` |
| `currency` | `COP` en la etapa 1 |

**Redondeo y tolerancia** (anexo FE 1.9, §5.2.1): redondeo half-to-even (NTC 3711); tolerancia de ±2,00 en los valores
y de ±5,00 en el IVA cuando se aproxima a la decena.

**Errores del documento:** `400 invalid_document`, con `problems`, la lista completa de problemas para corregirlos de
una vez:

```json
{"error": {"code": "invalid_document", "message": "El documento tiene 1 problema(s) que la DIAN rechazaría.",
  "problems": [{"path": "totals.payable", "code": "payable_mismatch", "rule": "FAU14",
                "message": "Debe ser bruto con tributos − descuentos + cargos (45622.00)."}]}}
```

### `GET /api/v1/documents/{id}/`

Estado del documento (`queued`, `transmitting`, `validated`, `rejected`, `contingency_dian` o `contingency_issuer`),
CUFE o CUDE, URL del QR, errores de la DIAN, intentos, factura original (en las notas) y su historia de eventos.
