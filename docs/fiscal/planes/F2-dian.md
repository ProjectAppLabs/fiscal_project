# Plan de implementación F2 · Librería `dian/`: UBL, CUFE/CUDE, firma y SOAP

> 2026-10-04. Fase F2 de `tasks/tasks_plan.md`. Todo se construye contra la documentación oficial descargada en
> `~/.cache/fiscal-dian/` (caja de herramientas FE_V19_(v2026), anexo técnico FE 1.9 y guía de web services). Lo que
> se toma de ella se cita con su sección. **Solo el último paso (set de pruebas) necesita el certificado y el registro
> del software de ProjectApp.**

## Referencias oficiales verificadas

| Qué | Dónde | Verificado |
|---|---|---|
| CUFE = SHA-384(NumFac + FecFac + HorFac + ValFac + 01 + ValImp1 + 04 + ValImp2 + 03 + ValImp3 + ValTot + NitOFE + NumAdq + ClTec + TipoAmbiente), montos truncados a 2 decimales | Anexo FE 1.9 §11.2 | El ejemplo §11.2.1 reproduce `8bb918b1…5bd9b4` exacto |
| CUDE: misma cadena con el PIN del software en lugar de la clave técnica | Anexo §11.4 | El ejemplo de la factura tipo 03 reproduce `955327eb…1a9ef7` exacto |
| SoftwareSecurityCode = SHA-384(IdSoftware + PIN + número del documento) | Anexo §11.8 | — |
| QR: NumFac, FecFac, HorFac, NitFac, DocAdq, ValFac, ValIva, ValOtroIm, ValTolFac, CUFE y la URL de consulta | Anexo §11.7 | — |
| Propina: `AllowanceCharge` con `ChargeIndicator=true`, `AllowanceChargeReasonCode=03`, `MultiplierFactorNumeric` (%), `BaseAmount` = valor de las líneas; fuera de `TaxTotal` y sumada en `ChargeTotalAmount` | Caja, `Ejemplificacion Propina.xml` | — |
| Consumidor final y estructura completa de una factura | Caja, `Consumidor Final.xml`, `Generica.xml` | — |
| Esquemas UBL 2.1 y extensiones DIAN | Caja, carpeta `XSD` (`UBL-Invoice-2.1.xsd`, `DIAN_UBL_Structures.xsd`…) | — |

**Nota:** los CUFE de los XML de ejemplo de la caja no se reproducen con las claves técnicas conocidas; son
ilustrativos. Los vectores de prueba son los de los ejemplos del anexo (§11.2.1 y §11.4).

## PRs

### F2 PR 1 · Factura UBL 2.1, CUFE y QR (`feat/…-ubl-invoice`) — ✅ hecho

La factura de restaurante (consumidor final, INC, propina y canje de puntos) y la de una empresa con domicilio validan contra los XSD oficiales. CUFE y CUDE reproducen los ejemplos del anexo. La propina va con el código 03 (tabla 13.3.8: «se utilizará para informar las Propinas») y el canje de puntos con el 00. `BaseQuantity` es igual a la cantidad, como en los ejemplos más recientes. El emisor es su propio proveedor tecnológico (FAB19). Los XSD de la caja tienen una inconsistencia en el `schemeID` de `ProviderID`, documentada en `dian/resources/README.md`.

- `dian/codes.py`: CUFE, CUDE, SoftwareSecurityCode y contenido y URL del QR, con montos **truncados** (no
  redondeados) en la cadena.
- `dian/ubl/invoice.py`: arma el `Invoice` desde el documento normalizado de F1, en el orden de elementos del XSD y de
  los ejemplos oficiales:
  - `DianExtensions` (control de factura, fabricante y software, código de seguridad, QR);
  - emisor y adquirente (consumidor final con `222222222222`, tipo 13 y `R-99-PN`);
  - medios de pago;
  - descuentos y cargos (propina, código 03);
  - `TaxTotal` por tributo y tarifa;
  - `LegalMonetaryTotal`;
  - líneas.

  Sin firma: el nodo de la firma lo agrega el PR 3.
- `dian/xsd.py`: los XSD oficiales copiados en `dian/resources/xsd/` y validación con lxml.
- **Pruebas:** vectores del anexo; la factura de restaurante de F1 valida contra el XSD; truncado frente a redondeo;
  hora en −05:00; propina como en el ejemplo oficial; consumidor final.

### F2 PR 2 · Notas crédito y débito (`feat/…-ubl-notes`)

- `CreditNote` y `DebitNote` con `DiscrepancyResponse` (concepto), `BillingReference` (número, CUFE y fecha de la
  factura) y su CUDE.
- Validan contra el XSD. Estructura comparada con `CreditNote.xml` y `DebitNote.xml` de la caja.

### F2 PR 3 · Firma XAdES-EPES (`feat/…-xades`)

- `dian/signing.py`: firma envuelta (enveloped) en la segunda `ext:UBLExtension`, con RSA-SHA256, C14N, el
  certificado X.509 y `SignedProperties` (`SigningTime` en −05:00, `SigningCertificate`, política de firma de la DIAN
  con su hash y el rol). Se decide entre una implementación propia sobre lxml y cryptography o `signxml`: se usa lo que
  produzca exactamente la estructura del anexo (suplemento de firma).
- **Pruebas:**
  - la firma verifica con el certificado;
  - cambiar un byte la rompe;
  - el XML firmado sigue validando contra el XSD;
  - no se reformatea el XML después de firmar.

### F2 PR 4 · Cliente SOAP y gateway real (`feat/…-soap-gateway`)

- `dian/soap.py`:
  - SOAP 1.2 con WS-Security (BinarySecurityToken, Timestamp y firma de `wsa:To`) y TLS con el certificado del emisor;
  - ZIP en base64 con un solo XML;
  - `SendBillSync`, `SendTestSetAsync`, `GetStatus`, `GetStatusZip` y `GetNumberingRange`.
- **Direcciones** de habilitación y producción tomadas de la guía de web services; si no están en la documentación
  oficial, se confirman al registrar el software (inventario: «sin confirmar»).
- **Respuesta:** se interpreta el `ApplicationResponse` (`IsValid`, `StatusCode`, reglas con su código y mensaje).
  Errores 500/503/507/508/403 → `DianUnavailable('error')`; una demora de más de 60 s → `DianUnavailable('delay')`.
- `SoapGateway` implementa `DianGateway`: arma el UBL, lo firma, lo envía y guarda el XML firmado y la respuesta.
  `DIAN_GATEWAY=soap` lo activa.
- **Pruebas:** con un transporte HTTP simulado que devuelve respuestas grabadas con la forma de la guía (sin red real).

### F2 PR 5 · Validación con las reglas Schematron de la DIAN (opcional, `feat/…-schematron`)

- Las 221 reglas de `DIAN-UBL21-model.sch` están en XPath 2.0, que lxml no ejecuta. Se evalúa `saxonche` (Saxon-HE
  para Python). Si hay rueda para Python 3.14, se valida el XML armado antes de enviarlo; si no, queda para después.

### Cierre de F2 · Set de pruebas real (requiere al dueño)

- Certificado digital de ProjectApp y registro de Fiscal. en el portal de habilitación: identificador del software,
  PIN y `TestSetId`.
- Enviar el set con `SendTestSetAsync` hasta que la DIAN lo dé por aceptado. Corte de riesgo: si en dos semanas no
  hay una factura aceptada, se reevalúa.

## Fuera de F2

- Contingencia 04 completa (volver a firmar como tipo 04), contingencia 03, `AttachedDocument` y PDF: son F4.
- Documento equivalente POS: etapa 2.
