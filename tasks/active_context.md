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

1. El dueño revisa este Memory Bank.
2. F0: certificado y registro del software de ProjectApp en habilitación; Python 3.14 y rueda de `mysqlclient`; caja
   de herramientas de la DIAN.
3. Plan de implementación de F1 (renombre de la plantilla, retiro de demos, núcleo y contrato v1).
