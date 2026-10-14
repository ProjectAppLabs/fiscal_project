# Fiscal. · Contrato v1 de la API para sistemas cliente

> Estado (2026-10-14): emisores, certificados (`.p12` o certificado y llave), software, rangos, set de pruebas de la
> DIAN, paso a producción, documentos con validación previa, transmisión real a la DIAN (`DIAN_GATEWAY=soap`),
> artefactos y avisos firmados.

API de máquina para los sistemas que usan Fiscal. (Waiter primero; después otras casas de software). Base:
`/api/v1/`. Cuerpos JSON en UTF-8.

La especificación OpenAPI 3.1 de esta misma API está en [`openapi.json`](openapi.json) (se abre con Swagger UI,
Redoc o Postman). Una prueba del backend falla si una ruta de `/api/v1/` no está en este contrato y en esa
especificación.

## Recorrido de un comercio nuevo

Cada comercio factura con **su** certificado y **su** registro ante la DIAN (D1): sistema cliente y Fiscal. solo le
prestan el software. El orden es:

| # | Quién | Qué | Endpoint |
|---|---|---|---|
| 1 | Comercio | Compra su certificado digital a una entidad acreditada por la ONAC | — |
| 2 | Comercio | Se registra en el portal de habilitación de la DIAN, modo «Software propio», software «Fiscal.» y un PIN ([guía](guias/registro-dian.md)) | — |
| 3 | Sistema cliente | Crea el emisor | `PUT /api/v1/issuers/{nit}/update/` |
| 4 | Sistema cliente | Sube el certificado | `PUT /api/v1/issuers/{nit}/certificate/update/` |
| 5 | Sistema cliente | Registra SoftwareID, PIN y TestSetId de habilitación | `PUT /api/v1/issuers/{nit}/software/update/` |
| 6 | Sistema cliente | Registra el rango de habilitación (`SETP`, resolución `18760000001`) con la clave técnica del portal | `POST /api/v1/issuers/{nit}/ranges/create/` |
| 7 | Sistema cliente | Corre el set de pruebas y consulta su resultado hasta que quede `accepted` | `POST …/test-set/start/` y `POST …/test-set/check/` |
| 8 | Comercio | Con su contador, marca «Habilitado» en el portal (fecha irreversible) y pide la numeración en MUISCA | — |
| 9 | Sistema cliente | Copia el software a producción, trae la numeración de la DIAN y pasa a producción | `POST …/production/copy-software/`, `…/fetch-ranges/`, `…/promote/` |
| 10 | Sistema cliente | Emite documentos | `POST /api/v1/documents/create/` |

El PIN, la clave técnica y la contraseña del certificado los escribe el comercio en el sistema cliente; viajan una
sola vez a Fiscal., quedan cifrados y nunca vuelven a salir. El sistema cliente no debe guardarlos ni registrarlos en
sus logs.

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

Implementación de referencia en JavaScript (Node 18+), para un sistema cliente en Node:

