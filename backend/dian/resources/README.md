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
