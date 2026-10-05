# Plan de implementación F1 · Núcleo de Fiscal. (sin DIAN real)

> 2026-10-04. Fase F1 de `tasks/tasks_plan.md`. Base: `docs/methodology/` (PRD, arquitectura y técnica) y el
> inventario `docs/fiscal/inventario/`. **No necesita el certificado de ProjectApp**: todo corre contra el gateway
> simulado.

## Objetivo

Al terminar F1, un sistema cliente (Waiter, o la prueba que lo simula) puede:

1. autenticarse con firma HMAC;
2. registrar un emisor por NIT, con sus datos fiscales, su certificado `.p12` y sus rangos de numeración;
3. enviar un documento comercial y recibir `202` en cola, con validación previa en español;
4. ver el documento pasar por la cola (gateway simulado) a `validated` o `rejected`;
5. recibir un aviso firmado con el cambio de estado;
6. consultar el documento y sus artefactos.

El operador de ProjectApp entra a la consola con JWT y ve un tablero mínimo.

## Fuera de F1

- UBL real, CUFE real, firma XAdES y SOAP: son F2.
- Contingencias 04 y 03 completas, `AttachedDocument` y PDF: F4.
- Consola completa: F5.
- Cambios en Waiter: F6.

## Prerrequisitos (F0 técnico)

- [ ] Python 3.14.7 (`uv python install 3.14.7` o pyenv) y venv en `backend/venv`.
- [ ] Rueda de `mysqlclient` 2.2.8 para cp314, compilada en Docker (como la de Waiter en `~/.cache/waiter-wheels/`).
- [ ] Contenedores locales:
  - `fiscal-mysql` (mysql:8.4, 127.0.0.1:3308; ya existe, con los permisos sobre `test_fiscal%`);
  - `fiscal-redis` (redis:7, 127.0.0.1:6380, porque 6379 puede estar ocupado).
- [ ] Node 24 y `npm ci` en `frontend/`.

## Estructura objetivo (estándar de la plantilla)

```
backend/
├── fiscal_project/            # antes base_feature_project: settings (base/dev/prod), urls, wsgi, asgi, tasks
├── fiscal_app/                # antes base_feature_app: la app de dominio
│   ├── models/                # un archivo por modelo
│   ├── serializers/           # *_list, *_detail, *_create_update
│   ├── views/                 # FBV @api_view, una por módulo
│   ├── urls/                  # paquete: health, auth, issuers, certificates, ranges, documents, console
│   ├── services/              # emission, numbering, validation, webhooks, artifacts, crypto, signing
│   ├── authentication/        # HMAC (sistemas cliente) junto al JWT de la plantilla (operadores)
│   ├── management/commands/   # create_client_system, rotate_client_secret, create_fake_data, delete_fake_data
│   ├── tests/                 # models, serializers, services, views, commands
│   └── admin.py               # AdminSite propio, sin exponer secretos
└── dian/                      # paquete Python puro, sin modelos; en F1 solo gateway.py (interfaz) y simulated.py
```

Endpoints: `/api/<entidad>/…` según la convención de la plantilla. Las rutas de máquina usan HMAC; las de consola
(`/api/console/…`) usan JWT.

## Trabajo dividido en PRs

Cada PR sale de `master`, en su rama, con CI verde (pytest, Jest, Playwright, quality gate y coverage). Se integra en
orden.

### PR 1 · Adaptar la plantilla (`chore/…-fiscal-bootstrap`) — ✅ PR #2

- [x] **Renombrar** `base_feature_project` a `fiscal_project` y `base_feature_app` a `fiscal_app`: módulos, settings,
  `AUTH_USER_MODEL`, pytest.ini, CI, scripts y `manage.py`. Migraciones nuevas desde cero (no hay datos que conservar).
- [x] **Retirar las demos:**
  - backend: blog, producto, venta, captcha, galería (`django_attachments`, `easy_thumbnails`, `django-cleanup`) con
    sus modelos, vistas, serializers, URLs, forms, comandos y pruebas;
  - frontend: catálogo, productos, blogs, checkout y carrito, con sus stores, componentes, e2e y flujos de
    `flow-definitions.json`.
- [x] **Conservar:** usuario personalizado (operadores), JWT, reseteo de contraseña, staging banner, i18n (ES por
  omisión), CI, quality gate y `api/health/`.
- [x] **Settings:**
  - MySQL por omisión en dev, apuntando a `fiscal-mysql`;
  - `FISCAL_ENCRYPTION_KEY` (Fernet; falla al arrancar si falta);
  - `DIAN_GATEWAY=simulated`;
  - `BUSINESS_TIME_ZONE=America/Bogota`;
  - Huey contra `fiscal-redis`;
  - CORS solo para la consola.
