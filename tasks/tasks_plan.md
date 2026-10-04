# Tasks Plan — Fiscal.

> Memory Bank · actualizado 2026-10-04. **Plan interno de ejecución técnica**, previo al plan de implementación
> detallado de cada fase. Base: `docs/methodology/product_requirement_docs.md`, `architecture.md`, `technical.md` y el
> inventario en `docs/fiscal/inventario/`.

## Estado por capacidad

| Capacidad | Estado | Fase |
|---|---|---|
| Inventario (DIAN, Waiter, operación, negocio y legal) | ✅ hecho 2026-10-04 | — |
| Decisiones D1 a D7 | ✅ tomadas 2026-10-04 | — |
| Plantilla adaptada a Fiscal. (nombres, marca, MySQL, limpieza de features demo) | ⏳ pendiente | F1 |
| Núcleo: sistemas cliente, emisores, certificados, rangos, documentos, cola | ⏳ pendiente | F1 |
| Librería `dian/`: UBL, CUFE/CUDE, XAdES, SOAP | ⏳ pendiente | F2 |
| Habilitación de ProjectApp (set de pruebas) | ⏳ pendiente | F3 |
| Notas, contingencias 04 y 03, entrega (AttachedDocument y PDF) | ⏳ pendiente | F4 |
| Consola de operación (Next.js) | ⏳ pendiente | F5 |
| Waiter conectado (plan en su repositorio) | ⏳ pendiente | F6 |
| Piloto con un restaurante | ⏳ pendiente | F7 |

## Fases

Cada fase se ejecuta con su propio plan de implementación, en su rama y su PR (protocolo de la plantilla).

### F0 · Prerrequisitos (dueño y entorno)

- [ ] **ProjectApp (D3):**
  - certificado digital de persona natural vigente (lo paga ProjectApp como facturador de pruebas);
  - acceso a su portal de facturación de la DIAN;
  - registrar Fiscal. como software «propio o adquirido» en habilitación y anotar el identificador del software, el
    PIN y el `TestSetId`.
- [ ] Confirmar con el contador que agregar un software en habilitación no afecta la facturación que ProjectApp hace
  hoy.
- [ ] Python 3.14.7 en el equipo (uv o pyenv) y rueda de `mysqlclient` 2.2.8 para 3.14, compilada en Docker.
- [ ] Contenedores locales: `fiscal-mysql` (3308, ya existe) y Redis.
- [ ] Descargar la caja de herramientas de la DIAN (`FE_V19_(v2026)`): XSD, ejemplos firmados, tablas y política de
  firma. Guardarla en `backend/.../dian/resources/` con su versión.

### F1 · Plantilla adaptada y núcleo (sin DIAN real)

- [ ] **Renombre** del proyecto y de la app de la plantilla (`base_feature_project` y `base_feature_app` a nombres de
  Fiscal.), `api/health/` con `project=fiscal`, identidad en `CLAUDE.md` y README.
- [ ] **Retirar las features demo** (blog, productos, ventas, carrito, captcha). Conservar autenticación JWT de
  operadores, usuarios, staging banner si aplica y el CI.
- [ ] Settings con MySQL (`fiscal-mysql`), `FISCAL_ENCRYPTION_KEY`, `DIAN_GATEWAY` y zona horaria de negocio
  `America/Bogota`.
- [ ] **Modelos:** `ClientSystem` y `ClientSecret` (dos vigentes para rotar), `Issuer`, `Certificate`,
  `SoftwareRegistration`, `NumberingRange` (normal y contingencia, clave técnica cifrada), `Document`,
  `DocumentEvent`, `Artifact` y `WebhookDelivery`.
- [ ] **Autenticación HMAC** para sistemas cliente. JWT de la plantilla para operadores.
- [ ] **Contrato v1** (`docs/fiscal/contrato.md`, rehecho desde el borrador): emisores, certificados, rangos y
  documentos.
  - Forma exacta del documento comercial, sacada del inventario: requisitos mínimos (sección 1.3 de los requisitos de
    la DIAN) y datos que faltan en Waiter (sección 2 del inventario de Waiter).
- [ ] **Validación previa** con mensajes en español: cuadres, catálogos DIAN, consumidor final, propina, líneas sin
  valores negativos, dirección de entrega en domicilios y número dentro del rango vigente.
- [ ] **Cola:** Huey periódico sobre la base (`select_for_update(skip_locked)`), con reintentos y rescate de los que
  quedan a medias. `DianGateway` simulado.
- [ ] **Avisos firmados** al sistema cliente, con reintentos.
- [ ] **Almacén de artefactos** con hash, sin borrado antes de 10 años.
- [ ] Reutilizable del prototipo (`fiscal_project_borrador`, rama `prototipo/z1-base`): firma HMAC, cifrado Fernet,
  validación del `.p12`, dígito de verificación del NIT, idempotencia y sus 27 pruebas. Hay que portarlo a las
  convenciones de la plantilla (inglés, FBV y serializers).

