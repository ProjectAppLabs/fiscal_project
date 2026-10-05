# Lo que Waiter ya tiene en facturación y lo que tiene que cambiar

Inventario del 4 de octubre de 2026, leyendo el código de `waiter_project` (rama `chore/04102026-skills-calidad`). Las
rutas son relativas a ese repositorio. Todo el backend fiscal está en `experience/billing/` (unas 1.900 líneas). El
único proveedor que existe es el simulado: no firma ni transmite nada.

## 1. Qué existe y funciona

### Modelos (`experience/billing/models.py`)

- **`Resolution`** (`:9-34`): numeración por organización.
  - Campos: `kind` (`invoice` o `pos`), prefijo único por organización, rango, `next_number`, vigencia, `technical_key`
    y `active`.
  - Cada organización nueva recibe una resolución de prueba `SETP` 990000000–995000000 con clave `SIMULADO`
    (`signals.py:11-27`).
- **`BillingSettings`** (`:37-41`): etiqueta de la propina, envío por correo y tipo por omisión (`pos`).
- **`SalesDocument`** (`:44-90`): documento de venta.
  - Copias congeladas del emisor, el comprador, la resolución, las líneas y los impuestos.
  - Importes y estado (`pending`, `issued`, `rejected` o `contingency`).
  - Respuesta del proveedor: id, CUFE, QR, XML, errores e intentos.
  - Clave de idempotencia y enlace a la devolución y al original (para la nota crédito).
  - **Un solo documento de venta por pedido** (`:78,84`).

### Servicios (`experience/billing/services.py`)

- **`provider()`** (`:40-41`): devuelve siempre el simulado. Es el único punto donde se elige proveedor.
- **`resolution_for`** (`:48-60`): resolución activa y vigente en la zona horaria de la organización, con bloqueo.
- **`buyer_for`** (`:63-66`): el cliente indicado o el «Consumidor final» (`222222222222`).
- **`snapshot_lines`** (`:69-98`): líneas con base, impuesto y detalle por impuesto; el último impuesto absorbe el
  redondeo.
- **`review`** (`:101-158`): valida sin escribir.
  - Pedido pagado y comprador completo.
  - Resolución vigente y emisor completo.
  - Cuadres de líneas, impuestos y pagos, con la propina fuera de la base.
- **`emit`** (`:223-275`):
  - Bloquea la organización y el pedido.
  - Es idempotente por pedido y por clave.
  - Toma el consecutivo.
  - Crea el documento con `issued_at = ahora` y **transmite dentro de la misma transacción**.
- **`transmit`** (`:161-196`):
  - Llama al proveedor.
  - Los errores de red (`ConnectionError`, `TimeoutError`, `OSError`) llevan a `contingency`.
  - Si queda emitido, registra el consumo del módulo `facturacion` y envía el XML por correo después del commit (sin
    PDF).
- **`retry`** (`:278-289`): reintenta `contingency` o `pending` con el mismo número; un rechazado da 409.
- **`credit_note`** (`:292-387`):
  - Numera `NC-<n>` con `max()+1` bajo el bloqueo de organización.
  - Prorratea contra el original.
  - Agrega una línea negativa por el reintegro del canje de puntos.

### Proveedor simulado (`providers/simulated.py`)

- Deduce el código DIAN del impuesto **por el nombre**: «INC» → 04, «ICA» → 03, cualquier otro → 01.
- Arma la cadena del CUFE con ambiente fijo «2».
- Produce un UBL mínimo (`ProfileID=SIMULADO`).
- Rechaza a los compradores con NIT terminado en `000`.

### API (`experience/billing/api.py`, solo el dueño)

- Pedidos por facturar, revisión y emisión.
- Documentos: lista, detalle, «PDF» (en realidad HTML imprimible marcado SIMULADO) y reintento.
- Ajustes, resoluciones y empresa (`company.py`).

