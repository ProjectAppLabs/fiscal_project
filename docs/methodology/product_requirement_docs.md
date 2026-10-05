# Product Requirement Docs — Fiscal.

> Memory Bank · actualizado 2026-10-04 (planeación técnica previa a la implementación). Base: el inventario en
> `docs/fiscal/inventario/` y las decisiones del dueño del 2026-10-04.

**Marca:** se escribe **Fiscal.**, con el punto final, como ProjectApp. y Waiter. El logotipo es «Fiscal.» en
**Ubuntu Bold**. Repositorio: `fiscal_project`.

## Por qué existe

- Waiter (POS para restaurantes de ProjectApp) promete **facturación electrónica incluida en la mensualidad**. Con un
  proveedor que cobra por documento, el costo se come el margen: un local con 3.000 documentos al mes pagaría más de
  facturar que de mensualidad. El estudio de viabilidad está en el documento 233 del gestor documental de ProjectApp.
- Ya se cotizaron proveedores tecnológicos antes de este proyecto (D4). Hacerlo propio sale más barato desde unos
  9 a 27 locales, da control de la experiencia y crea un activo reutilizable.
- **Meta de producto:** que Fiscal. sea, además, una **API de facturación electrónica para otras casas de software y
  servicios** que la necesiten.

## Qué es

Un servicio aparte, en su propio servidor, que recibe el documento comercial de un sistema cliente y lo convierte en el
documento electrónico de la DIAN:
- arma el UBL 2.1;
- calcula el CUFE o el CUDE;
- firma con XAdES-EPES y el certificado del comercio;
- lo transmite por SOAP;
- interpreta la respuesta;
- arma el `AttachedDocument` y la representación gráfica;
- conserva todo 10 años.

El sistema cliente (Waiter) sigue siendo dueño del negocio: líneas, impuestos, comprador y numeración.

## Modalidad ante la DIAN (D1, decidida)

**Cada comercio factura en la modalidad «desarrollo informático propio o adquirido» con su propio NIT**, no a través
de un proveedor tecnológico. ProjectApp le **renta el software** al comercio (licencia de uso dentro de la suscripción
de Waiter, o del sistema cliente que corresponda).

Esto implica:
- **Habilitación:** cada comercio registra el software en su portal de la DIAN, con ProjectApp como fabricante, y
  supera su set de pruebas.
- **Certificado y numeración:** cada comercio usa su propio certificado digital y su propia resolución de numeración.
- **XML:** cada documento identifica a ProjectApp como fabricante del software y no declara proveedor tecnológico.
- **Licencia:** un contrato de licencia de uso por comercio documenta la adquisición del software.

**Riesgo conocido y aceptado:** el inventario legal (`docs/fiscal/inventario/04-negocio-y-legal.md`, sección 1)
explica que operar la firma y la transmisión en nuestro servidor para muchos NIT se parece a la definición de
proveedor tecnológico y queda en zona gris.

Mitigaciones:
- Licencia escrita por comercio.
- El certificado es del comercio, que lo puede revocar o reemplazar.
- Aislamiento estricto por comercio.
- Revisión de la postura si la DIAN cambia su doctrina, y antes de abrir la API a otras casas de software.
- A futuro, habilitar a ProjectApp como proveedor tecnológico si el volumen lo justifica.

## Alcance funcional

### Etapa 1: restaurantes de Waiter (D2: factura electrónica para todo)

| Capacidad | Detalle |
|---|---|
| Factura electrónica de venta | Para toda venta; consumidor final `222222222222` (tipo 13) por omisión y datos del comprador si los pide |
| Notas crédito y débito | Anulación (concepto 2), devoluciones y ajustes; referencian prefijo, número, CUFE y fecha del original |
| Contingencia DIAN (tipo 04) | Reintentos según el anexo, se vuelve a firmar el mismo número como tipo 04, se entrega sin validar y se transmite en 48 h |
| Contingencia del emisor (tipo 03) | Waiter sin internet **o Fiscal. caído**: el POS imprime una factura de contingencia con el rango de contingencia autorizado; Fiscal. la transcribe como tipo 03 en 48 h (D5) |
| Entrega | `AttachedDocument` firmado con el XML y la validación de la DIAN, y representación gráfica (PDF) con el QR; el sistema cliente la imprime o la envía por correo |
| Reglas de restaurante | INC 8 % (04) o IVA (01) por ítem; propina como cargo fuera de la base (máximo 10 %, Ley 1935); dirección de entrega en domicilios con consumidor final o cédula; prefijo por local |
| Conservación | XML firmado, respuesta de la DIAN, contenedor y evidencias de contingencia por 10 años |