```javascript
import { createHash, createHmac } from 'node:crypto'

export function signedHeaders(keyId, secret, method, path, body = '') {
  const ts = String(Math.floor(Date.now() / 1000))
  const bodyHash = createHash('sha256').update(body).digest('hex')
  const canonical = [ts, method.toUpperCase(), path, bodyHash].join('\n')
  const signature = createHmac('sha256', secret).update(canonical).digest('hex')
  return { 'X-Fiscal-Key': keyId, 'X-Fiscal-Timestamp': ts, 'X-Fiscal-Signature': signature }
}

// La firma cubre los bytes exactos del cuerpo: serializa una vez y envía ese mismo texto.
const body = JSON.stringify({ confirm: true })
const path = '/api/v1/issuers/900373115/production/promote/'
await fetch(`${process.env.FISCAL_URL}${path}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...signedHeaders(keyId, secret, 'POST', path, body) },
  body,
})
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
| `invalid_tax_responsibility` | 400 | Una responsabilidad fiscal no está en la tabla 13.2.6.1 |
| `invalid_certificate`, `certificate_expired` | 400 | El `.p12` o el certificado no abre, no trae la llave o ya venció |
| `invalid_key`, `key_password`, `key_mismatch` | 400 | La llave privada no se puede leer, necesita su contraseña o no corresponde al certificado |
| `invalid_range`, `invalid_validity`, `technical_key_required` | 400 | Rango invertido, vigencia invertida o rango de facturación sin clave técnica |
| `duplicate_range` | 409 | Esa resolución y ese prefijo ya están registrados |
| `issuer_not_ready` | 409 | El emisor no tiene certificado vigente o registro del software en su ambiente |
| `number_out_of_range` | 400 | El número no está en un rango vigente del emisor para la fecha de emisión |
| `issue_datetime_in_future`, `issue_datetime_too_old` | 400 | Fecha de emisión futura, o de hace más de 24 h sin ser contingencia |
| `invalid_document` | 400 | El documento tiene problemas que la DIAN rechazaría; ver `problems` |
| `idempotency_conflict`, `duplicate_number` | 409 | Misma clave con otro contenido; número repetido |
| `document_not_found` | 404 | El documento no existe en **este** sistema cliente |
| `artifact_not_found` | 404 | El documento todavía no tiene ese archivo |
| `artifact_unavailable` | 503 | El archivo no se pudo leer o no coincide con su huella registrada |
| `test_set_not_ready` | 409 | Al emisor le falta algo para el set (lo dice `message`) o ya tiene un set en proceso |
| `test_set_not_found` | 404 | El emisor no ha iniciado un set de pruebas |
| `confirmation_required` | 400 | El paso a producción no trae `"confirm": true` |
| `production_not_ready` | 409 | Falta algo para producción (lo dice `message`) o la DIAN no entregó la numeración |

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
| `tax_responsibilities` | Tabla 13.2.6.1 del anexo: `O-13` gran contribuyente, `O-15` autorretenedor, `O-23` agente de retención IVA, `O-47` régimen simple, `R-99-PN` no aplica. Se pasan a mayúsculas; vacío o el antiguo `ZZ` quedan como `R-99-PN` (con `ZZ` la DIAN rechaza, FAJ26) |
| `tax_scheme` | Tributo del emisor: `01` IVA, `04` INC, `ZZ` no aplica |
| `municipality_code` y `department_code` | Códigos DANE de 5 y 2 dígitos; el municipio debe empezar por el departamento |
| `environment` | `TipoAmbiente`: `2` pruebas (habilitación), `1` producción |

### `GET /api/v1/issuers/{nit}/`

Datos del emisor, con:
- `certificate`: el certificado activo (titular, emisor, serie y vigencia) o `null`;
- `software_registrations`: los registros del software, con `has_software_pin` en lugar del PIN;
- `numbering_ranges`: los rangos, con `has_technical_key` en lugar de la clave.

### `PUT /api/v1/issuers/{nit}/certificate/update/`

Reemplaza el certificado activo. El certificado es del comercio (D7). Acepta una de dos formas:

```json
{"p12": "<base64 del .p12 o .pfx>", "password": "…"}
```

```json
{"certificate": "<base64 del .cer, .crt, .pem o .der, o del .zip de la entidad>",
 "private_key": "<base64 de la llave privada, PEM o DER>", "key_password": "<solo si la llave tiene contraseña>"}
```

Algunas entidades (p. ej. Thomas Signe) entregan el certificado y la llave por separado. En la segunda forma, Fiscal.
arma el `.p12` y le agrega la cadena hasta la raíz, que descarga de la dirección `caIssuers` del certificado (solo
`http`/`https` públicas, sin redirecciones, máximo 64 KB por certificado).

Responde titular, emisor, serie, vigencia y `chain_complete`: `false` si no pudo descargar algún intermedio o la raíz
(el certificado sirve igual, pero conviene revisarlo). Los archivos y las contraseñas quedan cifrados y no vuelven a
salir.

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