### Devoluciones (`experience/sales/refunds.py`, plan U1)

- `create_refund` llama a `credit_note` solo si el original quedó **emitido** (`:112-113, 259`).

### POS

- **Consola del dueño** (`components/business/BillingView.tsx`): pestañas «por facturar» y «documentos».
- **Panel de emisión** (`components/billing/InvoicePanel.tsx`): elige el comprador y emite.
- **Recibo de caja** (`components/pay/Receipt.tsx`): comprobante de pago; **no** muestra número fiscal, CUFE/CUDE ni
  resolución.

### Pruebas (`experience/billing/tests/`)

- Concurrencia del consecutivo, idempotencia, revisión, rechazo, contingencia, IVA frente a INC, agotamiento del
  rango, correo, vector de CUFE, redondeo, permisos, módulos y consumo.
- **Todas usan el simulado.**

## 2. Datos que faltan para un documento DIAN real

- **Emisor** (`tenancy/models.py`, `company.py`):
  - tipo de persona;
  - municipio y departamento con código DANE, código postal y país;
  - responsabilidades fiscales con el catálogo DIAN (hoy texto libre);
  - régimen y tributo con código DIAN;
  - nombre comercial;
  - ambiente (hoy fijo).
- **Sede y caja** (`Restaurant`, `tenancy/models.py:96-117`): solo tiene calle, ciudad y teléfono. Para el
  documento equivalente POS faltan el código de establecimiento, la dirección fiscal, la caja (placa, ubicación y tipo)
  y el cajero. Turno y quién cobró existen en el pedido, pero no se copian al documento.
- **Comprador** (`loyalty/models.py:15-38`):
  - el tipo de documento usa códigos propios (`CC`, `NIT`…), no los de la DIAN (13, 31…);
  - faltan DV, tipo de persona, régimen, responsabilidades y municipio;
  - el documento no se valida;
  - el consumidor final se siembra como `CC` (la DIAN pide tipo 13).
- **Impuestos** (`catalog/models.py:32-39`): sin código DIAN. Clasificar por el nombre falla: un «Impoconsumo» saldría
  como IVA.
- **Pagos:** la forma y el medio de pago no se copian al documento.
- **Líneas:**
  - faltan la unidad de medida y el código estándar;
  - el **canje de puntos entra como línea negativa**, que la DIAN no acepta: debe ser un descuento.
- **Domicilios:** con consumidor final o cédula, la DIAN exige la dirección de entrega; no se copia.
- **Salidas:** no hay dónde guardar el XML firmado, la respuesta de la DIAN, el `AttachedDocument`, el PDF ni la fecha
  de validación.

## 3. Riesgos y huecos

1. **El proveedor se llama dentro de una transacción que bloquea toda la organización** (`services.py:228,275`;
   `refunds.py:178,259`). Con un servicio HTTP de por medio, cada emisión congela cobros, pedidos y devoluciones de
   todas las sedes.
2. **Un número puede quedar emitido fuera y revertido dentro.** Si Fiscal. acepta y luego algo falla antes del commit,
   Waiter revierte el consecutivo y lo reutiliza con otro contenido. Las excepciones que no son de red revierten todo
   y el usuario reintenta con otra clave.
3. **Si la respuesta se pierde, el reintento es correcto solo si Fiscal. es idempotente.** Waiter no envía hoy una
   clave estable de antemano: el id del proveedor llega después.
4. **Un documento rechazado no tiene salida.**
   - No se puede reintentar ni volver a emitir para el pedido.
   - No se puede corregir el comprador, anular ni sustituir.
   - Tampoco se puede cambiar un POS por una factura, ni dividir la cuenta.
5. **La emisión es manual, solo del dueño y posterior al cobro.**
   - `issued_at` es la hora de emitir, no la de pago.
   - El documento equivalente debe entregarse en el momento de la venta, y la propia pantalla lo reconoce
     (`pos/lib/i18n/messages/modules/admin.json:271-277`).
   - El panel nunca envía el tipo, así que siempre sale el tipo por omisión.