- [x] **Pruebas:** SQLite para las rápidas y marcador `mysql` para concurrencia, con `DJANGO_TEST_DB_ENGINE` en CI.
  Documentarlo en `technical.md`.
- [x] **Marca:**
  - identidad en `CLAUDE.md` (bloque project-specific) y regenerar `AGENTS.md`;
  - README de Fiscal.;
  - fuente Ubuntu Bold para el logotipo «Fiscal.» en el frontend;
  - `api/health/` responde `project=fiscal_project`.
- **Fails if** (pruebas): `api/health/` no responde `project` y `environment`; el arranque no falla sin
  `FISCAL_ENCRYPTION_KEY`; queda alguna ruta de las demos.

### PR 2 · Modelos, cifrado y administración (`feat/…-core-models`) — ✅ hecho

Las opciones guardan los códigos de la DIAN tal cual (`TipoAmbiente`, `TipoOrganizacion` de la caja de herramientas FE 1.9). `ExactCharField` aplica `utf8mb4_bin` solo en MySQL. La retención de artefactos la cuida una señal `pre_delete`, que también se dispara en los borrados masivos. El CI tiene un job `backend-mysql-tests` para las pruebas marcadas `mysql`.

| Modelo | Campos clave | Reglas |
|---|---|---|
| `ClientSystem` | name, key_id (utf8mb4_bin, único), webhook_url, active, created_at | |
| `ClientSecret` | client, secret (cifrado), created_at, expires_at | Hasta dos vigentes, para rotar sin cortar |
| `Issuer` | client, nit, dv, person_type, legal_name, trade_name, tax_regime, tax_responsibilities (códigos DIAN), address, municipality_dane_code, department_code, postal_code, email, environment (`testing` o `production`) | Único por (client, nit); DV validado con el algoritmo de la DIAN |
| `SoftwareRegistration` | issuer, environment, software_id, software_pin (cifrado), test_set_id, manufacturer_nit, manufacturer_name, software_name | Fabricante = ProjectApp por omisión (D1) |
| `Certificate` | issuer, p12 (cifrado), password (cifrada), subject, serial, not_before, not_after, active | Uno activo; se valida al cargar; nunca sale |
| `NumberingRange` | issuer, kind (`invoice` o `contingency`), prefix (hasta 4), number_from, number_to, resolution_number, valid_from, valid_to, technical_key (cifrada), establishment | Prefijo por local |
| `Document` | client, issuer, range, idempotency_key (bin), kind (`invoice`, `credit_note`, `debit_note`), prefix, number, issue_datetime, payload (JSON), payload_hash, state, cufe, qr_url, errors (JSON), attempts, next_attempt_at, references (original) | Únicos por (client, idempotency_key) y por (issuer, prefix, number); inmutable una vez construido |
| `DocumentEvent` | document, state, detail (JSON), at | Historia |
| `Artifact` | document, kind (`signed_xml`, `dian_response`, `attached_document`, `pdf`, `evidence`), sha256, size, storage_path, created_at, retain_until | Sin borrado antes de `retain_until` (10 años) |
| `WebhookDelivery` | client, document, payload, attempts, next_attempt_at, delivered_at, last_status | |

- [x] `services/crypto.py`: `EncryptedTextField` con Fernet. Errores sin contenido.
- [x] Admin propio: listas y filtros sin mostrar campos cifrados; solo lectura sobre documentos y artefactos.
- [x] Comandos:
  - `create_client_system` (muestra el secreto una vez);
  - `rotate_client_secret`;
  - `create_fake_data` y `delete_fake_data` (emisor de prueba con certificado autofirmado, rangos y documentos en
    cada estado), que exige la plantilla para E2E.
- **Fails if:**
  - un secreto, certificado, contraseña, PIN o clave técnica queda legible en la base;
  - se aceptan dos certificados activos;
  - un DV equivocado pasa;
  - un artefacto se puede borrar antes de `retain_until`;
  - la unicidad de número o de clave no se cumple en MySQL.

### PR 3 · Autenticación de sistemas cliente y emisores (`feat/…-client-api`) — ✅ hecho

La API de máquina quedó bajo `/api/v1/`: así va versionada y se distingue de la consola. Las rutas son las de la tabla con ese prefijo, y el contrato está en `docs/fiscal/contrato.md`. Los errores tienen forma estable solo bajo `/api/v1/`; el resto conserva la forma de la plantilla.

- [x] `authentication/hmac.py`:
  - cabeceras `X-Fiscal-Key`, `X-Fiscal-Timestamp` y `X-Fiscal-Signature`;
  - texto canónico: timestamp, método, ruta con consulta y SHA-256 del cuerpo;
  - ventana de 5 min;
  - comparación en tiempo constante;
  - acepta cualquiera de los secretos vigentes.
