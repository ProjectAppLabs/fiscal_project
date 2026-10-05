# Active Context — Fiscal.

> Memory Bank · actualizado 2026-10-04. Refrescar al cerrar cada sesión significativa.

## Foco actual

F1 y F2 terminadas (2026-10-04). Fiscal. arma la factura y las notas en UBL 2.1, calcula CUFE y CUDE, firma con
XAdES-EPES y las envía por SOAP con WS-Security; `DIAN_GATEWAY=soap` activa el gateway real. Todo se probó sin red:
con los vectores del anexo, los XSD oficiales y los ejemplos firmados de la caja. La prueba real es el set de pruebas
de F3, que necesita el certificado y el registro del software de ProjectApp.

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

1. **F3 (bloqueada por el dueño):** certificado digital de ProjectApp y registro de Fiscal. en el portal de
   habilitación (identificador del software, PIN y `TestSetId`). Con eso se corre el set de pruebas y se confirman:
   direcciones de los servicios, autenticación mutua TLS y formato de `X509IssuerName` (lista en el plan F2).
2. **F4 (puede avanzar sin la DIAN):** contingencias 03 y 04, `AttachedDocument` y representación gráfica (PDF).
3. Caja de herramientas y anexos en `~/.cache/fiscal-dian/` (fuera del repositorio).
