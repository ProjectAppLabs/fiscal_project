# Guía de registro de Fiscal. ante la DIAN

Recorrido real del portal de habilitación hecho el 13 de octubre de 2026 por el primer emisor de Fiscal. (ProjectApp,
persona natural). Los datos de ese registro se cambiaron por marcadores `<…>`: cada facturador obtiene los suyos.

| Etapa | Resultado del primer registro |
| --- | --- |
| Registro como facturador | Registrado |
| Modo de operación | Software propio, asociado |
| Software | Fiscal. |
| Set de pruebas | Aceptado: 50 de 50 documentos (30 facturas, 10 notas crédito y 10 notas débito), 14-oct-2026 |
| Paso final «Habilitado» | No hecho a propósito: fija una fecha irreversible y la responsabilidad 52 en el RUT. Se decide con el contador |

En todo el proceso no hay que subir ningún archivo al portal: solo se llenan formularios en línea. El certificado digital
se carga en Fiscal., no en el portal.

## Antes de empezar

- [ ] **RUT actualizado** con un correo electrónico al que tengas acceso. Ahí llegan los tokens para entrar al portal.
- [ ] **Número de cédula o NIT** a la mano. Para persona natural, el NIT es la cédula; en el portal se escribe **sin**
  dígito de verificación.
- [ ] **PIN del software** ya pensado y guardado en un gestor de contraseñas. Fiscal. lo usa en el código de seguridad de
  cada documento y en las notas crédito y débito.
- [ ] **Navegador** con el correo abierto en otra pestaña: el token vence rápido.