## Set de pruebas de la DIAN

En habilitación, la DIAN exige un set de documentos de prueba antes de dejar facturar al comercio. Fiscal. los arma,
firma y envía con los datos del emisor, sobre el rango de habilitación.

### `GET /api/v1/issuers/{nit}/test-set/`

```json
{"readiness": {"environment": true, "certificate": true, "software": true, "test_set_id": true, "range": true},
 "run": null}
```

`readiness` dice qué tiene el emisor para correr el set: ambiente de habilitación (`2`), certificado vigente,
software, `TestSetId` y rango vigente. `run` es la última corrida (forma abajo) o `null`.

### `POST /api/v1/issuers/{nit}/test-set/start/`

```json
{"invoices": 30, "credit_notes": 10, "debit_notes": 10}
```

Las cantidades son el «Total de documentos requeridos» de la página del set en el portal; si no se envían, van 30, 10
y 10. Cada una entre 0 y 50, al menos una factura, y las notas no pasan de 50 entre las dos (un ZIP, anexo §7.8).
Envía las facturas en un ZIP y responde `201` con la corrida en `processing`. Las notas se envían, cada una sobre una
factura aceptada, en una consulta posterior, cuando la DIAN acepta las facturas.

`409 test_set_not_ready` si al emisor le falta algo o si ya tiene una corrida en proceso (una corrida sin respuesta de
la DIAN deja de bloquear a las 24 horas).

### `POST /api/v1/issuers/{nit}/test-set/check/`

Consulta a la DIAN la última corrida y la devuelve. Si ya terminó, la devuelve sin consultar.

```json
{"id": 7, "state": "accepted", "error": "", "created_at": "…", "updated_at": "…",
 "documents": [{"kind": "invoice", "full_number": "SETP990000030", "code": "<CUFE>", "status": "accepted",
                "messages": [{"rule": "FAQ04a", "severity": "notificacion", "message": "…"}], "file_name": "…"}],
 "phases": [{"name": "invoices", "zip_key": "…", "errors": [], "dian_status": "…"}]}
```

| `state` | Qué significa |
|---|---|
| `processing` | La DIAN no ha terminado. Consultar de nuevo en unos minutos: en habilitación puede tardar más de una hora |
| `accepted` | Todos los documentos aceptados. El comercio ya puede marcar «Habilitado» en el portal |
| `rejected` | Algún documento rechazado; `messages` trae las reglas. Corregir y empezar otra corrida |
| `failed` | No se pudo enviar (`error` dice por qué) |

No hay aviso por webhook del set: el sistema cliente consulta, por ejemplo cada 5 minutos mientras esté en
`processing`.

## Paso a producción

Cuando la DIAN acepta el set, el comercio marca «Habilitado» en el portal (fija su fecha de inicio, irreversible; la
DIAN agrega la responsabilidad 52 al RUT) y pide su numeración en MUISCA. Después, el sistema cliente:

### `GET /api/v1/issuers/{nit}/production/`

```json
{"environment": "2",
 "readiness": {"test_set_accepted": true, "certificate": true, "software": false, "range": false, "gateway": true}}
```

`readiness`: set aceptado, certificado vigente, software de producción, un rango de producción vigente con su clave
técnica (no el `18760000001` de habilitación) y la conexión real con la DIAN en el servidor de Fiscal.

### `POST /api/v1/issuers/{nit}/production/copy-software/`

Registra el software de producción con el mismo SoftwareID y PIN de habilitación (la DIAN los conserva). Si el
comercio registró otro software para producción, se usa `PUT …/software/update/` con `"environment": "1"`.

### `POST /api/v1/issuers/{nit}/production/fetch-ranges/`

Trae de la DIAN (`GetNumberingRange`) los rangos que el comercio asoció al software, cada uno con su clave técnica, y
los guarda. `409 production_not_ready` si la DIAN no los entrega (p. ej. aún no los asoció en el portal).

### `POST /api/v1/issuers/{nit}/production/promote/`

```json
{"confirm": true}
```