- [x] Endpoints (HMAC):

| Acción | Método y ruta |
|---|---|
| Crear o actualizar emisor | `PUT /api/issuers/{nit}/update/` |
| Detalle de emisor | `GET /api/issuers/{nit}/` |
| Cargar certificado | `PUT /api/issuers/{nit}/certificate/update/` |
| Registro del software | `PUT /api/issuers/{nit}/software/update/` |
| Crear rango | `POST /api/issuers/{nit}/ranges/create/` |
| Listar rangos | `GET /api/issuers/{nit}/ranges/` |

- [x] Errores con forma estable `{"error": {"code", "message"}}`, mensaje en español, en un exception handler de DRF.
- **Fails if:**
  - la petición viene sin firma, vieja, con el cuerpo cambiado, con un secreto equivocado o retirado, o de un cliente
    inactivo;
  - un cliente ve el emisor de otro;
  - el PIN, el certificado o la clave técnica aparecen en una respuesta;
  - se acepta un certificado vencido o que no abre.
- Se porta del prototipo (`fiscal_project_borrador`, rama `prototipo/z1-base`): firma, cifrado, DV, validación del
  `.p12` y sus pruebas, adaptados a FBV y serializers.

### PR 4 · Contrato del documento y validación previa (`feat/…-document-contract`) — ✅ hecho

Los catálogos salen de las listas genericode oficiales de la caja de herramientas FE 1.9 v2026, copiadas en `backend/dian/resources/genericode/`. Las reglas siguen el anexo FE 1.9: totales FAU02 a FAU14, líneas FAV04b, FAV05 y FAV06, impuestos FAS07, pago FAN y adquirente FAK; el redondeo es half-to-even y la tolerancia de ±2,00 / IVA ±5,00 (§5.2.1). Las rutas finales son `/api/v1/documents/create/` y `/api/v1/documents/{id}/`. La descarga de artefactos pasa al PR 5, con el almacén.

- [x] `docs/fiscal/contrato.md` v1, reemplazando el borrador. Forma del documento comercial:

| Bloque | Campos |
|---|---|
| Encabezado | `idempotency_key`, `issuer` (NIT), `kind`, `prefix`, `number`, `issue_datetime` (con zona), `currency` (COP), `operation_type` |
| Comprador | `id_type` (código DIAN; 13 cédula, 31 NIT…), `id_number`, `dv`, `person_type`, `name`, `email`, `address`, `municipality_dane_code`, `tax_responsibilities`; o `final_consumer: true` (222222222222, tipo 13) |
| Entrega | `delivery_address` (obligatoria si es domicilio con consumidor final o cédula) |
| Líneas | `code`, `description`, `quantity`, `unit_code` (catálogo DIAN), `unit_price`, `allowances[]` (descuentos), `taxes[]` (`code` 01/04, `rate`, `base`, `amount`), `line_total`; **ningún valor negativo** |
| Cargos y descuentos globales | `charges[]` (la propina va como cargo, `reason`, sin impuestos), `allowances[]` (canje de puntos y descuentos) |
| Totales | `line_extension`, `tax_exclusive`, `tax_inclusive`, `allowance_total`, `charge_total`, `payable` |
| Pago | `payment_form` (contado o crédito, con vencimiento), `payment_means[]` (catálogo DIAN) |
| Referencias (notas) | `original` (id del documento en Fiscal. o prefijo, número, CUFE y fecha), `concept_code` (por ejemplo 2 = anulación) |
| Contingencia del emisor | `issuer_contingency: true`, rango de contingencia y número del papel (se usa en F4) |

- [x] `POST /api/documents/create/` (HMAC): `202` si es nuevo; `200` si es el mismo cuerpo con la misma clave;
  `409 idempotency_conflict` si es la misma clave con otro contenido; `409 duplicate_number` si el número se repite.
- [x] `GET /api/documents/{id}/` y `GET /api/documents/{id}/artifacts/{kind}/` (HMAC, solo los del cliente).
- [x] `services/validation.py`: cuadres de líneas, impuestos y totales con tolerancia de la DIAN; propina fuera de la
  base y como máximo el 10 %; códigos en catálogo; número dentro del rango vigente para la fecha; consumidor final;
  dirección de entrega; nota con original válido. Cada falla devuelve un `code` y un mensaje en español.
- **Fails if:**
  - un reenvío crea otro documento;
  - una clave sirve para otro contenido;
  - entra un número fuera del rango o vencido;
  - pasa una línea negativa;
  - la propina entra en la base;
  - falta la dirección en un domicilio con consumidor final;
  - una nota no referencia su original.