Portal de habilitación: [catalogo-vpfe-hab.dian.gov.co](https://catalogo-vpfe-hab.dian.gov.co/User/Login)

## Paso 1: llegar al portal de habilitación

El enlace «Habilitación» de la DIAN lleva directo a la pantalla de inicio de sesión. No hay un formulario de registro
aparte.

1. Entra a [dian.gov.co](https://www.dian.gov.co/).
2. En el menú, busca **Factura Electrónica** → **Habilitación**.
3. Se abre [catalogo-vpfe-hab.dian.gov.co/User/Login](https://catalogo-vpfe-hab.dian.gov.co/User/Login), con el título
   «Iniciar sesión». Puedes abrir esa dirección directamente.

## Paso 2: iniciar sesión como persona natural

El portal no pide contraseña a las personas naturales: manda un token al correo del RUT.

1. En la columna izquierda de «Iniciar sesión», haz clic en la pestaña **Persona**. Por defecto viene seleccionada
   «Administrador», que pide correo y contraseña; esa no es.
2. **Tipo de identificación:** Cédula de Ciudadanía.
3. **Cédula del contribuyente:** tu número, sin dígito de verificación.
4. Espera a que el recuadro de **Cloudflare** (abajo a la derecha) termine de verificar. Si aparece una casilla,
   márcala.
5. Haz clic en **Entrar**.
6. Abre el correo de la DIAN y usa el enlace o token que trae. Vence en pocos minutos.
7. Entras a **Inicio**, que muestra «Persona Natural» y tu nombre arriba a la derecha.

El menú de la izquierda tiene cuatro opciones: Inicio, Histórico, **Registro y habilitación** y Configuración.

## Paso 3: registrar el facturador

Te inscribe como facturador electrónico en el ambiente de habilitación. Solo hay un campo para llenar.

1. En el menú izquierdo, abre **Registro y habilitación** → **Documentos electrónicos**.
2. Se abre el formulario **Registrar facturador**:

| Campo | Qué tiene | ¿Se edita? |
| --- | --- | --- |
| NIT | Tu número de cédula | No |
| Nombre | Tu nombre completo | No |
| Razón social | Tu nombre completo | No |
| Correo electrónico para recepción | El correo del RUT | No |
| Estado de aprobación | «Pendiente de registro» | No |
| Correo electrónico para recepción de facturas | Viene con «NULL» | **Sí** |

3. En **Correo electrónico para recepción de facturas**, borra «NULL» y escribe el correo donde quieres recibir las
   facturas, notas y demás documentos que te emitan tus proveedores (puede ser el mismo del RUT).
4. Haz clic en **Registrar**.
5. Sale el aviso «¿Está seguro que desea registrarse como facturador? Al realizar esta acción deberá iniciar sesión
   nuevamente». Haz clic en **Aceptar**.
6. El portal cierra la sesión y te devuelve a «Iniciar sesión». Es normal.

## Paso 4: volver a iniciar sesión

1. Repite el paso 2: pestaña **Persona**, cédula, Cloudflare, **Entrar** y el token nuevo del correo.
2. Ve a **Registro y habilitación** → **Documentos electrónicos**.
3. Aparece «Seleccione el tipo de documento» con una tarjeta: **Factura electrónica**. Haz clic en ella.
4. Se abre **Facturador electrónico**. Revisa que **Estado de aprobación** diga **Registrado** y que aparezcas en
   «Listado de representantes legales asociados».

## Paso 5: configurar el modo de operación «Software propio»

Aquí se asocia Fiscal. a tu registro y la DIAN genera el identificador del software y el set de pruebas.

1. En **Facturador electrónico**, haz clic en **Configurar modos de operación**.
2. En **Seleccione el modo de operación**, cambia «Software gratuito» por **Software propio**. Las otras opciones son
   «Software gratuito» y «Software de un proveedor tecnológico».
3. Revisa **Datos de empresa y software**:

| Campo | Qué va | ¿Se edita? |
| --- | --- | --- |
| Url de recepción de facturas en habilitación | `https://vpfe-hab.dian.gov.co/WcfDianCustomerServices.svc?wsdl` | No |
| Nombre empresa proveedora | Tu nombre (el portal toma al facturador como fabricante) | No |
| Nombre del software | Fiscal. | **Sí** |
| Pin del SW | Tu PIN | **Sí** |
| ID del SW | Lo genera la DIAN | No |

4. En **Nombre del software**, escribe **Fiscal.** (con el punto).
5. En **Pin del SW**, escribe tu PIN. **Ojo:** este campo muestra el PIN en pantalla. Hazlo sin nadie mirando y sin
   compartir pantalla.
6. Haz clic en **Asociar**.
7. En **Listado de modos de operación asociados** aparece una fila: Software propio, fecha de registro, estado
   **En proceso**, Fiscal., el ID, el PIN, la URL, un enlace en «Rangos de prueba» y otro en «Acciones».

Esta pantalla no tiene un campo «NIT del fabricante»: el portal toma como fabricante al facturador que se registra.

## Paso 6: consultar el set de pruebas

Todos los datos que necesita Fiscal. están en una sola página: **Set de pruebas Factura Electrónica**.

1. En la fila de Fiscal. del listado, haz clic en el enlace de la columna **Acciones** (el ícono de ver).
2. Se abre **Set de pruebas Factura Electrónica**. Arriba hay un aviso «¡Importante!» con el **TestSetId**.
3. La página tiene estas secciones:
   - **Datos del modo de operación:** descripción «Set SW Propio» y unas fechas de 2019 que trae el set por defecto. No
     hay que usarlas.
   - **Rango de numeración asignado:** prefijo, número de resolución, rango desde/hasta y vigencia.
   - **Información del software:** identificación, nombre, **clave técnica** y PIN.
   - **Total de documentos requeridos** y **Total de documentos aceptados requeridos**.
4. Para copiar la **clave técnica**: el campo es angosto y solo muestra el comienzo. Haz clic dentro, presiona
   **Ctrl + A** y luego **Ctrl + C**. Debe tener **40 caracteres**.

El enlace de la columna **Rangos de prueba** lleva a la lista de rangos de numeración de prueba.

## Paso 7: inscribir el emisor en Fiscal.

En la consola de Fiscal., **Inscribir emisor** recorre cinco pasos: Sistema cliente, Emisor, Certificado, Software y
Numeración. Datos que pide:

| Dato | Dónde sale | Ejemplo / valor |
| --- | --- | --- |
| Tipo de emisor | RUT | Persona natural o jurídica |
| NIT y dígito de verificación | RUT | `<NIT>` y `<DV>` |
| Nombre o razón social | RUT | `<NOMBRE>` |
| Responsabilidades fiscales | RUT, casilla 53 | Tabla 13.2.6.1 del anexo; si no tiene ninguna, `R-99-PN` |
| Certificado digital | Entidad de certificación | `.p12`/`.pfx` con su contraseña, o el certificado y la llave por separado |
| Identificador del software (SoftwareID) | Paso 5 | `<SoftwareID>` (lo genera la DIAN) |
| PIN | Lo elegiste en el paso 5 | **Secreto**: se escribe solo en la consola |
| TestSetId | Paso 6 | `<TestSetId>` |
| Prefijo, resolución y rango | Paso 6 | `SETP`, `18760000001`, 990000000 a 995000000 (iguales para todos en habilitación) |
| Vigencia del rango | Paso 6 | 19-01-2019 a 19-01-2030 |
| Clave técnica | Paso 6 | **Secreto**: 40 caracteres, se escribe solo en la consola |

Después, en la ficha del emisor, **Set de pruebas de la DIAN** envía los documentos. El set por omisión es de 50
(30 facturas, 10 notas crédito y 10 notas débito), lo que pedía el set del primer registro; revisa el «Total de
documentos requeridos» de tu set. Como en desarrollo no corre el trabajador de tareas, el resultado se pide con
**Consultar a la DIAN**. La DIAN puede tardar más de una hora en procesar el lote.

## Seguridad: PIN y clave técnica

El PIN y la clave técnica son los únicos datos secretos del registro. Nunca los pegues en un chat, correo o ticket, y
nunca los metas al código de Fiscal. ni a un repositorio.

| Dato | Para qué sirve | Dónde está |
| --- | --- | --- |
| PIN del software | Código de seguridad del software en cada documento y CUDE de las notas | Lo eliges tú; el portal también lo muestra en el listado de modos de operación y en la página del set |
| Clave técnica | Cálculo del CUFE de cada factura | Página del set de pruebas → Información del software |

- El campo «Pin del SW» y las tablas del portal **muestran el PIN en pantalla**. No compartas pantalla en esas páginas.
- Guárdalos en un gestor de contraseñas.
- La clave técnica de habilitación es solo para pruebas. En producción, cada rango autorizado trae su propia clave
  técnica; Fiscal. la trae de la DIAN con **Paso a producción → Traer la numeración de la DIAN**.
- Si alguno se expone, consulta con la DIAN o con el contador cómo reemplazarlo antes de facturar en producción.

## Si otra persona registra Fiscal.

Cada facturador que use Fiscal. hace este mismo proceso en **su propio** portal y obtiene **sus propios** datos.

| Dato | ¿Igual para todos? |
| --- | --- |
| Nombre del software (Fiscal.) | Sí |
| URL del web service de habilitación | Sí |
| Identificador del software (SoftwareID) | No: la DIAN genera uno por registro |
| PIN | No: cada facturador elige el suyo |
| TestSetId | No: uno por registro |
| Clave técnica | Por cada facturador |

- El PIN funciona en pareja con el SoftwareID. Con el PIN de otro, la DIAN rechaza los documentos.
- Por eso Fiscal. guarda SoftwareID, PIN, clave técnica, TestSetId y rangos **por emisor**.
- Según el [Oficio DIAN 13246 de 2025](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_13246_2025.htm),
  para quien usa un software hecho por un tercero, ese software es **adquirido**, no propio. En el portal se elige igual
  «Software propio», porque no hay una opción aparte para adquirido.
- Usar **un solo** SoftwareID y PIN para todos los clientes es el modelo de **proveedor tecnológico**: exige una
  habilitación aparte ante la DIAN y, según el mismo oficio, aplica a personas jurídicas.

Si se va a comercializar Fiscal., hay que confirmar este punto con un contador.

## Diferencias con la guía con la que empezamos

| La guía decía | Lo que hay en el portal (octubre de 2026) |
| --- | --- |
| Factura Electrónica → Habilitación → formulario de registro | El enlace lleva directo a «Iniciar sesión»; se entra por la pestaña Persona |
| Menú «Participantes» → «Facturador» | Menú «Registro y habilitación» → «Documentos electrónicos» |
| Botón «Agregar» del modo de operación | Botón «Asociar» |
| Campo «NIT del fabricante» | No existe; el portal pone al facturador como empresa proveedora |

## Lo que aprendimos con el set

- **FAJ26** (rechazo): la responsabilidad fiscal `ZZ` del genericode no es válida; va `R-99-PN` (tabla 13.2.6.1).
- **CBF04/DBF04**: la descripción del concepto de una nota debe ser exactamente la de las tablas 13.2.4 y 13.2.5
  (p. ej. «Otros», no «Otro»).
- Si la consulta del lote se queda en «Batch en proceso de validación», la consulta documento a documento por CUFE sí
  responde; Fiscal. la usa sola cuando el lote no trae documentos.
- Notificaciones que no bloquean y siguen apareciendo: FAQ04a (cargos), CAK55/DAK55 (correo del adquiriente en las
  notas), DAK07 y DAJ39 (datos del adquiriente y del emisor en las notas débito).

## Después del set: producción

1. Hablar con el contador antes del último paso del portal.
2. Marcar «Habilitado» y la fecha de inicio de facturación (irreversible).
3. Pedir la numeración de producción en MUISCA y asociar los prefijos al software.
4. En la ficha del emisor en Fiscal., **Paso a producción**: «Usar el software de habilitación», «Traer la numeración
   de la DIAN» y «Pasar a producción», que pide confirmar que el comercio ya quedó «Habilitado».

## Fuentes

- [Portal de habilitación DIAN](https://catalogo-vpfe-hab.dian.gov.co/User/Login), recorrido el 13 de octubre de 2026
- [Instructivo de registro y habilitación DIAN](https://micrositios.dian.gov.co/sistema-de-facturacion-electronica/instructivo-de-registro-y-habilitacion-en-factura-electronica-dian/)
- [Oficio DIAN 13246 de 2025](https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_13246_2025.htm)
