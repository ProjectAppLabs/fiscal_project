# Software propio de facturación electrónica ante la DIAN: requisitos (corte: 4 de octubre de 2026)

> Investigación para construir un emisor directo (modalidad «software propio»), con prioridad en restaurantes.
> Fuentes oficiales primero: el texto compilado de la Resolución 000227 de 2025 en el normograma DIAN, los anexos técnicos
> y la caja de herramientas descargados del sitio de la DIAN, y el Estatuto Tributario (ET) en la Secretaría del Senado.
> Las referencias entre corchetes, como [R227], llevan a la lista de fuentes al final. Lo marcado **«sin confirmar»** no
> lo pude verificar en una fuente oficial.

---

## 0. Marco normativo vigente y cambios recientes

| Norma | Qué hace | Estado a oct-2026 | Fuente |
|---|---|---|---|
| ET art. 616-1 (modificado por Ley 2155 de 2021, art. 13) | Define el sistema de facturación, la validación previa, la contingencia de 48 h y las sanciones aplicables (651, 652, 652-1). | Vigente | [ET616] |
| Res. DIAN 000165 de 2023 (1-nov-2023) | Reglamento técnico: adopta el **Anexo Técnico FE v1.9** y expide el **Anexo Técnico Documento Equivalente Electrónico v1.0**. | Compilada en la 000227. | [R227] |
| Res. 000008 y 000119 de 2024; 000189 de 2024 | Ajustes al calendario del documento equivalente y otros parágrafos. | Compiladas | [R227] |
| Res. 000202 de 31-mar-2025 | Servicios públicos (DE en sitio, 48 h); **datos que se pueden exigir al comprador** (solo nombre, tipo y número de identificación, correo); servicio de consulta del adquirente. | Compilada | [R227] |
| **Res. 000227 de 23-sep-2025** («Resolución Única en Materia Tributaria, Aduanera y Cambiaria») | **Compila** unas 70 resoluciones. La facturación queda en la **Parte 1, Título 5** (arts. 1.5.1.x.x: factura y documento equivalente; 1.5.2: documento soporte; 1.5.3: nómina; 1.5.4: RADIAN). **No cambia los requisitos técnicos:** los anexos siguen siendo FE v1.9 y DE v1.0. | Vigente desde el 25-sep-2025 (fuente secundaria [SAI]) | [R227], [R227pdf] |
| Res. 000011 de 23-abr-2026 | Agrega la subsección transitoria 1.5.1.5.10: **«contingencia especial de regularización voluntaria»** (Decreto Legislativo 0240 de 2026). Las facturas omitidas se transmiten como **tipo 03** con `CustomizationID = 20-REG`. Plazo máximo: **30-abr-2026**. | Ya vencida, pero un emisor debe tolerar o reconocer `20-REG` | [R11], [R227] art. 1.5.1.5.10.x, [INCP11] |
| Caja de herramientas «FE_V19_(v2026)» | El paquete técnico que hoy publica la DIAN se rotula **v2026**, pero el anexo que trae sigue siendo el **v1.9** (Res. 000165). Las tablas de tarifas incluyen valores de IBUA e ICUI para 2026. | Vigente | [CAJA], [DOCTEC] |

**Anunciado o en trámite:**
- No encontré una nueva versión del anexo FE (posterior a la 1.9) ni del anexo de documento equivalente (posterior a la 1.0) adoptada por resolución hasta oct-2026. Una supuesta **«DE v1.1» queda sin confirmar**: no aparece en el micrositio de documentación técnica [DOCTEC] ni en la Res. 000227, que sigue adoptando la v1.0 (art. 1.5.1.10.2) [R227].
- El servicio de consulta del adquirente (art. 1.5.1.12.4) ya tiene una guía oficial con el método SOAP **`GetAcquirer`** [GUIAWS]. La fecha formal de obligatoriedad u operación está **sin confirmar**.

---

## 1. Documentos que el sistema debe poder emitir

### 1.1 Resumen y prioridad para un restaurante

| Documento | Norma | ¿Lo necesita un restaurante? | Prioridad |
|---|---|---|---|
| **Factura electrónica de venta** (Invoice, tipo 01) | Arts. 1.5.1.2.2.1 y ss. [R227] | Sí. Es obligatoria cuando el cliente la pide; además, el restaurante puede facturar el 100 % por esta vía y no usar POS [R227] art. 1.5.1.3.1.1 parágrafo; [CP009]. | **1** |
| **Nota crédito / nota débito de la FE** (CreditNote, DebitNote) | Art. 1.5.1.5.6.1 [R227] | Sí: anulaciones (la NC es **el único mecanismo de anulación**), devoluciones y descuentos. | **1** |
| **Documento equivalente electrónico tiquete POS** (Invoice, tipo **20**) | Arts. 1.5.1.3.2.1 a 1.5.1.3.2.5 [R227]; Anexo DE v1.0 [ATDE] | Opcional: es la alternativa a facturar todo con FE. Útil para mostrador y consumidor final. | **2** |
| **Nota de ajuste del DE** (CreditNote/DebitNote; tipos de operación 94 crédito y 93 débito) | Art. 1.5.1.3.2.7 [R227]; [ATDE] 16.4 | Sí, si se emite POS: es el mecanismo de anulación y corrección del POS. | **2** |
| **Factura tipo 03** (transcripción de la factura en papel por contingencia del emisor) y **tipo 04** (contingencia DIAN) | Art. 1.5.1.5.7.1 [R227]; [AT19] supl. C | Sí: la operación no puede depender de la disponibilidad de la DIAN. | **1** |
| **Documento soporte en adquisiciones a no obligados a facturar** (+ notas de ajuste) | Arts. 1.5.2.x [R227]; anexo **v1.1** (art. 1.5.2.5.1) | Sí, si el restaurante compra a campesinos, plazas de mercado o personas naturales no obligadas. Puede ser por operación o **acumulado semanal** por proveedor (art. 1.5.2.2.1). | **3** |
| **Eventos RADIAN / ApplicationResponse** (030 acuse, 031 reclamo, 032 recibo del bien o servicio, 033 aceptación expresa, 034 aceptación tácita) | Arts. 1.5.4.x y 1.5.4.9.1 [R227]; tabla 13.1.6 [CAJA] | **Como vendedor:** casi nunca, porque vende de contado. **Como comprador a crédito:** el art. 616-1 ET y el 1.5.4.9.1 exigen confirmar recibo de la factura y de los bienes (030 y 032) para que la factura del proveedor **soporte costos e IVA descontable** [ET616]. | **3** |
| AttachedDocument (contenedor) | [AT19] 6.4 | Es la forma de entrega al cliente. | **1** |

### 1.2 Documento equivalente POS electrónico frente a factura electrónica