### F2 · Librería `dian/` (sin red primero)

- [ ] Catálogos DIAN (impuestos, tipos de documento, medios de pago, unidades, responsabilidades, municipios DANE)
  desde la caja de herramientas.
- [ ] UBL 2.1 de la factura, la nota crédito y la nota débito. Validación contra los XSD.
- [ ] CUFE y CUDE con los ejemplos del anexo como pruebas.
- [ ] XAdES-EPES con la política v2. Verificación propia y prueba de manipulación.
- [ ] Cliente SOAP: `SendBillSync`, `SendTestSetAsync`, `GetStatus`, `GetStatusZip` y `GetNumberingRange`, con TLS
  mutuo y WS-Security.
- [ ] Intérprete del `ApplicationResponse`, con las reglas en español para los rechazos frecuentes.
- [ ] **Corte de riesgo:** si en dos semanas de F2 no hay una factura aceptada en habilitación, se reevalúa antes de
  seguir.

### F3 · Habilitación de ProjectApp

- [ ] Correr el set de pruebas con el certificado y el `TestSetId` de ProjectApp hasta quedar aceptado.
- [ ] `GetNumberingRange` con datos reales.
- [ ] Resolver los puntos «sin confirmar» del inventario: direcciones de los servicios y tamaño del set de pruebas.
- [ ] Documentar el paso a paso para que cada restaurante repita la habilitación (base del asistente de Waiter).

### F4 · Contingencias y entrega

- [ ] Contingencia DIAN (04), con la máquina de estados del anexo, sondeo cada 30 min, transmisión dentro de las
  48 h y avisos a las 24 h y 40 h.
- [ ] Contingencia del emisor (03) para las facturas de papel o del modo de emergencia de Waiter, y para Fiscal.
  caído (D5). Borrador de la carta a la DIAN.
- [ ] `AttachedDocument` firmado.
- [ ] Representación gráfica en PDF, con el QR en todas las páginas y solo con datos del XML.
- [ ] Alertas: certificado (30, 15 y 7 días), rango por debajo del 10 %, resolución por vencer, rechazos.
- [ ] Disponibilidad: `api/health/` con la salud de la DIAN, de la cola y de los trabajadores.

### F5 · Consola de operación

- [ ] Tablero, emisores, documento, contingencias y sistemas cliente (ver `architecture.md`), con E2E en Playwright y
  el gateway simulado.

### F6 · Waiter se conecta (plan en `waiter_project`)

- [ ] Adaptador `billing/providers/fiscal.py`.
- [ ] Emitir al cobrar, fuera del bloqueo de la organización y con clave estable.
- [ ] Datos y catálogos DIAN: impuestos con código, comprador, emisor y sede.
- [ ] Canje de puntos como descuento.
- [ ] Nota crédito tardía y reemisión de rechazados.
- [ ] Ruta de avisos firmada.
- [ ] Recibo con número, CUFE y QR.
- [ ] Modo de emergencia con factura de contingencia y rango de contingencia (D5).
- [ ] Detección de Fiscal. caído.
- [ ] Medición del plan W.
- [ ] Asistente de habilitación en la consola del dueño.

### F7 · Piloto

- [ ] Un restaurante real: habilitación con su NIT, su certificado y la licencia de uso firmada. Una semana en
  producción, con su contador revisando lo emitido.
- [ ] Actualizar el documento 233 con los costos y tiempos reales.

### Después

- Documento equivalente POS.
- Documento soporte.
- Eventos RADIAN.
- API abierta a otras casas de software: revisar antes la postura de D1.
- Servidor propio y despliegue.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Modalidad legal en zona gris (D1) | Licencia por comercio, certificado del comercio, aislamiento, revisión antes de abrir la API a terceros |
| La firma XAdES o el SOAP no se logran a tiempo | F2 empieza por lo difícil, con un corte a las dos semanas |
| Contingencia del emisor mal manejada (multas del ET 651 y 652) | Avisos de 48 h, evidencia guardada, pruebas con reloj congelado |
| Pérdida de la clave Fernet | Respaldo de la clave fuera del servidor y separado de los respaldos de la base |
| Una sola persona conoce Fiscal. | Memory Bank al día y una segunda persona antes de 20 comercios |

## Known issues

1. La plantilla trae features demo (blog, productos, ventas) y nombres `base_feature_*` que hay que retirar o
   renombrar en F1.
2. Python 3.14.7 no está instalado en el equipo de desarrollo.
3. El contrato es un borrador anterior al inventario (`docs/fiscal/contrato-borrador.md`).
