# Plan de implementación F4 · Contingencias, entrega, alertas y salud

> 2026-10-04. Fase F4 de `tasks/tasks_plan.md`. No necesita la DIAN real: se prueba con el gateway simulado, con
> respuestas grabadas y con certificados de prueba, como F2. Fuente: anexo técnico FE 1.9 (`~/.cache/fiscal-dian/`).

## Referencias oficiales

| Qué | Dónde |
|---|---|
| Contingencia del emisor (tipo 03): factura de talonario o papel, carta del representante legal a `contingencia.facturadorvp@dian.gov.co`, transcripción por `SendBillSync` dentro de las 48 h siguientes a superar la falla. Las notas no tienen contingencia | Anexo §12.1 |
| Tipo 03: CUDE con el PIN del software (el rango de contingencia no tiene clave técnica); el rango se verifica contra la numeración de contingencia | Anexo §11.4, notas 1 y 2 |
| Tipo 03: `AdditionalDocumentReference` obligatorio con el número (FAI02), un CUFE o CUDE (FAI03 y FAI04) y la fecha de la factura de papel (FAI05) | Anexo, reglas FAI01–FAI06 |
| Contingencia de la DIAN (tipo 04): tras los reintentos, misma numeración y mismo número con `InvoiceTypeCode=04`, firmar de nuevo, entregar en un `AttachedDocument` sin `ApplicationResponse`, guardar la evidencia, sondear cada 30 min y transmitir dentro de las 48 h siguientes a que la DIAN vuelve. Las notas no tienen contingencia | Anexo §12.2 y §12.4 |
| La DIAN decide si un tipo 04 cae en su período de contingencia por el `SigningTime` | Anexo §12.2; regla CTG01 |
| `AttachedDocument`: estructura AE01–AE55, `CustomizationID` «Documentos adjuntos», `DocumentType` «Contenedor de Factura Electrónica», el documento en `Attachment/ExternalReference/Description` (CDATA) y el `ApplicationResponse` en `ParentDocumentLineReference` con `ResultOfVerification`; firmado | Anexo §6.4 |
| Representación gráfica: QR en todas las páginas (mínimo 2 cm) con la URL de consulta | Anexo §11.7 |
| Requisitos mínimos de la factura que debe mostrar la representación | Res. 000227, art. 1.5.1.2.2.1; inventario 01, §1.3 |

El CUFE no cambia al pasar a tipo 04: su cadena (§11.2) no incluye el tipo de factura.

## PRs

### F4 PR 1 · Contingencia de la DIAN, tipo 04 (`feat/…-dian-contingency`) — ✅ hecho

- Al agotar los reintentos del §12.4, una **factura** se vuelve a armar con `InvoiceTypeCode=04`, mismo prefijo, número
  y CUFE, y se firma de nuevo. Se guardan los dos XML firmados y la evidencia de los errores (artefacto `evidence`).
- Las **notas** no tienen contingencia: siguen en la cola, con sondeo cada 30 minutos, sin tipo 04.
- Desde ahí se reenvía el XML tipo 04 (el último firmado), cada 30 minutos.
- `Document.contingency_started_at` e `invoice_type`. El plazo de 48 h corre desde que la DIAN vuelve. Como Fiscal.
  transmite en el primer sondeo que obtiene respuesta, se cumple solo. Las alertas de 24 h y 40 h se cuentan desde
  la entrada en contingencia, que es más estricto.
- El aviso al sistema cliente sale al entrar en contingencia (una sola vez) y al validarse.
- **Hecho.** Además se corrigió un error de F1: `_requeue` no guardaba `transient_failures`, así que ningún
  documento llegaba a la contingencia. La prueba de F1 fijaba el contador en la base y no lo atrapaba.

### F4 PR 2 · `AttachedDocument` y representación gráfica (`feat/…-delivery`)

- `dian/ubl/attached.py`: contenedor firmado con el documento y, si existe, el `ApplicationResponse` y su
  `ResultOfVerification`. Valida contra `UBL-AttachedDocument-2.1.xsd`.
- `fiscal_app/services/representation.py`: PDF con `reportlab` (Python puro, BSD), armado **solo con datos del XML
  firmado**. Trae los requisitos del art. 1.5.1.2.2.1 y el QR (≥ 2 cm) en todas las páginas. Si es tipo 04, lo
  dice.
- Se generan al validarse el documento y al entrar en contingencia 04: artefactos `attached_document` y `pdf`.
- El aviso al sistema cliente indica qué artefactos hay; la entrega al comprador (correo o impresión) la hace el
  sistema cliente (F6).

### F4 PR 3 · Contingencia del emisor, tipo 03 (`feat/…-issuer-contingency`)

- Las facturas con `issuer_contingency` (F1 ya las acepta con el rango de contingencia) se arman como tipo 03:
  - CUDE con el PIN;
  - `InvoiceControl` del rango de contingencia;
  - `AdditionalDocumentReference` con el número y la fecha de la factura de papel.
- Plazo de 48 h desde que Fiscal. la recibe (se supera la falla al poder enviarla).
- Borrador de la carta a la DIAN (PDF) con los datos del emisor y el período del incidente. La firma el
  representante legal y la envía el comercio.
- **Por confirmar en habilitación:** qué `UUID` espera la DIAN en `AdditionalDocumentReference` para una factura de
  papel, que no tiene CUFE. Se informa el CUDE de la transcripción con `schemeName="CUDE-SHA384"`.

### F4 PR 4 · Alertas y salud (`feat/…-alerts-health`)

- Modelo `Alert` (emisor, tipo, severidad, mensaje, clave de deduplicación, abierta o resuelta).
- Revisión periódica (Huey):
  - certificado a 30, 15 y 7 días de vencer;
  - rango con menos del 10 % disponible;
  - resolución a 30 días de vencer;
  - contingencias a las 24 h y 40 h;
  - cola atascada más de 15 minutos.
- Rechazos de la DIAN: alerta al momento.
- Avisos: aviso firmado `issuer.alert` al sistema cliente y correo a ProjectApp (`FISCAL_ALERT_EMAILS`).
- `api/health/`:
  - base de datos;
  - cola (antigüedad del más viejo pendiente);
  - trabajadores (latido que escribe la tarea periódica);
  - DIAN (documentos en contingencia y última respuesta útil).

## Fuera de F4

- Envío por correo al comprador y su registro de entrega: lo decide F6 con Waiter.
- Documento equivalente POS, eventos RADIAN y documento soporte (etapas siguientes).