Pasa el emisor a producción (`environment` `1`) si todo está listo, y desactiva el rango de habilitación. Desde ahí sus
documentos tienen efecto fiscal. `confirm` afirma que el comercio ya quedó «Habilitado» en el portal. Responden igual
que el `GET`; si el emisor ya estaba en producción, no cambia nada.

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
- **Factura de contingencia del emisor (tipo 03):** si el comercio expidió una factura de talonario o de papel porque
  su sistema o Fiscal. no estaban disponibles (anexo §12.1), la envía con `"issuer_contingency": true` en el documento
  comercial, el prefijo y el número del rango de **contingencia** y la fecha y hora reales de la factura de papel
  (puede tener más de 24 horas). Fiscal. la transcribe como tipo 03, con CUDE y referencia a la factura de papel, y la
  transmite. Debe enviarse dentro de las 48 horas siguientes a superar la falla. Las notas no tienen contingencia
  (`400 contingency_not_allowed`).
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
| `billing_reference` (notas) | `document_id` (id en Fiscal. de la factura que corrige), `concept_code` y `reason` (opcional). Conceptos de las tablas 13.2.4 y 13.2.5 del anexo. **Nota crédito:** 1 devolución parcial, 2 anulación, 3 rebaja o descuento, 4 ajuste de precio, 5 descuento por pronto pago, 6 descuento por volumen. **Nota débito:** 1 intereses, 2 gastos por cobrar, 3 cambio del valor, 4 otros. La DIAN exige como descripción la del concepto, así que `reason` no la reemplaza: va al XML como nota «Motivo: …» |
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

### `GET /api/v1/documents/{id}/artifacts/{kind}/`

Descarga el archivo más reciente de un tipo:
- `signed_xml`: XML firmado;
- `dian_response`: respuesta de la DIAN;
- `attached_document`: el contenedor firmado que se entrega al comprador, con el `ApplicationResponse` de la DIAN
  (o sin él, en una factura tipo 04);
- `pdf`: representación gráfica, con el QR de la DIAN en todas las páginas;
- `evidence`: evidencia de las fallas de la DIAN que llevaron a la contingencia.

`attached_document` y `pdf` se generan cuando la DIAN valida el documento y cuando una factura sale en contingencia
tipo 04. El aviso al sistema cliente ya los lista en `artifacts`. La entrega al comprador (correo o impresión) la hace
el sistema cliente.

La respuesta trae el contenido con su tipo y la cabecera `X-Fiscal-SHA256`. Antes de entregarlo, Fiscal. verifica que
el archivo coincide con la huella que registró al guardarlo. Los archivos se conservan 10 años.

## Transmisión

Al recibir un documento, Fiscal. lo encola y lo transmite: apenas llega, y además con un barrido cada minuto. Los
estados son:

| Estado | Qué significa |
|---|---|
| `queued` | En cola o esperando un reintento. Una nota también espera aquí a que su factura tenga CUFE |
| `transmitting` | Un trabajador la está enviando |
| `validated` | La DIAN la validó: trae `cufe`, `qr_url` y los artefactos `signed_xml` y `dian_response` |
| `rejected` | La DIAN la rechazó: `errors` trae las reglas incumplidas |
| `contingency_dian` | La DIAN no respondió tras los reintentos del anexo (§12.4): 3 a los 5 s ante un error del servicio y 5 cada 2 minutos ante una demora. Una **factura** se firma de nuevo como tipo 04, con el mismo número y CUFE (`invoice_type: "04"`, `cufe`, `qr_url`): **se puede entregar al comprador sin validación previa** (§12.2). Las notas no tienen contingencia: esperan. Fiscal. reintenta cada 30 minutos y, cuando la DIAN responde, transmite el tipo 04 y el documento pasa a `validated` o `rejected` |

El número y el CUFE de un documento nunca cambian entre reintentos, ni al pasar a tipo 04. `invoice_type` dice el tipo del
XML vigente (`01`, `03` o `04`; vacío en las notas) y `contingency_started_at`, desde cuándo está en contingencia.

