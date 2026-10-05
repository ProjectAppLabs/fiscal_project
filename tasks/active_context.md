# Active Context — Fiscal.

> Memory Bank · actualizado 2026-10-04. Refrescar al cerrar cada sesión significativa.

## Foco actual

F1, F2, F4 y F5 terminadas (2026-10-05):
- Fiscal. arma, firma y transmite facturas y notas;
- maneja las contingencias 04 (DIAN) y 03 (papel), con la evidencia y la carta;
- genera el `AttachedDocument` y el PDF con el QR;
- alerta sobre certificados, numeración, plazos, rechazos y cola, e informa su salud;
- tiene la consola completa (tablero, documentos con descargas, emisores, contingencias, alertas y sistemas cliente).

Todo se probó sin la DIAN real. Faltan F3, que espera el certificado y el registro del software de ProjectApp, y F6
(Waiter conectado), que el dueño pidió dejar para el final.

## Decisiones activas

- **D1:** cada comercio factura en la modalidad «software propio o adquirido» con su NIT. ProjectApp renta el
  software; no es proveedor tecnológico.
- **D2:** factura electrónica para todo. Meta: API para otras casas de software.
- **D3:** el facturador de pruebas es ProjectApp (persona natural con NIT).
- **D5:** sin internet en Waiter o con Fiscal. caído → contingencia del emisor (tipo 03).
- **D6:** desarrollo y pruebas en local.
- **D7:** cada comercio paga su certificado.
- Stack y convenciones de la plantilla: código y commits en inglés, documentación en español, FBV, serializers por
  operación, Huey y Redis, rama y PR por sesión.
- MySQL 8.4 en desarrollo (estándar de ProjectApp; contenedor `fiscal-mysql`, 127.0.0.1:3308).
- La base es la fuente de verdad del estado de los documentos; Huey solo ejecuta.

## Antecedentes

- **Inventario:** `docs/fiscal/inventario/` (DIAN, Waiter, operación, negocio y legal), levantado el 2026-10-04.
- **Prototipo previo** fuera de la plantilla: `~/work/fiscal_project_borrador`, rama `prototipo/z1-base`. Tiene firma
  HMAC, emisores, certificados, cola y 27 pruebas; sirve para portar a F1.
- **Estudio de viabilidad y beneficio:** documento 233 del gestor documental de ProjectApp.

## Próximos pasos

1. **F6 · Waiter se conecta** (plan en el repositorio de Waiter), al final por decisión del dueño.
2. **F3 (bloqueada por el dueño):** certificado digital de ProjectApp y registro de Fiscal. en el portal de
   habilitación. Con eso se corre el set de pruebas y se confirman los puntos de los planes F2 y F4:
   - direcciones de los servicios, autenticación mutua TLS y formato de `X509IssuerName`;
   - `UUID` del `AdditionalDocumentReference` en el tipo 03.
3. Caja de herramientas y anexos en `~/.cache/fiscal-dian/` (fuera del repositorio).