6. **Sin red (planes U2 y V) no hay documento fiscal.**
   - El plan V excluye la factura electrónica.
   - La cola sin conexión no tiene ninguna operación de facturación.
   - No hay talonario ni numeración de contingencia del emisor (tipos 03 y 07): ventas entregadas sin documento y
     documentos con fecha desplazada.
7. **El consecutivo es seguro solo gracias al bloqueo global de organización.** Las notas crédito usan `max()+1`, sin
   contador propio.
8. **El POS y la factura comparten el mismo XML, CUFE y plantilla.** No existe el CUDE del POS. La corrección del POS
   se modela como nota crédito `NC-n`, cuando la norma pide una **nota de ajuste** con su propio tipo y CUDE.
9. **Si el original está en contingencia o rechazado, la devolución no genera nota crédito, ni ahora ni después.**
   Una nota crédito rechazada no tiene reintento.
10. **El correo envía solo el XML simulado.** La DIAN exige el `AttachedDocument` y la representación gráfica.
11. **Consola incompleta:**
    - no hay pantalla de resoluciones ni de ajustes;
    - no hay botón de reintento;
    - los estados se aplanan a los de Odoo (`invoices.ts:73`);
    - `BillingSettings.tsx` es un resto de Odoo.
12. **No hay dónde guardar las credenciales fiscales por organización.** Existe el patrón de cifrado Fernet de los
    pagos (`experience_app/payments/crypto.py`).

## 4. Qué tendría que cambiar en Waiter para hablar con Fiscal.

- **Proveedor por HTTP:**
  - `provider()` elige por organización.
  - Un adaptador nuevo junto al simulado.
  - La interfaz crece: consultar estado, descargar XML y PDF, anular o sustituir, y un resultado con PDF,
    CUFE o CUDE, fecha de validación y `AttachedDocument`.
  - Hay que traducir las excepciones de `requests` a «contingencia».
- **Separar emitir de transmitir:**
  - Primero se asigna el número, se crea el documento en `pending` y se hace commit.
  - Después, fuera del bloqueo, se envía a Fiscal. con una clave estable (id del documento o organización y número).
  - Un comando programado (como `reconcile_payments`) reenvía lo pendiente.
- **Avisos de Fiscal.:**
  - Una ruta pública sin sesión, con firma HMAC por cliente y transición de estado idempotente (modelo a copiar: el
    webhook de Wompi en `experience_app/services/online_payments.py`).
  - El consumo y el correo se mueven al momento en que queda emitido.
  - Como respaldo, consulta periódica del estado.
- **Producto:**
  - Emitir al cobrar (POS y mesero), con fecha igual a la del pago.
  - Volver a emitir o sustituir un rechazado.
  - Nota crédito tardía cuando el original pase a emitido.
  - Nota de ajuste para el POS.
  - Contador propio de notas.
  - Decidir qué hace el modo de emergencia.
- **Datos:** los de la sección 2, con código DIAN en los impuestos y catálogos DIAN en el emisor y el comprador.
- **POS:**
  - pantallas de resoluciones y ajustes;
  - reintento;
  - estados reales;
  - número, CUFE o CUDE y QR en el recibo;
  - quitar los textos «SIMULADO».
- **Pruebas y QA:**
  - Del adaptador HTTP: tiempo de espera después de aceptar, idempotencia, aviso firmado y sin firma.
  - Actualizar `docs/qa/guia-qa-06-dueno.md:148-153`.
- **Documentación relacionada en Waiter:**
  - plan T4 (`docs/planes/2026-10-01-plan-T-sistema-propio.md:558-637, 857-872`);
  - sprint de integraciones (`:90-115`);
  - plan U (`:41-56, 145`);
  - plan W, medición por documento (W3 antes de la facturación real).
