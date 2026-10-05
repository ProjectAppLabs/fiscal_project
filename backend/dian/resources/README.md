# Recursos oficiales de la DIAN

Copiados sin cambios de la **caja de herramientas de factura electrónica FE_V19_(v2026)** de la DIAN
(`https://www.dian.gov.co/impuestos/factura-electronica/Documents/Caja-de-herramientas-FE_V19_v2026.zip`,
SHA-256 `22705b20c8478485d956cb61476b0743bb5d16e45c4e5bed11023fc1e04adfea`, descargada el 2026-10-04), carpeta «Listas de valores».

| Archivo | Uso en Fiscal. |
|---|---|
| `TipoIdFiscal-2.1.gc` | Tipo de documento del adquirente |
| `TipoOrganizacion-2.1.gc` | Persona jurídica o natural |
| `TipoResponsabilidad-2.1.gc` | Responsabilidades fiscales (RUT) |
| `TipoImpuesto-2.1.gc` | Tributos (01 IVA, 04 INC…) |
| `TarifaImpuestoIVA-2.1.gc`, `TarifaImpuestoINC-2.1.gc` | Tarifas permitidas |
| `FormasPago-2.1.gc`, `MediosPago-2.1.gc` | Forma y medio de pago |
| `UnidadesMedida-2.1.gc` | Unidad de la cantidad de cada línea (94 = unidad) |
| `Municipio-2.1.gc`, `Departamentos-2.1.gc` | Códigos DANE |
| `TipoMoneda-2.1.gc` | Moneda (COP en la etapa 1) |
| `TipoOperacionF/NC/ND-2.1.gc` | Tipo de operación de factura y notas (`TipoOperacionND` viene en la caja como «TipoOperacionND-2.1 - copia.gc») |
| `ConceptoNotaCredito/Debito-2.1.gc` | Concepto de corrección de las notas |
| `CodigoDescuento-2.1.gc` | Tipo de descuento |
| `TipoAmbiente-2.1.gc` | 1 producción, 2 pruebas |

Al salir una caja de herramientas nueva se reemplazan estos archivos, se actualiza esta tabla con su SHA-256 y se
corren las pruebas de catálogos.

## Esquemas XSD (`xsd/`)

Carpeta `XSD` de la misma caja de herramientas, sin cambios (`common/` y `maindoc/`). `dian/xsd.py` carga el esquema
del documento junto con `DIAN_UBL_Structures.xsd`, para que `sts:DianExtensions` también se valide.

**Inconsistencia conocida de la caja:** `DIAN_UBL_Structures.xsd` tipa `sts:ProviderID` y
`sts:AuthorizationProviderID` con `coID2Type`, cuyo `schemeID` enumera tipos de documento (11, 13, 31…). En cambio, el
anexo FE 1.9 (FAB22) y todos los ejemplos oficiales ponen ahí el dígito de verificación del NIT, así que todos los
ejemplos de factura fallan en ese atributo. `dian/xsd.py` ignora solo ese error exacto. Algunos ejemplos antiguos
también traen un `QRCode` con el formato anterior a la 1.9; el vigente es la URL de consulta (FAB36).

## Ejemplos firmados (`examples/`)

Cuatro XML de la carpeta «Ejemplificaciones/XMLs de ejemplo» de la misma caja, sin cambios, cuya firma XAdES-EPES
verifica completa (las tres referencias y el `SignatureValue`). Los demás ejemplos fueron editados después de firmarse
y su primera referencia ya no coincide. Las pruebas de `dian/signing.py` los verifican: son la prueba de que el C14N y
los resúmenes de Fiscal. son los mismos que usan los firmantes reales.

| Archivo | Original | SHA-256 |
|---|---|---|
| `ConsumidorFinal.xml` | `Consumidor Final.xml` | `3843e998516f1034573d1b2df6954ff3467a0f1883e3f7ee03e4c1687ca514b5` |
| `CreditNote.xml` | `CreditNote.xml` | `479374b5f626453480fbf5fde226cabeb3d88e6ccb0f1c133ce7b90ac6111b06` |
| `DebitNote.xml` | `DebitNote.xml` | `e8617ce3964d497d8aae47f68fd9ece5ccc6187c1ea558da0f2a21542276de04` |
| `GenericaPagoAnticipado.xml` | `GenericaPagoAnticipado.xml` | `909585ddc86268927457acea0f5c9a3543b01b586a3422088de588aa7c7dafb0` |

**Política de firma:** el anexo (§10.10) da la URL `…/politicadefirma/v2/politicadefirmav2.pdf`; 21 ejemplos usan
`…/v1/…`, que ya no responde (404). El SHA-256 del PDF publicado en `v2`, descargado el 2026-10-04, es
`dMoMvtcG5aIzgYo0tIsSQeVJBDnUnfSOfBpxXrmor0Y=` (en base64), igual al que traen los ejemplos.