| Aspecto | Tiquete POS electrónico | Factura electrónica |
|---|---|---|
| Denominación | «Documento equivalente electrónico tiquete de máquina registradora con sistema P.O.S.» (art. 1.5.1.3.2.4 num. 1) [R227] | «Factura electrónica de venta» |
| Tope de valor | **Según la DIAN, sin tope:** «quien expida este documento equivalente lo podrá realizar independientemente del valor de la operación» (art. 1.5.1.3.2.1 parágrafo) [R227]; «no aplicará el límite de 5 UVT» [CP009]. **Pero** el ET art. 616-1 par. 2, de rango legal, sigue diciendo que el POS solo procede si la venta **no supera 5 UVT sin impuestos** «de conformidad con el calendario que expida la DIAN» [ET616]. **Tensión norma legal y reglamento sin resolver en lo que encontré.** 5 UVT de 2026 = $261.870 (UVT 2026 = $52.374, Res. 000238 de 2025) [UVT]. | Sin tope. |
| Identificación del adquirente | Opcional. Para que soporte costos e IVA descontable debe llevar **nombre o razón social y número de identificación**. Con «consumidor final» / 222222222222 **no** sirve de soporte (art. 1.5.1.3.2.4 par. 1) [R227]. | Obligatoria según los numerales 3.1, 3.2 y 3.3 (NIT; cédula u otro documento; o «consumidor final» 222222222222) (art. 1.5.1.2.2.1) [R227]. |
| Numeración | Rango, número y vigencia autorizados por la DIAN (art. 1.5.1.3.2.4 num. 4). Los rangos de POS **físico** deben **inhabilitarse** y pedirse unos nuevos para el electrónico (art. 1.5.1.12.1) [R227]. | Prefijo de hasta 4 caracteres + consecutivo autorizado + **clave técnica** [R227] art. 1.5.1.6.2.1; [AT19] 11.6. |
| Código único | **CUDE** (SHA-384 con **PIN del software**) [ATDE] 14.1.3 | **CUFE** (SHA-384 con **clave técnica**) [AT19] 11.2 |
| Datos específicos POS | Cantidad, unidad, descripción y **códigos** de los ítems; el software debe identificar **departamento o agrupación** y **tarifa de IVA o INC por ítem** (art. 1.5.1.3.2.5 num. 1) [R227]. Extensiones obligatorias en el XML: `InformacionDelFabricanteDelSoftware`, `InformacionVeneficiosComprador` (Codigo, NombresApellidos, Puntos) e `InformacionCajaVenta` (PlacaCaja, UbicaciónCaja, Cajero, TipoCaja, CódigoVenta, SubTotal) (regla DEPD11, [ATDE] 8.2.1 y 10.2.1). | Forma y medio de pago, número de líneas, etc. (art. 1.5.1.2.2.1 nums. 8 a 11). |
| Entrega | Con correo informado: XML + validación en el contenedor. Si no se informa medio: **impresión de la representación gráfica** [ATDE] cap. 4. | Igual; con un adquirente facturador electrónico, al correo que registró en la DIAN [R227] art. 1.5.1.5.5.1. |
| Calendario | Implementación obligatoria para quien use POS: 1-may-2024 (grandes contribuyentes), 1-jun-2024 (declarantes), 1-jul-2024 (demás) [R227] art. 1.5.1.3.3.1. Quien empiece después debe **habilitarse antes de emitir** (parágrafo). | Ya obligatoria. |

**Recomendación para restaurantes:** empezar con **FE para todo**, con consumidor final 222222222222 por defecto y captura de datos solo si el cliente la pide. Esto evita una segunda habilitación, la extensión POS y la ambigüedad de las 5 UVT. Agregar el POS electrónico después si el volumen de mostrador lo justifica.

### 1.3 Requisitos mínimos de la factura (art. 1.5.1.2.2.1 [R227])
1. Denominación «factura electrónica de venta». 2. Razón social y NIT del vendedor. 3. Adquirente (NIT; o nombre y documento; o «consumidor final» y 222222222222). **Si la venta es fuera del local (domicilio) y el adquirente es 3.2 o 3.3, hay que registrar la dirección de entrega.** 4. Prefijo, consecutivo, fecha y vigencia de la autorización. 5. Fecha y hora de generación. 6. Fecha y hora de expedición (= validación). 7. Entrega del XML y del «Documento validado por la DIAN» en el contenedor. 8. Líneas con cantidad, unidad, descripción y códigos. 9. Valor total. 10. Forma de pago (contado o crédito, con plazo). 11. Medio de pago (si es de contado). 12. Calidades fiscales (agente retenedor de IVA, autorretenedor, gran contribuyente, SIMPLE). 13. Discriminación de IVA, INC, INC bolsas, impuestos saludables, etc., con su tarifa. 14. Firma digital. 15. CUFE. 16. URL del QR. 17. Anexo técnico. 18. Fabricante del software (NIT y nombre), nombre del software y proveedor tecnológico si lo hay.

Datos que **se pueden exigir** al comprador que pide factura a su nombre: **solo** nombre o razón social, tipo y número de identificación y correo. Si se entrega impresa, el correo no es necesario. Además, debe existir un canal presencial (art. 1.5.1.12.3, modificado por la Res. 202 de 2025) [R227].

---

## 2. Anexos técnicos, UBL, CUFE, CUDE, QR, firma y servicios web

### 2.1 Versiones y descargas
| Documento | Versión vigente | Descarga |
|---|---|---|
| Anexo Técnico Factura Electrónica de Venta | **1.9** (Res. 000165; obligatorio desde el **1-may-2024**, art. 1.5.1.10.4) | [AT19] |
| Caja de herramientas FE (XSD UBL 2.1, Schematron `DIAN-UBL21-model.sch`, listas `.gc`, tablas referenciadas `.xlsx`, ejemplos XML, entre ellos **«Ejemplificacion Propina.xml»** y **«Consumidor Final.xml»**) | «FE_V19_(v2026)» | [CAJA] |
| Anexo Técnico Documento Equivalente Electrónico | **1.0** (1.546 páginas) | [ATDE] |
| Documento soporte a no obligados | **1.1** (art. 1.5.2.5.1 [R227]) | micrositio [DOCTEC] (no lo descargué) |
| RADIAN | **1.1** (art. 1.5.4.7.1 [R227]) | [DOCTEC] |
| Esquemas UBL 2.1 OASIS | 2.1 | http://docs.oasis-open.org/ubl/os-UBL-2.1/ (enlazado desde [DOCTEC]) |

Los documentos UBL que se usan son **Invoice, CreditNote, DebitNote, ApplicationResponse y AttachedDocument** [AT19] cap. 5. Los namespaces propios son `sts = dian:gov:co:facturaelectronica:Structures-2-1` y XAdES `http://uri.etsi.org/01903/v1.3.2#` [AT19] 5.3.1.