Cada elemento de `errors` es `{"rule": "FAJ43b", "severity": "rechazo", "message": "…"}`, con la regla y el mensaje
tal como los da la DIAN. Un documento `validated` también puede traer elementos con `"severity": "notificacion"`: son
observaciones de la DIAN que no impiden la validación, pero conviene corregirlas en los siguientes documentos.

## Avisos al sistema cliente

Cada vez que un documento queda `validated`, `rejected` o entra en `contingency_dian`, Fiscal. hace `POST` al
`webhook_url` del sistema cliente:

```json
{"event": "document.state_changed", "document": { "…": "lo mismo que GET /api/v1/documents/{id}/, sin events" }}
```

Además, cuando algo exige acción del comercio, llega un aviso `issuer.alert`:

```json
{"event": "issuer.alert", "alert": {"kind": "certificate_expiring", "severity": "warning", "message": "…",
 "issuer": "900373115", "document": null, "created_at": "2026-10-05T08:00:00-05:00"}}
```

| `kind` | Cuándo |
|---|---|
| `certificate_expiring` | El certificado vence en 30, 15 o 7 días (crítica a los 7) |
| `range_low` | Al rango vigente le queda menos del 10 % de los números |
| `resolution_expiring` | La resolución de numeración vence en 30 días o menos |
| `contingency_deadline` | Una factura lleva 24 h (o 40 h, crítica) en contingencia sin transmitirse; el plazo es de 48 h |
| `rejection` | La DIAN rechazó un documento (`document` trae su id) |

Cada condición se avisa una vez. ProjectApp recibe además todas las alertas por correo, también la de cola detenida.

- **Firma:** las mismas tres cabeceras `X-Fiscal-*`, con el secreto vigente del cliente. El texto canónico usa la ruta y
  la consulta del `webhook_url`. **El sistema cliente debe verificar la firma y la hora antes de creer el aviso**, y
  aceptar esa ruta solo desde la red de Fiscal.

  Verificación en Python (Django):

  ```python
  import hashlib, hmac, time

  def fiscal_notice_is_genuine(request, secret):
      ts = request.headers.get('X-Fiscal-Timestamp', '')
      if not ts.isdigit() or abs(time.time() - int(ts)) > 300:
          return False
      canonical = '\n'.join([ts, 'POST', request.get_full_path(), hashlib.sha256(request.body).hexdigest()])
      expected = hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()
      return hmac.compare_digest(expected, request.headers.get('X-Fiscal-Signature', ''))
  ```

  En JavaScript (Express, con el cuerpo crudo: `express.raw({ type: 'application/json' })`):

  ```javascript
  import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

  export function fiscalNoticeIsGenuine(req, secret) {
    const ts = req.get('X-Fiscal-Timestamp') ?? ''
    if (!/^\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
    const bodyHash = createHash('sha256').update(req.body).digest('hex')
    const canonical = [ts, 'POST', req.originalUrl, bodyHash].join('\n')
    const expected = Buffer.from(createHmac('sha256', secret).update(canonical).digest('hex'))
    const received = Buffer.from(req.get('X-Fiscal-Signature') ?? '')
    return expected.length === received.length && timingSafeEqual(expected, received)
  }
  ```

  La ruta que se firma es la del `webhook_url` registrado: si un proxy le cambia la ruta al aviso, verifica con la
  ruta registrada y no con la que ve la aplicación. Al rotar el secreto, Fiscal. firma los avisos con el **nuevo**
  desde ese momento: durante el periodo de gracia, el sistema cliente debe aceptar la firma con cualquiera de los dos.
- **Reintentos:** un `2xx` lo da por entregado. Si no, se reintenta a los 30 s, 1 min, 5 min, 15 min y luego cada hora,
  hasta 30 intentos.
- **Respaldo:** el sistema cliente también puede consultar `GET /api/v1/documents/{id}/` de sus pendientes, por si un
  aviso se pierde.
