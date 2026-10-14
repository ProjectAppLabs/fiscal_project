# Active Context — Fiscal.

> Memory Bank · actualizado 2026-10-14. Refrescar al cerrar cada sesión significativa.

## Foco actual

F1, F2, F4 y F5 terminadas (2026-10-05):
- Fiscal. arma, firma y transmite facturas y notas;
- maneja las contingencias 04 (DIAN) y 03 (papel), con la evidencia y la carta;
- genera el `AttachedDocument` y el PDF con el QR;
- alerta sobre certificados, numeración, plazos, rechazos y cola, e informa su salud;
- tiene la consola completa (tablero, documentos con descargas, emisores, contingencias, alertas y sistemas cliente).

F3 (2026-10-13/14): ProjectApp se registró en el portal de habilitación y la DIAN **aceptó su set de pruebas, 50 de
50** con la transmisión real (`DIAN_GATEWAY=soap`). Hallazgos: las responsabilidades y los conceptos de las notas
salen de las tablas del anexo, no del genericode; el lote puede quedarse «en proceso» horas y se consulta documento a
documento. Abiertos: #27 (paso a producción) y #29 (API de inscripción completa para Waiter, con `openapi.json`).
El paso «Habilitado» del portal no se ha hecho: fija una fecha irreversible y lo decide el dueño con su contador.
Falta F6 (Waiter conectado), que el dueño pidió dejar para el final.

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

1. Mergear #27 y #29 (en ese orden) y #28 (guía de registro).
2. El dueño decide «Habilitado» con su contador, pide la numeración en MUISCA y la asocia al software; después, en la
   consola o por la API: copiar el software, traer la numeración y pasar a producción.
3. Experimento FAQ04a en habilitación; limpiar CAK55/DAK55, DAK07 y DAJ39 si conviene.
4. **F6 · Waiter se conecta** (plan en el repositorio de Waiter), al final por decisión del dueño. La API que usa está
   en `docs/fiscal/contrato.md` y `docs/fiscal/openapi.json`.
5. Despliegue en un servidor (hoy todo corre en local, D6).
3. Caja de herramientas y anexos en `~/.cache/fiscal-dian/` (fuera del repositorio).