### 2.2 CUFE (factura) — [AT19] 11.2
```
CUFE = SHA-384( NumFac + FecFac + HorFac + ValFac
              + "01" + ValIva + "04" + ValInc + "03" + ValIca
              + ValTot + NitOFE + NumAdq + ClTec + TipoAmbiente )
```
- `NumFac` = prefijo + número (`/Invoice/cbc:ID`). `FecFac` = `IssueDate`. `HorFac` = `IssueTime` **con zona** (p. ej. `10:53:10-05:00`).
- Los valores llevan punto decimal y **2 decimales truncados**, sin separadores de miles. Un impuesto ausente va como `0.00`. `ValFac` = `LineExtensionAmount`; `ValTot` = `PayableAmount`.
- NIT emisor y adquirente sin DV ni puntos. `ClTec` = clave técnica del rango, **no va en el XML**; se obtiene con `GetNumberingRange`. **Cada rango nuevo trae una clave técnica distinta** [AT19] 11.6.
- `TipoAmbiente` = `ProfileExecutionID`: **1 = producción, 2 = pruebas** [CAJA] tabla 13.1.1.
- El resultado va en `/Invoice/cbc:UUID` con `@schemeName="CUFE-SHA384"`. La regla **FAD06** rechaza el documento si el CUFE está mal calculado [AT19] 8.2.
- Hay un ejemplo verificable en [AT19] p. 657 (resultado `8bb918b1…bd9b4`): sirve como **prueba unitaria**.

### 2.3 CUDE
- **Notas crédito y débito, y factura tipo 03 (transcripción):** misma cadena, pero con **`Software-PIN`** en lugar de `ClTec` [AT19] 11.4 (ejemplo en p. 662).
- **Documento equivalente POS y sus notas de ajuste:** misma estructura con **`SfPin`** (PIN del software) [ATDE] 14.1.3. Algoritmo `CUDE-SHA384` [ATDE] 16.2.
- **ApplicationResponse (eventos):** cadena distinta (número del evento, fecha, hora, NIT emisor y receptor, `ResponseCode`, ID y tipo del documento referenciado, PIN) [AT19] 11.5.

### 2.4 SoftwareSecurityCode — [AT19] 11.8
`SoftwareSecurityCode = SHA-384( IdSoftware + PIN + NroDocumento )`, donde `NroDocumento` es el `cbc:ID` del documento. El IdSoftware y el PIN son secretos: se guardan como credenciales.

### 2.5 Código QR — [AT19] 11.7
- Contenido: `NumFac, FecFac, HorFac, NitFac, DocAdq, ValFac, ValIva, ValOtroIm, ValTolFac, CUFE` y la URL. La misma URL va en `sts:DianExtensions/sts:QRCode`.
- URL: habilitación `https://catalogo-vpfe-hab.dian.gov.co/document/searchqr?documentkey={CUFE/CUDE}`; producción `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey={CUFE/CUDE}` [AT19] 11.7.1.
- Tamaño mínimo **2 cm**, en **todas las páginas** de la representación gráfica [AT19] p. 676.

### 2.6 Firma XAdES-EPES — [AT19] supl. A (cap. 10)
- XMLDSig **enveloped**, formato **XAdES-EPES** (ETSI TS 101 903 v1.2.2/1.3.2/1.4.1). Va en `ext:UBLExtensions/ext:UBLExtension/ext:ExtensionContent/ds:Signature` y lleva la cadena completa de certificados en `ds:X509Data`.
- Algoritmos de firma: **rsa-sha256 / rsa-sha384 / rsa-sha512** (`http://www.w3.org/2001/04/xmldsig-more#…`). **rsa-sha1 se rechaza.** Digest sha256 o sha512. Canonicalización `http://www.w3.org/TR/2001/REC-xml-c14n-20010315`.
- Se firman tres referencias: el documento (`URI=""` + transform enveloped), `KeyInfo` y `SignedProperties`.
- Política de firma: `SigPolicyId/Identifier = https://facturaelectronica.dian.gov.co/politicadefirma/v2/politicadefirmav2.pdf`; descripción «Política de firma para facturas electrónicas de la República de Colombia»; hash de la política en sha256 o sha512.
- `xades:SignerRole` = `supplier` (el propio facturador) o `third party` (un proveedor tecnológico).
- El certificado debe venir de una **ECD acreditada por ONAC**, con *Key Usage* **Digital Signature + Non Repudiation**, emitido en SHA-2 (después del 30-sep-2016). El `SigningTime` debe caer **dentro de la vigencia del certificado**.

### 2.7 Servicios web — [AT19] cap. 7
| Método | Uso | Notas |
|---|---|---|
| `SendBillSync` | Envío **síncrono de 1 documento** (ZIP con un único XML). Respuesta en la misma conexión. | Es el método de producción para FE, notas y **contingencias 03 y 04** [AT19] 12.1–12.2. El DE POS **también usa SendBillSync** y se transmite **uno a uno** [ATDE] cap. 4 y 9.2. |
| `SendBillAsync` | Lote de **hasta 50** documentos en un ZIP; devuelve `zipKey`/TrackId. | Se consulta con `GetStatusZip`. |
| `SendTestSetAsync` | **Solo en habilitación.** ZIP + `testSetId` (36 caracteres). | Se consulta con `GetStatusZip` [AT19] 7.9; [ATDE] 9.5. |
| `GetStatus` | Estado por CUFE o TrackId. | `StatusCode`: 66 = NSU no encontrado, 90 = TrackId no encontrado, 99 = errores en campos obligatorios [AT19] 7.11. |
| `GetStatusZip` | Estado de un lote o set por `zipKey`. | |
| `GetNumberingRange` | Rangos autorizados y **clave técnica**. Parámetros `accountCode`, `accountCodeT` y `softwareCode`. | [AT19] 7.15 |
| `SendEventUpdateStatus` | Envío de eventos (ApplicationResponse). | |
| `GetXmlByDocumentKey`, `GetExchangeEmails`, `GetStatusEvent`, `GetReferenceNotes` | Descargar XML por CUFE, consultar correos de recepción, eventos de una factura y notas asociadas. | GetStatusEvent y GetReferenceNotes son nuevos en la v1.9. |
| `GetAcquirer` | Completar datos del adquirente a partir del tipo y número de documento. | [GUIAWS] |

