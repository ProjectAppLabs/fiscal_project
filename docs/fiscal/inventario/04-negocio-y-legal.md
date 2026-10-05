# «Fiscal.»: aspectos de negocio y legales de la facturación electrónica propia

Investigación del 4 de octubre de 2026. La norma vigente es la **Resolución DIAN 000227 del 23 de septiembre de 2025** (Resolución Única), que en su Título 5 de la Parte 1 compila la **Resolución 000165 de 2023**. Los textos se consultaron hoy en el normograma de la DIAN. Las citas entre comillas son textuales.

> Aviso: esto es una investigación, no una opinión legal. Lo marcado **«sin confirmar»** no pudo comprobarse en una fuente primaria.

Fuentes principales:
- [Resolución 000227 de 2025, compilada (normograma DIAN)](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0227_2025.htm)
- [Resolución 000165 de 2023 (normograma DIAN)](https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0165_2023.htm)
- [Estatuto Tributario (normograma DIAN)](https://normograma.dian.gov.co/dian/compilacion/docs/estatuto_tributario.htm)
- [Decreto 358 de 2020, que sustituye el capítulo de facturación del Decreto 1625 de 2016 (Función Pública)](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=110414)
- [Concepto DIAN 1889 (radicado 015968) del 14 de noviembre de 2025, texto completo (CIJUF)](https://cijuf.org.co/node/28795)
- [Concepto DIAN 13246 (1169) del 1 de agosto de 2025 (normograma DIAN)](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_13246_2025.htm)

---

## 1. La pregunta crítica: ¿«software propio» de cada comercio o proveedor tecnológico?

### Respuesta corta

Si ProjectApp **aloja, opera y ejecuta** en su propio servidor la generación, la firma y la transmisión de los documentos de **muchos** comercios, encaja en la definición reglamentaria de **proveedor tecnológico**. Llamarlo «software adquirido» de cada comercio deja a ProjectApp en una **zona gris**. La DIAN no ha dicho de forma expresa que esté prohibido, y en la práctica no lo detecta ni lo sanciona como tal. Pero varias normas y la doctrina más reciente apuntan a que quien presta ese servicio debe estar habilitado. **La postura más segura** es que ProjectApp **no** opere como intermediario de transmisión sin habilitación. Mientras no sea proveedor tecnológico, hay dos salidas: integrarse con un proveedor tecnológico ya habilitado, o vender un software que de verdad opere el comercio (más abajo).

### Definiciones y artículos

| Norma | Qué dice |
|---|---|
| **ET art. 616-4** ([normograma](https://normograma.dian.gov.co/dian/compilacion/docs/estatuto_tributario.htm)) | «Será proveedor tecnológico, la **persona jurídica habilitada** para generar, entregar y/o transmitir la factura electrónica que cumpla con las condiciones y requisitos que señale el Gobierno nacional.» |
| **Decreto 1625 de 2016, art. 1.6.1.4.1 num. 10** (texto del [Decreto 358 de 2020](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=110414)) | Proveedor tecnológico es la persona jurídica habilitada por la DIAN «para prestar a los sujetos obligados a facturar que sean facturadores electrónicos, los servicios de **generación, transmisión, entrega y/o expedición, recepción y conservación** de las facturas electrónicas de venta». |
| **Res. 227/2025 art. 1.5.1.8.1.1** (antes art. 55 de la Res. 165) | «La generación, transmisión, expedición, entrega y recepción de la factura electrónica de venta […] será realizada **directamente por el facturador electrónico**; lo anterior, sin perjuicio de contratar para tal efecto los servicios de proveedores tecnológicos que hayan sido **previamente habilitados** por la […] DIAN.» Lo mismo dice el Decreto 1625, art. 1.6.1.4.24. |
| **Res. 227/2025 art. 1.5.1.11.1** (antes art. 63 de la Res. 165) | Cuando el obligado cumpla su deber de facturar, generar y transmitir «a través de un tercero, quien deberá estar **previamente autorizado y/o habilitado** según sea el caso por la […] DIAN». |
| **Res. 227/2025 art. 1.5.1.5.1.1 num. 2** (antes art. 28 de la Res. 165) | En la habilitación, el facturador elige su medio de operación: «2.1. Un desarrollo informático propio o desarrollo informático adquirido. 2.2. Al servicio gratuito […] DIAN. 2.3. Al suministrado a través de un proveedor tecnológico». En el num. 3.1 registra el «NIT del fabricante» y el software. Si el fabricante no tiene NIT, basta su identificación. |
| **Res. 227/2025 art. 1.5.1.2.2.1 num. 18** y **art. 1.5.1.3.2.4 num. 10** | La factura y el documento equivalente electrónico deben llevar el nombre y NIT «del **fabricante del software**, el nombre del software y del proveedor tecnológico **si lo tuviere**». La norma distingue entonces fabricante y proveedor tecnológico. |
| **Concepto 13246 de 2025** ([normograma](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_13246_2025.htm)) | Software propio es «el que desarrolla directamente el facturador». Software adquirido es «aquel que le compra a un tercero». |

### Lo que dice el Concepto 1889 (015968) de 2025

Es la doctrina más directa sobre el tema ([texto completo en CIJUF](https://cijuf.org.co/node/28795)):

- **3.1:** el desarrollo propio es el sistema «(i) creado por el obligado a facturar o (ii) adquirido de terceros para **operar exclusivamente bajo su identificación bajo su propia cuenta y riesgo**». En cambio, con un proveedor tecnológico «un tercero habilitado por la DIAN **ejecute con su software** la generación, transmisión y entrega de los documentos electrónicos».
- **3.2:** el facturador elige entre desarrollo propio, «por creación interna o **por adquisición de permisos de uso**», y proveedor tecnológico. La DIAN asocia el ID de software al NIT del facturador.
- **3.6:** el desarrollo propio obliga, entre otras cosas, a «**custodiar adecuadamente los certificados digitales**».
- **3.8:** usar como «propio» un software replicado para muchos usuarios **sin permiso del titular** «en principio no es viable». Si varios contribuyentes usan el mismo software como propio, deben tener los permisos. La DIAN «solo tiene competencias para evaluar los aspectos técnicos».
- **3.10:** «no existe en el ordenamiento tributario un régimen sancionatorio específico aplicable a comercializadoras de software».
- **3.12 y 3.14:** una disputa de licencias **no invalida** las facturas si cumplen los requisitos técnicos.
- **3.17:** «el software adquirido corresponde a una solución comprada que **opera únicamente para dicho NIT**; y el proveedor tecnológico es un tercero habilitado que presta servicios de generación, transmisión y entrega de las facturas electrónicas **por sus propios medios**».

### Las dos posturas

**Postura A: operar para muchos es ser proveedor tecnológico (más segura).**
- La definición del Decreto 1625 coincide con lo que haría Fiscal: generar, transmitir, entregar y conservar para terceros.
- El art. 1.5.1.11.1 exige que el tercero que cumpla el deber formal esté habilitado.
- El Concepto 1889 describe el software adquirido como algo que el comercio opera «exclusivamente», «por su cuenta y riesgo», y que «opera únicamente para dicho NIT». Un servicio multiempresa operado por ProjectApp se parece más al proveedor tecnológico que presta el servicio «por sus propios medios».

**Postura B: es software adquirido bajo licencia (más arriesgada, aunque común en el mercado).**
- La norma reconoce figuras distintas del proveedor tecnológico: el «fabricante del software» y los «proveedores de soluciones tecnológicas». Estos aparecen en la definición de «acceso al software» del Decreto 1625, art. 1.6.1.4.1 num. 1.
- El Concepto 1889 (3.2) admite el desarrollo propio por «adquisición de permisos de uso». También dice que la DIAN solo controla lo técnico y que no hay un régimen sancionatorio para quien comercializa el software.
- En la práctica, muchas casas de software de POS y ERP venden su solución en la nube y cada cliente se habilita como «software propio» con su NIT y su certificado. **Sin confirmar** con una fuente formal: es una observación del mercado.
- Su debilidad es que ninguna norma ni concepto encontrado dice que **un tercero pueda operar y transmitir** a nombre del facturador sin habilitación. Los textos hablan de *adquirir* el software, no de *tercerizar la operación*.

**Qué parece más seguro:**
1. **Corto plazo:** integrar Fiscal con un **proveedor tecnológico habilitado** (por API o marca blanca). La otra opción es que cada comercio **opere de verdad** su instancia: certificado y clave técnica bajo su custodia, licencia de uso documentada y responsabilidad del comercio por escrito. Esa segunda opción sigue siendo gris si el servidor es de ProjectApp.
2. **Mediano plazo:** constituir la SAS y habilitarla como **proveedor tecnológico** cuando cumpla los requisitos.

### Requisitos para ser proveedor tecnológico

Están en la Res. 227/2025, art. 1.5.1.8.1.1, el Decreto 1625, art. 1.6.1.4.24 y el ET, art. 616-4:

1. Ser **sociedad** constituida en Colombia o sucursal de sociedad extranjera. Una persona natural **no** puede serlo: [Concepto DIAN 3156 de 2023](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_3156_2023.htm).
2. Estar inscrito en el RUT.
3. Tener en el **objeto social** la generación, transmisión, expedición, entrega y recepción de la factura electrónica y sus notas.
4. **Patrimonio contable ≥ 20.000 UVT**, con **propiedad, planta y equipo ≥ 10.000 UVT** ubicada en Colombia. Se prueba con estados financieros firmados por el representante legal y el contador o revisor fiscal. Con la UVT de 2026 de **$52.374** ([Res. DIAN 000238 de 2025, según INCP](https://incp.org.co/publicaciones/infoincp-publicaciones/impuestos/2025/12/dian-fijo-en-52-374-en-valor-de-la-uvt-para-el-ano-gravable-2026/)), son **unos $1.047 millones de patrimonio** y **unos $524 millones en PP&E**.
5. **Certificación ISO 27001.** Si no se tiene al solicitar, se puede presentar un compromiso de aportarla dentro de los **18 meses** siguientes a la habilitación.
6. Plan de contingencia y continuidad, actualizado cada año.
7. Estar habilitado como facturador electrónico y facturar electrónicamente sus propias operaciones.
8. Documento de infraestructura física, tecnológica y de seguridad, con la arquitectura, actualizado cada año.
9. Acuerdos de niveles de servicio: incidentes por criticidad y tiempos de respuesta.
10. Canal de peticiones, quejas, reclamos, sugerencias y felicitaciones (PQRSF) con trazabilidad.
11. Personal **profesional titulado** en contabilidad o economía, derecho y tecnología, con conocimiento de UBL, XML y XSD.
12. Autorizar la publicación de su razón social, NIT y correo en el registro de la DIAN.
13. Información y hojas de vida de los representantes, socios, junta directiva y personal.
14. Idoneidad del personal, actualizada cada año antes del 30 de abril.
15. Atender la **visita de verificación** de la DIAN.
16. Superar las **pruebas tecnológicas** del software.

**Procedimiento y plazos** (art. 1.5.1.8.2.1): primero hay que habilitarse como facturador y tener al menos un software activo. La solicitud se hace en línea. La DIAN decide **dentro de los 2 meses** siguientes a la solicitud completa. La habilitación dura **5 años** y es renovable si se pide con al menos 3 meses de anticipación. **No se puede ceder** (parágrafo 2).

**Pólizas:** la norma vigente **no** exige póliza al proveedor tecnológico. Revisé los 16 numerales del art. 1.5.1.8.1.1.

**Cuántos hay:** el catálogo oficial de la DIAN lista **97 proveedores tecnológicos habilitados**, según el archivo «Proveedores-habilitados-31082026» ([micrositio DIAN](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/proveedores-tecnologicos/)). El conteo lo hizo una herramienta automática sobre la página: conviene confirmarlo descargando el archivo.

**Costos aproximados:**
- El trámite ante la DIAN no tiene tarifa conocida (**sin confirmar**).
- El costo real está en el patrimonio exigido, la ISO 27001, el personal titulado, la infraestructura y la operación 24/7.
- Para la ISO 27001 solo encontré una referencia internacional: entre USD 5.000 y 15.000 para empresas pequeñas, sumando auditoría y consultoría ([Xantrion](https://www.xantrion.com/article/iso-27001-certification-cost)). **No hay cifra colombiana confirmada.**

**Sanciones propias del proveedor tecnológico:** el ET, art. 616-4 num. 2, lista las infracciones. Entre ellas: no transmitir, generar sin requisitos e incumplir los niveles de servicio. El **art. 684-4** castiga la reiteración con la **prohibición de contratar con clientes nuevos** durante 1 año, o 2 si hay reincidencia. Además, la DIAN puede cancelar la habilitación (art. 1.5.1.8.2.2).

---

## 2. Persona natural y pruebas con el NIT de otro

- **¿Puede una persona natural habilitar «software propio»?** Sí. El Concepto 1889 (3.7) dice: «toda persona natural o jurídica que pretenda actuar como facturador electrónico deberá efectuar su registro […] y cumplir con las etapas del proceso de habilitación». El art. 1.5.1.5.1.1 no limita el desarrollo propio a personas jurídicas.
  - Gustavo, como persona natural que presta servicios, probablemente ya está **obligado** a facturar (art. 1.5.1.1.3.3). Las excepciones del art. 1.5.1.1.3.4 se aplican, por ejemplo, a algunos no responsables de IVA. Aun si no estuviera obligado, el parágrafo 1 de ese artículo le permite **optar** por facturar cumpliendo los requisitos.
  - **Cuidado:** al terminar la habilitación hay que indicar la fecha en que empieza la obligación de facturar electrónicamente. Esa fecha «**no podrá ser modificada**», y la DIAN agrega al RUT la responsabilidad 52, «Facturador electrónico» (art. 1.5.1.5.1.1, num. 3.6). Si ya es facturador electrónico con otra solución, se puede **agregar** otro software, porque la norma habla de «el o los» medios de operación.
  - La persona natural sirve para probar la parte técnica. **No sirve** para ser proveedor tecnológico, que exige sociedad.
- **¿Se puede usar el NIT de una SAS amiga solo en habilitación?** La norma no prohíbe que el facturador use un software de un tercero. Pero las pruebas se hacen **en la cuenta del facturador**: su representante legal entra con sus credenciales en el portal de la DIAN y registra el software bajo ese NIT. Por eso:
  - Los documentos de prueba no tienen efecto fiscal. Aun así, el software queda **asociado al NIT de la SAS**, y si se termina la habilitación se fija la fecha y la responsabilidad 52 de esa SAS. **Sin confirmar** si se puede dejar la habilitación a medias sin efectos.
  - Conviene una **autorización escrita** del representante legal de la SAS que diga el alcance (solo pruebas en habilitación, software y fechas). También un **acuerdo de confidencialidad y uso de datos** y el compromiso de **no** pedir numeración de producción ni fijar una fecha que la SAS no quiera.
  - Lo más limpio es que la SAS haga los clics con su usuario y ProjectApp aporte el software como **fabricante**, con su identificación en el campo correspondiente del num. 3.1.

---

## 3. Certificado digital de firma

- **Requisito:** la factura electrónica lleva «la firma digital **del facturador electrónico** de acuerdo con las normas vigentes y la política de firma establecida por la […] DIAN» (Res. 227/2025, art. 1.5.1.2.2.1 num. 14). El documento equivalente lleva «la firma digital **del emisor**» (art. 1.5.1.3.2.4 num. 13).
- **¿Puede firmar el proveedor?** Según los resultados de búsqueda sobre el [Anexo Técnico 1.9](https://www.dian.gov.co/impuestos/factura-electronica/Documents/Anexo-Tecnico-Factura-Electronica-de-Venta-vr-1-9.pdf), el **proveedor tecnológico** puede ser «el firmante autorizado por el facturador electrónico a actuar en su nombre». Así venía desde el Decreto 2242 de 2015: la firma podía ser del proveedor tecnológico si el obligado lo autorizaba expresamente. **Sin confirmar** la sección exacta del anexo vigente: no pude extraer el texto del PDF.
  - En **software propio o adquirido**, el certificado debe ser **del comercio** (persona natural o jurídica). El Concepto 1889 (3.6) pone en el facturador la custodia de sus certificados.
  - Un operador **no habilitado** no debería firmar con su propio certificado documentos de terceros.
- **Entidades de certificación acreditadas por ONAC:** Certicámara, GSE, Andes SCD, Camerfirma Colombia y Thomas Signe aparecen como entidades autorizadas ([POS Colombia, abril de 2026](https://poscolombia.com/blog/certificado-digital-dian-donde-comprar-cuanto-cuesta); [Viafirma](https://www.viafirma.com/en/digital-certificacion-entities-in-colombia/), que menciona nueve entidades y a Viafirma acreditada desde marzo de 2025). **Sin confirmar** contra el directorio oficial de ONAC, que no consulté directamente.
- **Precios aproximados** (no oficiales, varían):

  | Fuente | Precio | Nota |
  |---|---|---|
  | [POS Colombia (abril 2026)](https://poscolombia.com/blog/certificado-digital-dian-donde-comprar-cuanto-cuesta) | $120.000 a $180.000 por año | No distingue persona natural de jurídica |
  | [Camerfirma, tienda](https://shop.camerfirma.com.co/certificado-de-factura-electronica) | $196.350 | Entrega en 24 a 48 horas. Hoy aparece «no disponible» |
  | [Sensiyo](https://sensiyo.co/certificados-digitales/) | $130.000 por 1 año; $210.000 por 2 años | Según el resultado de búsqueda |
  | [Uanataca/GSE, política tarifaria](https://www.uanataca.co/documentosGES/GES-PO-05_Politica_Tarifaria.pdf) | $265.000 al año, persona jurídica, con videoidentificación | Dato del resumen de búsqueda; **sin confirmar** porque no pude leer el PDF |
  | Certicámara y Andes SCD | **sin confirmar** | Hay que pedir cotización |

- **Tiempos de emisión:** de horas a 48 horas tras la validación de identidad (Camerfirma y POS Colombia). **Sin confirmar** para Certicámara y Andes.
- **Alternativa gratuita:** la DIAN da firma gratuita **solo** dentro de su solución gratuita, que **no aplica** al documento equivalente electrónico (art. 1.5.1.5.1.1, parágrafo 2). No sirve para un software propio.

---

## 4. Responsabilidad si un documento sale mal o no se transmite

**Ante la DIAN la obligación es del comercio.**
- ET art. 616-1: «la responsabilidad de la entrega de la factura electrónica de venta para su validación, así como la expedición y entrega al adquiriente, una vez validada, **corresponde al obligado a facturar**».
- Res. 227/2025, art. 1.5.1.8.1.1, parágrafo 3: aun con proveedor tecnológico, «el obligado a facturar electrónicamente y el adquirente son los responsables ante la […] DIAN, por las obligaciones sustanciales y formales». Esto es sin perjuicio de las sanciones del art. 684-4 al proveedor.
- ProjectApp, si no es proveedor tecnológico habilitado, no tiene un régimen sancionatorio tributario propio (Concepto 1889, 3.10). Su riesgo es **contractual y civil** frente al comercio.

**Sanciones al comercio** (ET, normograma DIAN):

| Conducta | Artículo | Sanción |
|---|---|---|
| No transmitir en debida forma | 616-1, que remite al **651** | Multa de hasta 7.500 UVT, unos $393 millones en 2026: 1 % de lo no informado, 0,7 % si hay errores, 0,5 % si es extemporáneo |
| Expedir sin los requisitos de los literales a, h o i del art. 617 | **652** | 1 % de las operaciones facturadas sin requisitos, **sin exceder 950 UVT**, unos $49,8 millones |
| No facturar | **652-1** | Remite a la clausura de los arts. 657 y 658 |
| No expedir factura, expedirla sin otros requisitos o reincidir | **657** | **Cierre del establecimiento por 3 días**, con sello «CERRADO POR LA DIAN» |
| Reducción de sanciones | **640** | Rebajas al 50 % o al 75 % según reincidencia |

Además, sin factura validada el **comprador pierde** costos, deducciones e IVA descontable (ET 616-1 y 771-2, citados en el Concepto 1889, 3.15). Esto pesa en la factura electrónica de venta. El tiquete POS no da esos derechos (ET 616-1, parágrafo 2).

**Contingencia:** si la caída es de la DIAN, se puede expedir sin validación previa y transmitir dentro de las **48 horas** siguientes al restablecimiento (ET 616-1). El proveedor tecnológico debe avisar a sus clientes de sus propios inconvenientes (Res. 227, parágrafo 2 del artículo de contingencias). **Sin confirmar:** no verifiqué el número exacto de ese artículo.

**Cláusulas que conviene tener en los términos del servicio:**
- Qué hace ProjectApp (software y operación técnica) y qué conserva el comercio: la **obligación tributaria** y la veracidad de los datos (NIT del comprador, impuestos, tarifas). El comercio también responde por la vigencia de su certificado y de su resolución de numeración.
- **Niveles de servicio:** disponibilidad, tiempo máximo de transmisión, reintentos y avisos de rechazo, procedimiento de contingencia y quién transmite después.
- **Límite de responsabilidad**, por ejemplo hasta lo pagado en los últimos 12 meses, y exclusión del lucro cesante. No puede cubrir **dolo ni culpa grave**: CC art. 1522, «la condonación del dolo futuro no vale», y la doctrina extiende la regla a la culpa grave ([Asuntos Legales](https://www.asuntoslegales.com.co/consultorio/clausulas-limitativas-y-exonerativas-de-responsabilidad-contractual-3841675); [vLex](https://vlex.com.co/vid/4-clausulas-limitativas-exonerativas-972354425)). Las cláusulas abusivas en contratos de adhesión podrían discutirse ante la SIC. **Sin confirmar** si el Estatuto del Consumidor aplica a comercios pequeños como consumidores.
- **Indemnidad** del comercio por fallas atribuibles al software, y de ProjectApp por datos falsos o mal configurados por el comercio.
- **Modo de operación declarado:** que el comercio confirme bajo qué modalidad se habilitó. El Concepto 1889 (3.2) le asigna esa verificación.
- **Licencia de uso** del software, porque la DIAN ve el «desarrollo propio» como creación o «adquisición de permisos de uso».
- Custodia del certificado y de la clave técnica, conservación y entrega de los XML al terminar el contrato, portabilidad, y aviso previo de terminación (por ejemplo 3 meses, como exige la DIAN al proveedor tecnológico que se retira).
- Encargo de tratamiento de datos (punto 5).

**Pólizas usuales:** en el mercado tecnológico son comunes la de **responsabilidad civil profesional (errores y omisiones)** y la de **riesgos cibernéticos**. La DIAN no las exige. **Sin confirmar** los precios y coberturas en Colombia: hay que cotizar con un corredor.

---

## 5. Protección de datos (Ley 1581 de 2012)

- **Qué datos hay:** la factura electrónica de venta a nombre de una persona natural incluye nombre, número de identificación, correo y a veces teléfono y dirección. Son datos personales. El tiquete POS puede emitirse a consumidor final sin identificarlo.
- **Roles:**
  - El **comercio es el responsable** del tratamiento.
  - **ProjectApp es el encargado**: «persona natural o jurídica […] que […] realice el Tratamiento de datos personales **por cuenta del Responsable**» ([Ley 1581, art. 3 lit. d](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=49981)).
  - Como encargado, ProjectApp debe cumplir los deberes del **art. 18**: seguridad, confidencialidad, actualización, trámite de consultas y reclamos, e informar incidentes.
- **Autorización del titular:** el art. 10 exime de autorización la «información requerida por una entidad pública o administrativa en ejercicio de sus funciones legales». Que la transmisión a la DIAN quede cubierta por esa excepción, o porque la factura es una obligación legal, es razonable pero está **sin confirmar** en doctrina de la SIC. Conviene que la política del comercio mencione la facturación como finalidad.
- **Documentos que se necesitan:**
  1. **Contrato de transmisión de datos** entre cada comercio y ProjectApp: [Decreto 1377 de 2013, art. 25](https://www.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=53646), hoy Decreto 1074 de 2015, art. 2.2.2.25.5.2. Debe decir el alcance del tratamiento, las actividades por cuenta del responsable y las obligaciones del encargado. Si existe, la transmisión no necesita ser informada al titular ni contar con su consentimiento, incluso si es internacional (art. 24 num. 2). Esto importa si el servidor o el respaldo están fuera de Colombia. Puede ir como anexo de los términos del servicio.
  2. **Política de tratamiento de datos** de ProjectApp, como responsable de sus propios datos (clientes, usuarios) y como encargado.
  3. **Aviso de privacidad** y autorizaciones para los datos que ProjectApp trate como responsable.
  4. **Procedimiento de incidentes de seguridad.**
  5. **Registro Nacional de Bases de Datos (RNBD):** solo obliga a sociedades y entidades sin ánimo de lucro con **activos totales mayores a 100.000 UVT** y a las personas jurídicas públicas ([Decreto 090 de 2018](https://www.funcionpublica.gov.co/eva/gestornormativo/norma_pdf.php?i=85039); [resumen en GyD](https://www.gydconsulting.com/decreto-090-registro-nacional-de-bases-de-datos/)). ProjectApp hoy no estaría obligada. Los demás deberes sí aplican.
- **Sanción:** multas de hasta **2.000 SMMLV** (Ley 1581, art. 23 lit. a), además de suspensión o cierre de las operaciones de tratamiento.

---

## 6. Conservación

- **Quién conserva:**
  - El **comercio**, como obligado a facturar. El comprador conserva lo que recibe.
  - Res. 227/2025, art. 1.5.1.11.2 (antes art. 64 de la Res. 165): los documentos «deberán ser conservados de conformidad con lo indicado en el **artículo 632 del Estatuto Tributario** y el **artículo 46 de la Ley 962 de 2005**, modificado por el artículo 304 de la Ley 1819 de 2016 […] garantizando que la información conservada sea accesible […] y […] que se cumplan las condiciones señaladas en los artículos **12 y 13 de la Ley 527 de 1999**».
  - Parágrafo transitorio del art. 1.5.1.11.1: cuando un proveedor tecnológico o un tercero cumple el deber de facturar, «**las partes** deberán conservar el documento que lo acredite». Es decir, el contrato.
- **Plazo:**
  - Fiscal: ET art. 632, **mínimo 5 años** contados desde el 1 de enero del año siguiente a la expedición. El art. 46 de la Ley 962 iguala el plazo a la **firmeza de la declaración**, que puede ser mayor en algunos casos.
  - Comercial: los libros y papeles del comerciante, entre ellos los soportes contables y las facturas, se conservan **10 años** (Ley 962 de 2005, art. 28, que modificó el art. 60 del Código de Comercio) ([Accounter](https://accounter.co/normatividad/conservacion-de-documentos-contables-concepto-562-ctcp-de-2023); [Actualícese](https://actualicese.com/tiempo-de-conservacion-de-facturas-y-documentos-equivalentes/)).
  - **Recomendación:** que Fiscal guarde el XML firmado y el ApplicationResponse (o el AttachedDocument) **al menos 10 años**, o que se los entregue al comercio y lo diga el contrato.

---

## 7. Costos y trámites del comercio con software propio o adquirido

| Concepto | Costo | Fuente |
|---|---|---|
| Habilitación en el portal DIAN y set de pruebas | Sin costo ante la DIAN (**sin confirmar** si hay tarifa) | Res. 227, art. 1.5.1.5.1.1 |
| Resolución de **numeración** (factura) y rango del **documento equivalente POS** | Trámite en línea; sin tarifa conocida | Res. 227, art. 1.5.1.5.1.1 num. 3.4 |
| **Certificado de firma digital** | Unos $120.000 a $265.000 al año | Punto 3 |
| Licencia del software (Waiter y Fiscal) | Lo que fije ProjectApp | — |
| Correo de recepción de documentos | — | Res. 227, art. 1.5.1.5.1.1 num. 1 |
| Actualización del RUT (responsabilidad 52), automática en la fecha elegida, que no se puede cambiar | — | Res. 227, art. 1.5.1.5.1.1 num. 3.6 |
| Contador o asesor para la configuración tributaria (IVA o impuesto al consumo de restaurantes, tarifas) | **Sin confirmar** | — |
| Tiempo del representante legal para las pruebas y los trámites | — | — |

Notas:
- El **tiquete POS electrónico** solo sirve hasta **5 UVT** por operación, sin impuestos (unos $261.870 en 2026). Por encima, o si el cliente lo pide, hay que expedir **factura electrónica** (ET 616-1, parágrafo 2).
- La solución gratuita de la DIAN **no** sirve para el documento equivalente electrónico (art. 1.5.1.5.1.1, parágrafo 2).

---

## Preguntas para el contador o abogado

1. Con el art. 1.5.1.11.1 de la Res. 227 y la definición del Decreto 1625, art. 1.6.1.4.1 num. 10, ¿operar Fiscal en nuestro servidor para muchos NIT nos obliga a ser **proveedor tecnológico**? ¿O hay forma de estructurarlo como «software adquirido» con licencia, con el certificado y la clave técnica del comercio, sin riesgo relevante? ¿Conviene **pedir un concepto propio a la DIAN** con los hechos concretos?
2. Si nos integramos con un proveedor tecnológico habilitado, ¿qué contrato y qué reparto de responsabilidades conviene? ¿Quién figura como fabricante en el XML?
3. Para habilitar la SAS como proveedor tecnológico en el futuro, ¿cómo se cumplen los 20.000 UVT de patrimonio y los 10.000 UVT de propiedad, planta y equipo? ¿Pueden ser aportes en especie o software activado? ¿Qué cronograma realista hay para la ISO 27001?
4. ¿Puedo, como persona natural, terminar la habilitación de software propio solo para pruebas? ¿Qué efectos tiene la fecha de inicio irreversible y la responsabilidad 52 sobre mi RUT? ¿Es mejor hacerlo ya con la SAS?
5. Si usamos el NIT de una SAS amiga para las pruebas, ¿qué autorización escrita hace falta? ¿Podemos dejar la habilitación sin fijar fecha ni pedir numeración?
6. ¿El tratamiento de datos de compradores para facturar entra en la excepción del art. 10 de la Ley 1581, o el comercio necesita autorización? ¿Basta un contrato de transmisión de datos anexo a los términos del servicio?
7. ¿Qué límite de responsabilidad es razonable y defendible ante sanciones del ET 651, 652 o 657 al comercio por fallas nuestras? ¿Qué póliza (responsabilidad profesional o cibernética) y qué cobertura recomiendan?
8. ¿Se aplica el Estatuto del Consumidor (Ley 1480) a restaurantes pequeños que nos contratan, para efectos de cláusulas abusivas?
9. ¿Cuánto tiempo y en qué formato debe Fiscal conservar los XML si el contrato termina? ¿10 años por el Código de Comercio o 5 años por el ET?
10. ¿El Decreto Legislativo 0240 de 2026, que la Res. 227 cita en la «contingencia especial de regularización voluntaria» (art. 1.5.1.5.10.1, añadido por la Res. 11 de 2026), cambia algo para nuestros clientes? **Sin confirmar:** solo vi la mención.