### PR 5 · Cola, gateway simulado y avisos (`feat/…-transmission-queue`) — ✅ hecho

Los reintentos siguen el anexo §12.4: 5 s × 3 ante un error del servicio y 2 min × 5 ante una demora; después, `contingency_dian` con sondeo cada 30 min. Los documentos en contingencia se reservan para un trabajador sin cambiar de estado, y un contador `transient_failures` cuenta los fallos. El almacén vive fuera de `MEDIA_ROOT` (`FISCAL_ARTIFACTS_DIR`) y se descarga por `/api/v1/documents/{id}/artifacts/{kind}/`. Huey corre en modo inmediato fuera de producción (`HUEY_IMMEDIATE`), y el comando `transmit_pending` sirve en desarrollo. `skip_locked` está probado con dos trabajadores en MySQL.

- [x] `dian/gateway.py`: interfaz `DianGateway.send(document) -> GatewayResult` y `status(document)`, más la
  excepción `DianUnavailable`. `dian/simulated.py`: acepta en `testing`; **se niega en `production`** (el documento
  queda en cola); rechaza con reglas reproducibles para las pruebas.
- [x] `services/emission.py`: máquina de estados `queued` → `transmitting` → `validated` o `rejected`. El número y el
  código no cambian en los reintentos. Rescate de lo que quedó `transmitting` más de 10 min.
- [x] Huey: `transmit_pending` (periódica cada 5 s, más un disparo inmediato al crear),
  `select_for_update(skip_locked)` y espera creciente.
- [x] `services/webhooks.py`: `POST` al `webhook_url` con el cuerpo del documento, firmado con el mismo esquema
  HMAC; reintentos con espera creciente; `deliver_webhooks` en Huey.
- [x] `services/artifacts.py`: guarda bytes con hash y `retain_until` en `MEDIA_ROOT/fiscal/<nit>/<año>/…` (almacén
  local en F1; S3 compatible después).
- **Fails if:**
  - el gateway simulado acepta un emisor en producción;
  - una caída pierde el documento o cambia su número;
  - un documento queda `transmitting` para siempre;
  - dos trabajadores toman el mismo documento (MySQL);
  - un aviso sale sin firma o no se reintenta;
  - un artefacto no coincide con su hash.

### PR 6 · Consola mínima (`feat/…-console-skeleton`) — ✅ hecho

La API de consola (JWT, solo operadores activos) está en `/api/console/summary/`, `/api/console/documents/` (filtros `state` e `issuer`, 25 por página) y `/api/console/documents/{id}/`. Una firma HMAC de un sistema cliente no la abre. El frontend tiene el tablero con contadores, la lista con filtros y paginación, y el detalle con errores, artefactos y eventos; son 6 flujos E2E nuevos. Las pruebas usan un hasher de contraseñas rápido.

- [x] Backend (JWT, solo operadores): `GET /api/console/summary/` (documentos por estado y por emisor, último
  error, salud de la cola) y `GET /api/console/documents/` (lista con filtros).
- [x] Frontend:
  - inicio de sesión de la plantilla con la marca Fiscal.;
  - tablero con los contadores;
  - lista de documentos;
  - detalle con eventos.

  La consola completa es F5.
- [x] E2E en Playwright con `create_fake_data`, flujos registrados en `flow-definitions.json`.
- **Fails if:** la consola es accesible sin sesión de operador; un sistema cliente con HMAC entra a `/api/console/`; el
  tablero no refleja los estados de la fake data.

## Definición de hecho de F1

- [ ] Los seis PRs integrados con CI verde y el quality gate sin hallazgos nuevos.
- [ ] Un recorrido de punta a punta, con un script de prueba que hace de Waiter: crear emisor → cargar certificado
  autofirmado → crear rango → enviar documento → recibir el aviso `validated` → bajar el artefacto. Lo mismo con un
  documento rechazado y con un reenvío idempotente.
- [ ] `tasks/tasks_plan.md`, `tasks/active_context.md` y `architecture.md` actualizados con lo real.
- [ ] Contrato v1 publicado en `docs/fiscal/contrato.md`, listo para que Waiter lo implemente en F6.

## Riesgos de F1

| Riesgo | Mitigación |
|---|---|
| Renombrar la plantilla rompe el CI o los scripts del quality gate | PR 1 aislado, sin funcionalidad nueva; se integra solo con todo verde |
| SQLite oculta problemas de concurrencia | Pruebas de concurrencia marcadas `mysql` en CI |
| El contrato cambia en F2 al armar el UBL real | El contrato sale de los requisitos mínimos de la DIAN (inventario 1.3); los ajustes de F2 se versionan |
