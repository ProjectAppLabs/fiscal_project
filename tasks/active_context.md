# Active Context — Fiscal.

> Memory Bank · actualizado 2026-10-04. Refrescar al cerrar cada sesión significativa.

## Foco actual

Planeación técnica interna de Fiscal. sobre la plantilla Base Django React Next, rama
`docs/04102026-technical-execution-plan`. Todavía no hay código de Fiscal. en este repositorio. Lo siguiente es el
plan de implementación detallado de F1.

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

1. F1 cerrada y recorrida de punta a punta (2026-10-04).
2. F2 (plan en `docs/fiscal/planes/F2-dian.md`), librería `dian/`: UBL 2.1, CUFE/CUDE con los ejemplos del anexo, XAdES-EPES y SOAP; F2 termina con el set de pruebas, que necesita el certificado y el registro del software de ProjectApp.
3. F2: las 221 reglas Schematron de la DIAN (XPath 2.0) validan el XML armado; lxml no ejecuta XSLT 2.0, así que
   hace falta un motor XSLT 2.0 (Saxon). Caja de herramientas y anexos en `~/.cache/fiscal-dian/`.
3. Del dueño, sin bloquear F1: registrar Fiscal. en el portal de habilitación de ProjectApp y, hacia el final de F2,
   el certificado.