- **Transporte y seguridad:** SOAP **1.2** document/literal, **TLS 1.2 con autenticación mutua por certificado**, **WS-Security 1.0 con X.509 Certificate Token Profile 1.1**, `wsu:Timestamp` y WS-Addressing (`wsa:Action`, `wsa:To`) [AT19] 7.5–7.6; [GUIAWS].
- **Nombres de archivo:** `fv|nc|nd|ar|ad` + NIT a 10 dígitos + `ppp` (**000 = software propio**) + año a 2 dígitos + consecutivo hexadecimal de 8 dígitos que **se reinicia cada 1 de enero**; el ZIP empieza con `z…` [AT19] 6.5.7–6.5.8.
- **URLs de los endpoints:** la DIAN dice que la URL del WS «estará expuesta en el catálogo de participante (habilitación o producción), opción Participants → Facturador» [GUIAWS]. Las que se usan en la práctica (`https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc` y `https://vpfe.dian.gov.co/WcfDianCustomerServices.svc`) **quedan sin confirmar en un documento oficial**: solo las vi en librerías de terceros. Hay que tomarlas del catálogo al habilitarse.

---

## 3. Catálogos y reglas (tablas de la caja de herramientas [CAJA])

### 3.1 Códigos clave
| Catálogo | Valores relevantes |
|---|---|
| **Tributos** (13.2.2) | 01 IVA · 02 IC · **03 ICA** · **04 INC** · 05 ReteIVA · 06 ReteRenta · 07 ReteICA · 08 IC porcentual · 21 Timbre · **22 INC bolsas** · 32 ICL · 33 INPP · 34 IBUA · 35 ICUI · 36 ADV · ZZ otros |
| **Tarifas** (13.3.11) | IVA: 0 (exento), 5, 16, **19**. Los ítems **excluidos no se reportan en TaxTotal**. INC: 2, 4, **8**, 16. |
| **Tipo de documento** (13.1.3) | 01 FE · 02 exportación · **03 transcripción por contingencia del emisor** · **04 FE por contingencia DIAN** · 91 NC · 92 ND · 96 evento |
| **Tipo de documento DE** ([ATDE] 16.3) | **20 POS** · 25 cine · 27 espectáculos · 30 juegos · 35 transporte terrestre · 40 peajes · 45 extracto · 50 aéreo · 55 bolsa · 60 servicios públicos |
| **Tipo de operación FE** (`CustomizationID`, 13.1.5.1) | **10 estándar** · 09 AIU · 11 mandatos · 12 transporte · 14 notarios · 15/16 divisas · (20-REG transitorio, Res. 11/2026) |
| **Tipo de operación DE** ([ATDE] 16.4) | 10 (POS y otros) · 93 nota de ajuste débito · 94 nota de ajuste crédito · 07 contingencia del emisor · 08 contingencia DIAN |
| **Forma de pago** (13.3.4.1) | 1 contado · 2 crédito |
| **Medio de pago** (13.3.4.2) | **10 efectivo** · **48 tarjeta crédito** · **49 tarjeta débito** · 47 transferencia débito bancaria · 42 consignación · 20 cheque · 71 bonos · 72 vales · ZZZ otro (más de 70 códigos) |
| **Documento de identidad** (13.2.1) | 11 registro civil · 12 tarjeta de identidad · **13 cédula** · 21 tarjeta de extranjería · 22 cédula de extranjería · **31 NIT** · 41 pasaporte · 42 documento extranjero · 47 PEP · 48 PPT · 50 NIT de otro país · 91 NUIP |
| **Responsabilidades** (13.2.6.1) | O-13 gran contribuyente · O-15 autorretenedor · O-23 agente de retención de IVA · O-47 SIMPLE · **R-99-PN no aplica** |
| **Unidades** (13.3.6, unos 360 códigos UN/ECE) | **94 = unidad**. Los ejemplos de la DIAN usan **NIU**. KGM, LTR, etc. |
| **Productos** (13.3.5) | 001 UNSPSC · 010 GTIN · 020 partida arancelaria · **999 estándar propio del contribuyente** (útil para el código interno del plato) |
| **Corrección de NC** (13.2.4) | 1 devolución parcial · **2 anulación** · 3 rebaja o descuento · 4 ajuste de precio · 5 pronto pago · 6 volumen |
| **Descuentos y recargos** (13.3.8) | 00 descuento no condicionado · 01 condicionado · 02 recargo no condicionado · **03 recargo condicionado: «se utilizará para informar las Propinas»** |
| **Ambiente** (13.1.1) | 1 producción · 2 pruebas |
| **Errores de contingencia DIAN** (12.2.1) | HTTP 500, 503, 507, 508, 403 |

### 3.2 Consumidor final ([AT19] grupo FAK; [R227] art. 1.5.1.2.2.1 num. 3.3)
`AdditionalAccountID = 2`; `PartyIdentification/cbc:ID = 222222222222` con `@schemeName = 13`; `PartyTaxScheme/cbc:CompanyID = 222222222222`; `RegistrationName = "consumidor final"`; `TaxLevelCode = R-99-PN`. La dirección fiscal es opcional. Hay un ejemplo en «Consumidor Final.xml» [CAJA].

### 3.3 Propina
- **Ley:** es voluntaria; el establecimiento solo puede sugerirla, **máximo 10 %** del servicio, incorporada en la factura con aceptación del consumidor. Antes de expedir hay que **preguntar** si se incluye. Pertenece a los trabajadores de la cadena de servicio (Ley 1935 de 2018, arts. 2 a 5) [L1935].
- **Impuestos:** «En ningún caso la propina, por ser voluntaria, hará parte de la base del impuesto nacional al consumo» (ET arts. 512-9 restaurantes y 512-11 bares) [ET512].
- **XML:** cargo global `cac:AllowanceCharge` con `ChargeIndicator=true`, `AllowanceChargeReasonCode=03`, `AllowanceChargeReason="Propina"`, `MultiplierFactorNumeric` (porcentaje) y `BaseAmount`. Se suma en `LegalMonetaryTotal/ChargeTotalAmount` y en `PayableAmount`, pero **no** en `TaxExclusiveAmount` ni en `TaxInclusiveAmount`; queda **fuera de TaxTotal** («Ejemplificacion Propina.xml» y tabla 13.3.8 [CAJA]). Ojo: en el ejemplo oficial, `BaseAmount` (100000) no es coherente con el 10 % de 1.000.000. Hay que tomar la regla y no copiar el ejemplo.
- Cómo se trata la propina en el **documento equivalente POS** (si usa el mismo código 03): **sin confirmar** (no lo verifiqué en el anexo DE).