### Etapa 2: más documentos (para cualquier comercio)

- Documento equivalente electrónico tiquete POS (CUDE con el PIN, notas de ajuste, contingencias 07 y 08).
- Documento soporte de compras a no obligados.
- Eventos RADIAN como comprador (030 y 032).
- Otros tributos del catálogo.

### Etapa 3: API para terceros

- Registro de nuevos sistemas cliente (otras casas de software).
- Documentación pública del contrato.
- Límites y medición por cliente.

## Usuarios

- **Sistema cliente** (máquina; Waiter primero): crea emisores, sube certificados, envía documentos y recibe avisos.
  Se autentica con firma HMAC por petición.
- **Operador de ProjectApp** (persona): usa la consola de Fiscal. (frontend Next.js) para ver documentos por estado,
  rechazos, contingencias, alertas de certificados y numeración, y la salud de la DIAN. Se autentica con JWT, como en
  la plantilla.
- **Comercio** (indirecto): no entra a Fiscal. Ve su facturación en el sistema cliente; su habilitación la guía la
  consola del dueño de Waiter.

## Reglas de negocio

- **La venta nunca espera a Fiscal. ni a la DIAN.** Si Fiscal. no responde, el sistema cliente entra en contingencia
  del emisor (D5).
- **Nada se entrega al comprador sin validación de la DIAN**, salvo en la contingencia tipo 04.
- **Un número se transmite una sola vez.** Los reintentos son idempotentes y nunca cambian el número ni el CUFE.
- **El número lo asigna el sistema cliente** con la resolución del comercio. Fiscal. lo valida contra los rangos y
  rechaza los repetidos.
- **Cada comercio solo ve y firma con lo suyo.** Un sistema cliente solo ve sus comercios.
- **Los secretos nunca salen:** certificado, contraseña, PIN y clave técnica se guardan cifrados y no aparecen en
  respuestas ni en registros.
- **Fechas en hora de Colombia (−05:00).** Montos truncados a 2 decimales en la cadena del CUFE y redondeo
  half-even en el XML.
- **Cada comercio paga su certificado digital** (D7). ProjectApp no lo vende.

## Decisiones del dueño (2026-10-04)

| # | Decisión |
|---|---|
| D1 | Modalidad «software propio o adquirido» de cada comercio; ProjectApp renta el software. No es proveedor tecnológico |
| D2 | Factura electrónica para todo. Meta: API para otras casas de software |
| D3 | El facturador de pruebas es **ProjectApp** (persona natural con NIT, que ya factura electrónicamente). Registra el software en su portal de habilitación y corre el set de pruebas con su certificado |
| D4 | Ya se cotizaron proveedores tecnológicos; por eso se construye este servicio |
| D5 | Waiter sin internet usa el modo de emergencia. **Si Fiscal. no responde, Waiter usa la misma contingencia del emisor** (factura de contingencia con el rango de contingencia y transcripción tipo 03) |
| D6 | Servidor **local** por ahora. Si hace falta, el dueño da uno de prueba |
| D7 | Cada comercio paga su certificado; no lo vendemos. No se publica en el gestor documental: este es un plan interno |

## Fuera de alcance (por ahora)

- Ser proveedor tecnológico autorizado.
- Nómina electrónica.
- Facturas de exportación y en moneda extranjera.
- Facturación de servicios públicos y transporte aéreo.
- Vender certificados digitales.
- Que el comercio entre a Fiscal. directamente.
