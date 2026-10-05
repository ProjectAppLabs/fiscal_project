# Plan de implementación F3 · Inscripción y habilitación

> 2026-10-05. Fase F3 de `tasks/tasks_plan.md`. El primer emisor es ProjectApp (persona natural con NIT), que será
> el facturador de pruebas (D3). La consola inscribe al emisor y corre su set de pruebas de la DIAN.

## Lo que hace el dueño (fuera de Fiscal.)

1. **Certificado digital** de una entidad de certificación acreditada por la ONAC, a nombre de quien factura:
   - en archivo `.p12` o `.pfx` con contraseña, **no en token USB**;
   - con firma digital y no repudio;
   - suele durar 1 año (algunas entidades lo venden de 2).

   No hace falta tener el software registrado para pedirlo.
2. **Registro del software** en el portal de habilitación de la DIAN, en el modo «Software propio»:
   - nombre Fiscal., NIT del fabricante y un PIN;
   - la DIAN entrega al instante el identificador del software y el `TestSetId`.
3. **Antes de terminar la habilitación**, hablar con el contador. Al terminarla se fija la fecha de inicio de la
   facturación electrónica (no se puede cambiar) y la DIAN agrega la responsabilidad 52 al RUT.

## PRs

### F3 PR 1 · API del asistente y del set de pruebas (`feat/…-onboarding-api`) — ✅ hecho

- Consola (JWT, operadores):
  - crear un sistema cliente (el secreto se muestra una sola vez);
  - inscribir un emisor (mismas validaciones que la API de máquina: NIT con dígito de verificación, catálogos DIAN);
  - subir el `.p12` como archivo con su contraseña: se valida al momento con las reglas del §10.14 y se guarda
    cifrado;
  - registrar el software (identificador, PIN y `TestSetId`) y el rango de numeración.
- `services/test_set.py`:
  1. arma las facturas del set con un ejemplo de restaurante, las firma, las nombra según el §6.5.7 y las envía en
     un ZIP con `SendTestSetAsync`;
  2. cuando la DIAN las acepta (`GetStatusZip`), envía una nota crédito y una nota débito que referencian la
     primera factura.

  Los números salen del rango de habilitación y no se repiten entre corridas (regla 90). Huey consulta cada 2
  minutos los sets en proceso.
- El tamaño por omisión es el que muestra hoy el micrositio de la DIAN (8 facturas, 1 nota crédito y 1 nota débito);
  manda el catálogo de cada `TestSetId`, así que se puede subir.

### F3 PR 2 · Asistente en la consola (`feat/…-onboarding-wizard`) — ✅ hecho

- Página «Inscribir emisor» por pasos: sistema cliente, datos del emisor, certificado, software y numeración.
  El rango de habilitación SETP 990000000–995000000 viene precargado.
- En el detalle del emisor: lista de lo que falta y el panel del set de pruebas (iniciar, consultar y el resultado
  de cada documento con sus reglas). Mientras un set está en proceso no se puede iniciar otro.
- La contraseña del certificado y el PIN van en campos de contraseña y no quedan en el estado de la página después
  de guardarse.

### F3 PR 3 · Corrida real (requiere el certificado y el registro)

- Cargar ProjectApp en el asistente, correr el set y resolver lo que diga la DIAN.
- Confirmar los puntos pendientes de F2 y F4:
  - direcciones del servicio, autenticación mutua TLS y formato de `X509IssuerName`;
  - `UUID` del `AdditionalDocumentReference` en el tipo 03.