### 3.4 INC o IVA para restaurantes (ET)
- INC del **8 %** «sobre todo consumo» en restaurantes, cafeterías, heladerías, panaderías, etc., para consumo en el sitio, para llevar o **a domicilio**. Debe **discriminarse** y estar incluido en la lista de precios (ET 512-1 num. 3 y 512-9) [ET512-1], [ET512].
- **Franquicias:** el INC **no aplica**; causan IVA (ET 512-1 num. 3 in fine) [ET512-1].
- **No responsables de INC:** personas naturales con ingresos de la actividad **< 3.500 UVT** en el año anterior y **un solo establecimiento** (ET 512-13) [ET512]. Siguen obligadas a facturar si lo están por otras razones.
- La base del INC excluye la propina y los alimentos excluidos de IVA vendidos sin transformación (ET 512-9) [ET512].
- En el XML, INC es el tributo **04** al 8.00 %. Entra en el CUFE como `ValImp2`.

### 3.5 Redondeos, tolerancias, moneda e idioma
- Redondeo **round-half-to-even** (NTC 3711). Si los totales no cuadran, la diferencia va en `PayableRoundingAmount`, **el único campo que admite negativos** [AT19] 5.2.1 y 5.2.3.
- **Tolerancia ±2.00** en valores monetarios. En el IVA cobrado se tolera ±$5 para redondear al múltiplo de $10 (DUR 1625 art. 1.3.1.1.1) [AT19] 5.2.1.1–5.2.1.2.
- Todos los valores van **positivos**; las cantidades deben ser > 0 (reglas VLR01 y FAV04b) [AT19] 5.2.3–5.2.4.
- Las **retenciones** (`WithholdingTaxTotal`) **no** se restan del `LegalMonetaryTotal`; los **anticipos** son informativos y no se restan del `PayableAmount` [AT19] 11.9.
- Idioma **español** y moneda **COP** obligatorios en el XML; la representación gráfica puede mostrar además otra moneda o idioma (art. 1.5.1.11.4) [R227].

### 3.6 Reglas de validación
- Cada regla se identifica con un **ID que coincide con el campo** del anexo (p. ej. **FAD06** = CUFE de la factura; FAD09a/b = fecha dentro de la vigencia de la numeración; **FAD09e = fecha de emisión igual a la fecha de firma**; **FAD10 = hora en UTC-05:00**). Las variantes se distinguen con letras (a, b, …).
- El efecto es **R** (rechazo) o **N** (notificación). Un documento queda validado si no falla **ninguna R**. El mensaje se compone como «ID – (R/N) texto» [AT19] 8.1.
- Prefijos: FA (factura), CA (nota crédito), DA (nota débito), AA (eventos), LGC (lógicas), DE… (documento equivalente) [AT19], [ATDE].
- **Cuántas hay:** la DIAN no publica un total. Según mi conteo sobre el texto extraído del anexo v1.9 (cap. 8, pp. 373–635), hay unos **1.200 IDs (≈650 R y ≈550 N)**. Es **una estimación propia, no un dato oficial**.
- Reglas transversales relevantes: **«90 – Documento procesado anteriormente»** (un número se transmite una sola vez); **CTG01** (una factura tipo 04 debe estar firmada dentro de un periodo de contingencia declarado por la DIAN); **VLR01** (sin valores negativos) [AT19] p. 374.

---

## 4. Habilitación en modalidad «software propio»

### 4.1 Pasos (art. 1.5.1.5.1.1 [R227]; [HAB]; [GUIAHAB])
1. **Registro** en el servicio de facturación electrónica (catálogo de participantes) como facturador, con el **correo de recepción** de documentos. Se entra como persona, como empresa (NIT + representante legal) o con certificado.
2. **Configurar el modo de operación «Software propio»**. Se registran el nombre del software, el NIT del fabricante y un **PIN** que define el usuario; la DIAN asigna el **identificador del software** (SoftwareID, un UUID) y el **TestSetId** del set de pruebas [AT19] 7.9.2 y 11.8; [HAB].
3. Tener un **certificado digital propio, vigente y de una ECD autorizada por ONAC** antes de empezar las pruebas [GUIAHAB] p. 12.
4. **Enviar el set de pruebas** por `SendTestSetAsync` (o `SendBillSync`) en **ambiente 2**, con el prefijo y rango de pruebas que da el catálogo (p. ej. `SETP990000000–995000000` en el ejemplo oficial [CAJA]).
5. Al superar el set, el estado pasa de «registrado» a **«habilitado» automáticamente** [R227] num. 3.3.
6. **Pedir la numeración** de FE en el servicio de numeración (MUISCA), con **firma electrónica** habilitada (art. 1.5.1.6.3.1). Hay que pedir un rango **nuevo** para FE y se pueden pedir **rangos de contingencia** (papel o talonario) [GUIAHAB] p. 13.
7. Consultar la **clave técnica** con `GetNumberingRange` en producción y **asociar los prefijos** al software en el catálogo (Participantes → Facturador → Asociar prefijos). El micrositio indica **esperar 2 horas** después de pedir la numeración [HAB].
8. Indicar la **fecha de inicio** de facturación, que **no puede modificarse** después. La DIAN agrega la responsabilidad **52 «Facturador electrónico»** en el RUT [R227] num. 3.6.
9. **El documento equivalente POS tiene habilitación propia** (art. 1.5.1.5.1.1, 1er inciso) y la solución gratuita de la DIAN **no** sirve para POS (parágrafo 2). La numeración POS es de tipo «D.E./P.O.S.».

### 4.2 Set de pruebas
| Modo | Documentos | Fuente |
|---|---|---|
| FE software propio o proveedor tecnológico | **8 facturas, 1 nota débito, 1 nota crédito** | Micrositio DIAN [HAB] (actual) |
| FE solución gratuita | 2 FE, 1 ND, 1 NC | [HAB] |
| *Histórico* | 60 FE, 20 NC, 20 ND (guía de habilitación antigua) | [GUIAHAB]. **Hay contradicción con [HAB].** Lo que manda es el número que muestre el catálogo para el TestSetId de cada facturador. |
| **POS electrónico** | **30 documentos equivalentes + 10 notas de ajuste** | Solo fuente secundaria (Alegra) [ALEGRA]: **sin confirmar** en una fuente oficial. |

**Plazos:** no encontré un plazo máximo oficial para completar el set. Para POS, la habilitación debe hacerse **antes** de la fecha de implementación (art. 1.5.1.5.1.1) [R227].

### 4.3 Resolución de numeración (arts. 1.5.1.6.x [R227])
- La numeración se compone de **consecutivo + prefijo (hasta 4 caracteres alfanuméricos) + número, fecha y vigencia de la autorización**. Los **prefijos son obligatorios** cuando hay más de un establecimiento o punto de venta. **No se pueden anteponer ceros** que no hagan parte del rango.
- **Vigencia:** máximo y mínimo **2 años**. Se puede habilitar una prórroga **15 días hábiles** antes del vencimiento. Hay que pedir una nueva autorización **antes de agotar** el rango.
- **Un documento rechazado no consume el consecutivo.** Si el consecutivo se consumió y el documento no se validó, se inhabilita ese número, se conserva la trazabilidad y se usa el siguiente, sin trámite (arts. 1.5.1.5.4.1 par. 3 y 1.5.1.6.3.1 par.).
- Si la numeración se agota durante una caída de la DIAN, se puede usar **numeración autónoma** y regularizarla después (art. 1.5.1.6.1.1).

---

## 5. Validación previa y entrega al adquirente

- **Regla general:** la factura y el documento equivalente **solo se entienden expedidos cuando la DIAN los valida *y* se entregan al adquirente** (ET 616-1 [ET616]; art. 1.5.1.2.2.1 num. 6 y 1.5.1.3.2.4 num. 6 [R227]). **No se pueden entregar antes de validarse**, salvo en la contingencia por falla de la DIAN (tipo 04 / 08), que se describe abajo.
- **Tiempos:** no hay un plazo fijo entre generación y transmisión en operación normal. Lo que impone el anexo es: **fecha de emisión igual a la fecha de firma** (FAD09e), la hora en −05:00 y la validación previa a la expedición. Un plazo máximo explícito de generación a transmisión fuera de contingencia queda **sin confirmar**. Las excepciones con 48 h son las contingencias, los servicios públicos facturados en sitio y el transporte aéreo con GDS (art. 1.5.1.5.2.1) [R227].
- **Demoras de la DIAN:** una respuesta que tarde más de **1 minuto** o dé *timeout* es una «demora»: se reintenta cada **2 minutos, hasta 5 intentos**, y si persiste se declara la **contingencia tipo 04** [AT19] 12.4.
- **Qué se entrega** (art. 1.5.1.5.5.1 [R227]; [AT19] 6.4):
  - Un **AttachedDocument** (contenedor), firmado, con el XML de la factura y el **ApplicationResponse «Documento validado por la DIAN»**, más la **representación gráfica** (PDF u otro formato abierto, imprimible, con el QR).
  - Si el adquirente es **facturador electrónico:** se envía al correo que registró en la DIAN (lista pública [DOCTEC], servicio `GetExchangeEmails`) o por acuerdo entre servidores.
  - Si **no es facturador:** se envía por el medio que indique (correo con PDF, o con XML + PDF en el contenedor) o se entrega **impresa la representación gráfica**. Si no indica medio, **impresa** (num. 2.5).
  - La representación gráfica debe incluir como mínimo los numerales 1–5, 8–13, 15, 16 y 18 del art. 1.5.1.2.2.1. En el POS, además, el nombre y la identificación del adquirente si este quiere usarla como soporte de costos.
- Las **notas** crédito y débito se entregan por el mismo medio que la factura (art. 1.5.1.5.6.1).

---

## 6. Contingencia

| Tipo | Causa | Qué se hace | Plazo para transmitir | Numeración | Fuente |
|---|---|---|---|---|---|
| **FE – emisor (tipo 03)** | Falla del facturador ya habilitado | Mientras dure, expedir **factura de talonario o de papel**, a mano o generada por sistema. **Enviar una carta firmada por el representante legal** a `contingencia.facturadorvp@dian.gov.co` (asunto «NIT-DV; Nombre»), al iniciar y al superar la falla. Después **transcribir cada factura de papel como «factura tipo 03»** (con CUDE y PIN) y enviarla por `SendBillSync`. | **48 horas** siguientes al momento en que se supera el inconveniente | **Rango de contingencia** (papel) autorizado por la DIAN; las verificaciones de rango se hacen contra esa numeración [AT19] p. 662 | [R227] 1.5.1.5.7.1 num. 1.1; [AT19] 12.1 |
| **FE – DIAN (tipo 04)** | Errores 500/503/507/508/403 o demora declarada | Reintentar **a los 5 s, dos veces más cada 5 s (15 s en total)**. Si persiste, **regenerar el documento con `InvoiceTypeCode=04`, el mismo prefijo y número, volver a firmarlo** y entregarlo en un AttachedDocument **sin ApplicationResponse**. Guardar evidencia. Revisar el servicio a los **30 min** y seguir monitoreando. | **48 horas** contadas a partir del **día siguiente** al restablecimiento (Res. 227) o desde que se detecta el servicio activo (anexo), por `SendBillSync`. La DIAN usa `SigningTime` para comprobar que cae en un periodo de contingencia (regla CTG01). | **La misma numeración de FE** | [ET616]; [R227] 1.5.1.5.3.2 y 1.5.1.5.7.1 num. 1.3; [AT19] 12.2 |
| **POS – emisor (tipo 07)** | Falla del emisor | **Documento equivalente físico** (sin los requisitos propios del electrónico: nums. 10–13 y 15). Carta al mismo correo. Luego generar el XML y transmitirlo. | **48 horas** desde que se supera la falla; conservar los soportes | | [R227] 1.5.1.3.2.6 y 1.5.1.5.7.1 num. 2.2; [ATDE] 15.1 |
| **POS – DIAN (tipo 08)** | Falla de la DIAN | Igual que la tipo 04, con código **08**. El anexo lo pone a la vez en `InvoiceTypeCode` (15.2) y en la lista de `CustomizationID` (16.4): **el anexo es inconsistente, así que hay que confirmarlo en pruebas**. | **48 horas** desde el restablecimiento | El **mismo consecutivo** autorizado | [R227] 1.5.1.5.7.1 num. 2.1; [ATDE] 15.2 |

- **Las notas crédito y débito, las notas de ajuste y los ApplicationResponse no tienen esquema de contingencia:** se emiten cuando se normaliza el servicio [AT19] 12.1–12.4; [ATDE] 15.
- La factura de papel **solo vale** si hubo un inconveniente tecnológico del emisor, y la factura sin validación **solo vale** si hubo una falla de la DIAN (art. 1.5.1.5.9.3 par.) [R227].
- **SIMPLE:** quien se inscribe en el régimen SIMPLE puede usar la contingencia del emisor durante **máximo 2 meses** desde la inscripción (art. 1.5.1.2.1.1) [R227].

---

## 7. Conservación

- La Res. 227 (art. 1.5.1.11.2) remite al **ET art. 632** y a la **Ley 962 de 2005, art. 46** (modificado por la Ley 1819 de 2016, art. 304). También exige **accesibilidad para consulta posterior** y las condiciones de los **arts. 12 y 13 de la Ley 527 de 1999** sobre conservación de mensajes de datos: integridad, formato original y datos de origen, fecha y hora [R227].
- **ET 632:** mínimo **5 años** desde el 1 de enero del año siguiente a su expedición [ET632]. **Ley 962 art. 46 (vigente):** el periodo es **el mismo término de firmeza de la declaración**, por regla general **3 años** (ET 714, más largo con pérdidas fiscales o saldos a favor), y la conservación es **en el domicilio principal** [L962], [ET714].
- **Ley 962 art. 28:** los **libros y papeles del comerciante** se conservan **10 años** desde el último asiento, en papel o en medio electrónico que garantice su reproducción exacta [L962].
- **Recomendación práctica:** conservar **10 años** el **XML firmado original**, el **ApplicationResponse** de la DIAN, el AttachedDocument entregado, las evidencias de contingencia (errores, cartas, facturas en papel) y la trazabilidad de consecutivos inhabilitados. El XML es el que **tiene valor legal**; la representación gráfica es solo una imagen (art. 1.5.1.11.4 par.) [R227].

---

## 8. Sanciones

| Conducta | Sanción | Fuente |
|---|---|---|
| No transmitir en debida forma los documentos del sistema de facturación | ET **651** (remisión expresa del ET 616-1): multa de hasta **7.500 UVT**; 1 % de lo no suministrado, **0,7 % de lo erróneo**, 0,5 % de lo extemporáneo; además, **desconocimiento de costos e IVA descontable**. Reducción al 50 % o al 70 % si se subsana. | [ET616], [ET651] |
| Expedir **sin requisitos** (literales a, h, i del art. 617) | ET **652**: **1 %** de las operaciones facturadas sin requisitos, **máximo 950 UVT** (≈ $49,76 millones en 2026); también aplica cuando falta el NIT. La reincidencia lleva a clausura. | [ET652], [UVT] |
| **No facturar** o facturar sin los requisitos de los literales b–g del art. 617 | ET **652-1 / 657**: **clausura de 3 días** («CERRADO POR LA DIAN»). Se puede reemplazar por una multa del **5 % de los ingresos operacionales del mes anterior**. | [ET652] |
| **Supresión de ventas** en POS (phantomware, zappers), doble facturación o facturas que no aparecen en la contabilidad | Clausura de 3 días o multa del **10 %** de los ingresos del mes anterior (ET 657 num. 2 y par. 5–6). **Relevante para el diseño:** la anulación de ventas debe dejar rastro. | [ET652] |
| Incumplir sistemas técnicos de control | Clausura de 3 días o multa del 10 % (ET 657 num. 5). | [ET652] |
| Usar numeración repetida o elaborar facturas sin requisitos (quien las elabora) | Clausura de 1 día (ET 616-3). | [ET616] |

---

## 9. Requisitos técnicos que suelen pasarse por alto

1. **Reloj:** el `SigningTime` debe estar **sincronizado con la hora legal colombiana** (INM/SIC, http://horalegal.inm.gov.co/) [AT19] 10.11. **IssueDate debe ser igual a la fecha de firma** (FAD09e), la hora va en **−05:00** (FAD10) y la DIAN lo controla contra un reloj atómico [AT19] 5.7.1. **Hay que generar las fechas en `America/Bogota`, no en UTC**: una venta a las 19:30 hora de Colombia ya es «mañana» en UTC.
2. **Unicidad:** cada número (prefijo + consecutivo) se transmite **una sola vez** (regla 90). Los reintentos deben ser **idempotentes**: antes de reenviar, consultar `GetStatus` con el CUFE. El CUFE depende de la clave técnica del rango y del ambiente, así que **cambiar de ambiente o de rango cambia el CUFE**.
3. **Truncar, no redondear,** al armar la cadena del CUFE/CUDE (2 decimales truncados). Para los montos del XML se usa **round-half-to-even**. Son dos reglas distintas.
4. **Secretos por rango:** guardar la clave técnica por rango (cambia con cada rango nuevo), el PIN y el SoftwareID. El CUDE usa el PIN; el CUFE usa la clave técnica.
5. **Documentos referenciados:** la NC/ND debe llevar el **prefijo, número, CUFE y fecha** de la factura (`BillingReference`) y el **concepto** (13.2.4). **La anulación de una factura es una NC con concepto 2.** No se permiten notas sobre notas. El número de la factura anulada **no se reutiliza** (art. 1.5.1.5.6.1). Hay NC sin factura de referencia para casos en que no se puede identificar (parágrafo 1; ejemplos en [CAJA]).
6. **Domicilios:** si el cliente es «consumidor final» o se identifica con cédula y la venta es fuera del local, hay que poner la **dirección de entrega** (art. 1.5.1.2.2.1 num. 3).
7. **Prefijos por punto de venta:** son obligatorios con más de un local o punto de venta. Cada prefijo se asocia a un software en el catálogo.
8. **Ambientes:** `ProfileExecutionID`, `UUID@schemeID` y la URL del QR deben ser coherentes (1 = producción, 2 = habilitación).
9. **Certificados:** hay dos usos: **TLS mutuo y WS-Security** para el transporte, y **XAdES** para el documento. Hay que vigilar el vencimiento, porque un `SigningTime` fuera de la vigencia del certificado se rechaza. Usar SHA-256 o superior.
10. **Firma y canonicalización:** después de firmar no se puede reformatear el XML (espacios, *pretty print*, BOM). El AttachedDocument se **firma aparte**.
11. **Las representaciones gráficas solo pueden mostrar lo que está en el XML** [AT19] 5.8. El QR va en todas las páginas y mide al menos 2 cm.
12. **El ZIP de SendBillSync lleva exactamente 1 XML.** Un lote asíncrono lleva como máximo 50. El consecutivo de archivos se reinicia cada 1 de enero.
13. **Contingencia 04:** se **vuelve a firmar** el mismo número con el tipo 04. Hay que conservar los dos XML y las evidencias de error.
14. **Propina:** va como **cargo** y nunca dentro de la base de INC o IVA ni en TaxTotal. Debe quedar la **aceptación del cliente** en la cuenta (Ley 1935).
15. **Ítems excluidos de IVA** no se reportan en TaxTotal; los **exentos** van al 0 %. Bolsas plásticas: tributo 22.
16. **Datos personales:** al comprador solo se le puede pedir nombre, identificación y correo. El servicio `GetAcquirer` solo se usa uno a uno, en el momento de la venta, y **nunca de forma masiva** (art. 1.5.1.12.4).
17. **Restaurante como comprador a crédito:** enviar los eventos **030 y 032** a las facturas de los proveedores para poder deducir costos e IVA. Sin ellos, la factura no soporta costos (ET 616-1).
18. **Compras a no obligados** (campesinos, plazas de mercado): exigen **documento soporte electrónico** con **su propia numeración autorizada antes** de la operación (art. 1.5.1.6.2.2 par.).
19. **Monitoreo del servicio DIAN:** hay que implementar la máquina de estados de contingencia, con reintentos de 5 s y 2 min, chequeo cada 30 min y una cola para transmitir en las 48 h.

---

## 10. Puntos sin confirmar o contradictorios

- **Tope de 5 UVT del POS:** el ET 616-1 par. 2 (ley) lo mantiene «según el calendario que expida la DIAN». La Res. 227 y el comunicado DIAN 009/2024 dicen que el POS electrónico no tiene tope. No encontré un pronunciamiento judicial.
- **Set de pruebas FE:** el micrositio actual dice 8 FE + 1 ND + 1 NC; la guía antigua decía 60 + 20 + 20. **POS:** 30 + 10 según una fuente secundaria.
- **Endpoints SOAP:** no aparecen en el anexo; la DIAN remite al catálogo. Las URLs `vpfe(-hab).dian.gov.co/WcfDianCustomerServices.svc` son de uso común pero no tienen respaldo documental oficial.
- **Código de contingencia DE 07/08:** no queda claro si va en `InvoiceTypeCode` o en `CustomizationID`, porque el anexo es inconsistente.
- **Versiones nuevas de anexos** (FE > 1.9, DE 1.1): no las encontré.
- **Fecha oficial de operación del servicio de consulta del adquirente (GetAcquirer):** no la encontré.
- **Número total de reglas de validación:** solo tengo una estimación propia.
- **Plazo máximo entre generación y transmisión en operación normal:** no encontré ninguno explícito.
- **Tratamiento de la propina dentro del XML del POS:** no lo verifiqué.

---

## Fuentes

- **R227**: https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm — Res. 000227 de 2025 compilada (incluye las modificaciones de la Res. 11 de 2026), Parte 1, Título 5.
- **R227pdf**: https://www.dian.gov.co/normatividad/Normatividad/Resoluci%C3%B3n%20000227%20de%2023-09-2025.pdf
- **R11**: https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0011_2026.htm
- **INCP11**: https://incp.org.co/agendatributariaincp/noticias/2026/04/dian-reglas-para-el-uso-del-mecanismo-transitorio-para-regularizar-facturacion-electronica-omitida/
- **AT19**: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Factura-Electronica-de-Venta-vr-1-9.pdf — Anexo FE v1.9 (753 pp.); las páginas citadas son las del PDF.
- **CAJA**: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Caja-de-herramientas-FE_V19_v2026.zip — tablas referenciadas, ejemplos y XSD.
- **ATDE**: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Documento-Equivalente-Electronico-V1-0-final.pdf — Anexo DE v1.0 (1.546 pp.).
- **DOCTEC**: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/
- **HAB**: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/instructivo-de-registro-y-habilitacion-en-factura-electronica-dian/
- **GUIAHAB**: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Presentacion_habilitacion.pdf
- **GUIAWS**: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Guia-Herramienta-para-el-Consumo-de-Web-Services.pdf — GetAcquirer y configuración de WS-Security.
- **DEEMS**: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documento-equivalente-electronico
- **CP009**: https://www.dian.gov.co/Prensa/Paginas/NG-Comunicado-de-prensa-009-22-01-2024.aspx
- **ET616**: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr025.html — ET arts. 616-1, 616-3.
- **ET512-1**: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr020.html — ET art. 512-1.
- **ET512**: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr021.html — ET arts. 512-8, 512-9, 512-11, 512-13.
- **ET632**: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr026.html — ET art. 632.
- **ET651 / ET652**: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr027.html — ET arts. 651, 652, 652-1, 657.
- **ET714**: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr029.html — ET art. 714.
- **L962**: http://www.secretariasenado.gov.co/senado/basedoc/ley_0962_2005.html — Ley 962 de 2005, arts. 28 y 46.
- **L1935**: http://www.secretariasenado.gov.co/senado/basedoc/ley_1935_2018.html — Ley 1935 de 2018 (propinas).
- **UVT**: https://incp.org.co/publicaciones/infoincp-publicaciones/impuestos/2025/12/dian-fijo-en-52-374-en-valor-de-la-uvt-para-el-ano-gravable-2026/ — UVT 2026 = $52.374 (Res. 000238 de 2025).
- **SAI** (secundaria): https://www.sai-open.com/nueva/facturacion-electronica-colombia-2026-resolucion-000227/
- **ALEGRA** (secundaria): https://e-provider-docs.alegra.com/docs/gu%C3%ADa-del-proceso-de-habilitaci%C3%B3n-en-la-dian-documento-equivalente-pos-electr%C3%B3nico

<!-- Definiciones de enlaces de referencia -->
[R227]: https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm
[R227pdf]: https://www.dian.gov.co/normatividad/Normatividad/Resoluci%C3%B3n%20000227%20de%2023-09-2025.pdf
[R11]: https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0011_2026.htm
[INCP11]: https://incp.org.co/agendatributariaincp/noticias/2026/04/dian-reglas-para-el-uso-del-mecanismo-transitorio-para-regularizar-facturacion-electronica-omitida/
[AT19]: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Factura-Electronica-de-Venta-vr-1-9.pdf
[CAJA]: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Caja-de-herramientas-FE_V19_v2026.zip
[ATDE]: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Documento-Equivalente-Electronico-V1-0-final.pdf
[DOCTEC]: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documentacion-tecnica/
[HAB]: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/instructivo-de-registro-y-habilitacion-en-factura-electronica-dian/
[GUIAHAB]: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Presentacion_habilitacion.pdf
[GUIAWS]: https://www.dian.gov.co/impuestos/factura-electronica/Documents/Guia-Herramienta-para-el-Consumo-de-Web-Services.pdf
[DEEMS]: https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/documento-equivalente-electronico
[CP009]: https://www.dian.gov.co/Prensa/Paginas/NG-Comunicado-de-prensa-009-22-01-2024.aspx
[ET616]: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr025.html
[ET512-1]: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr020.html
[ET512]: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr021.html
[ET632]: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr026.html
[ET651]: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr027.html
[ET652]: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr027.html
[ET714]: http://www.secretariasenado.gov.co/senado/basedoc/estatuto_tributario_pr029.html
[L962]: http://www.secretariasenado.gov.co/senado/basedoc/ley_0962_2005.html
[L1935]: http://www.secretariasenado.gov.co/senado/basedoc/ley_1935_2018.html
[UVT]: https://incp.org.co/publicaciones/infoincp-publicaciones/impuestos/2025/12/dian-fijo-en-52-374-en-valor-de-la-uvt-para-el-ano-gravable-2026/
[SAI]: https://www.sai-open.com/nueva/facturacion-electronica-colombia-2026-resolucion-000227/
[ALEGRA]: https://e-provider-docs.alegra.com/docs/gu%C3%ADa-del-proceso-de-habilitaci%C3%B3n-en-la-dian-documento-equivalente-pos-electr%C3%B3nico
