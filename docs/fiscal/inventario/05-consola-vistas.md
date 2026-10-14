# Inventario de vistas de la consola (14 de octubre de 2026)

Base para rediseñar la consola de Fiscal. (`frontend/`, Next.js). Para cada vista se lista para qué sirve, qué
datos usa, sus elementos en orden, las acciones, los estados (carga, vacío, error) y cómo se ve en el celular. Al
final van los componentes que se repiten, los problemas de diseño ordenados por impacto y, con el mismo detalle,
los [**38 huecos por diseñar**](#huecos-por-diseñar): lo que la consola no tiene y necesita.

- **Capturas:** en [`05-consola-vistas/`](05-consola-vistas/), a 1440 px (escritorio) y 390 px (celular), página
  completa y tema claro. Se tomaron con Playwright sobre `next dev` y **solo con datos de ejemplo** (los de
  `frontend/e2e/fixtures.ts`), nunca con datos reales de un comercio.
- **Incluye** el panel «Paso a producción» de la ficha del emisor, que llega con el PR #27.
- **Usuarios:** operadores de ProjectApp (rol administrador u operador). No hay registro abierto: los crea un
  administrador. Los comercios no entran a esta consola; usan Waiter.

## Índice

| # | Vista | Ruta | Sesión |
|---|---|---|---|
| 1 | [Iniciar sesión](#1-iniciar-sesión) | `/sign-in` | No |
| 2 | [Restablecer contraseña](#2-restablecer-contraseña) | `/forgot-password` | No |
| 3 | [Inicio](#3-inicio) | `/` | — |
| 4 | [Tablero](#4-tablero) | `/dashboard` | Sí |
| 5 | [Documentos](#5-documentos) | `/documents` | Sí |
| 6 | [Detalle del documento](#6-detalle-del-documento) | `/documents/[id]` | Sí |
| 7 | [Emisores](#7-emisores) | `/issuers` | Sí |
| 8 | [Ficha del emisor](#8-ficha-del-emisor) | `/issuers/[id]` | Sí |
| 9 | [Inscribir un emisor](#9-inscribir-un-emisor-asistente) | `/onboarding` | Sí |
| 10 | [Contingencias](#10-contingencias) | `/contingencies` | Sí |
| 11 | [Alertas](#11-alertas) | `/alerts` | Sí |
| 12 | [Sistemas cliente](#12-sistemas-cliente) | `/client-systems` | Sí |
| — | [Marco común](#marco-común) | todas | — |
| — | [Huecos por diseñar](#huecos-por-diseñar) (H-01 a H-38) | varias, y vistas nuevas: usuarios, cuenta, ficha del sistema cliente, salud, 404 y error | — |

Una vista con sesión, abierta sin sesión, manda a `/sign-in` (`useRequireAuth`). Una ruta que no existe muestra la
página 404 por defecto de Next.js, sin diseño propio.

---

## Marco común

| Pieza | Contenido | Archivo |
|---|---|---|
| Encabezado fijo | Logo «Fiscal.» (enlace a `/`). Con sesión: menú Tablero · Documentos · Emisores · Contingencias · Alertas · Sistemas cliente. A la derecha: idioma (ES/EN), tema (claro, oscuro, sistema) y «Cerrar sesión»; sin sesión, «Iniciar sesión» | `components/layout/Header.tsx` |
| Pie | «© 2026 Fiscal. Consola interna de facturación electrónica de ProjectApp.» | `components/layout/Footer.tsx` |
| Banner de staging | Franja con la fase del ambiente y pantalla de bloqueo cuando vence (de la plantilla) | `components/staging/*` |
| Carga | Texto «Cargando…» | `components/console/ConsoleStatus.tsx` |
| Error de carga | Recuadro con borde rojo, mensaje y «Reintentar» | `components/console/ConsoleStatus.tsx` |
| Etiqueta de estado | Píldora de color por estado del documento: gris en cola, azul transmitiendo, verde validado, rojo rechazado, ámbar en contingencia | `components/console/ConsoleStatus.tsx` |
| Colores | Tokens OKLCH claro/oscuro: primario (azul genérico de la plantilla), secundario, terciario, éxito, aviso, error, info | `app/globals.css` |
| Tipografía | Ubuntu Bold solo en el logo; el resto, la fuente del sistema. Títulos de página en 3xl seminegrita; títulos de tarjeta en lg | — |
| Ancho | Contenido a 6xl (1152 px) centrado; acceso a md; asistente a 3xl | — |
| Idiomas | Español (por omisión) e inglés, en `messages/es.json` y `messages/en.json` | — |

**En el celular:** el menú baja a una segunda fila que se desplaza de lado; a 390 px se ven Tablero, Documentos,
Emisores y Contingencias, y Alertas y Sistemas cliente quedan fuera de la pantalla.

<img src="05-consola-vistas/03c-dashboard-dark-desktop.png" width="560" alt="Tablero en tema oscuro">

---

## 1. Iniciar sesión

**Para qué:** entrar a la consola. **API:** `POST /api/sign_in/`, `GET /api/google-captcha/site-key/`.

| Elemento | Detalle |
|---|---|
| Tarjeta centrada | Título «Iniciar sesión» y subtítulo «Entra con tu cuenta para operar la consola.» |
| Correo electrónico | Campo con el nombre solo como texto de ayuda dentro del campo (la etiqueta es invisible) |
| Contraseña | Igual |
| reCAPTCHA | Solo si el backend entrega una clave de sitio |
| «Iniciar sesión» | Botón primario de ancho completo; dice «Iniciando sesión…» mientras espera |
| Error | Texto rojo bajo el botón: «Credenciales inválidas.» o el mensaje del backend |
| «¿Olvidaste tu contraseña?» | Enlace a `/forgot-password` |

Al entrar va a `/dashboard`. El encabezado muestra también un botón «Iniciar sesión», que sobra en esta página.

| Escritorio | Celular |
|---|---|
| <img src="05-consola-vistas/01-sign-in-desktop.png" width="480"> | <img src="05-consola-vistas/01-sign-in-mobile.png" width="180"> |

## 2. Restablecer contraseña

**Para qué:** cambiar la contraseña con un código enviado al correo. **API:** `POST /api/send_passcode/`,
`POST /api/verify_passcode_and_reset_password/`.

| Paso | Elementos |
|---|---|
| 1 · Correo | Texto «Escribe tu correo y te enviaremos un código…», campo de correo, «Enviar código» |
| 2 · Código | Texto con el correo en negrita, código de 6 dígitos (centrado y grande), contraseña nueva («Mínimo 8 caracteres»), confirmación, «Restablecer contraseña», «Volver al correo» |
| Siempre | «Volver a iniciar sesión»; mensajes en verde (código enviado, contraseña cambiada) o en rojo (no coinciden, muy corta, código inválido) |

Al terminar redirige al ingreso. Los campos usan otra forma (esquinas menos redondeadas) que los de «Iniciar sesión».

| Escritorio | Celular |
|---|---|
| <img src="05-consola-vistas/02-forgot-password-desktop.png" width="480"> | <img src="05-consola-vistas/02-forgot-password-mobile.png" width="180"> |

## 3. Inicio

Solo redirige: al tablero con sesión, al ingreso sin ella. Mientras tanto muestra «Redirigiendo…».

## 4. Tablero

**Para qué:** ver de un vistazo si el servicio está sano y si hay algo que atender. **API:** `GET /api/console/summary/`.

| Bloque | Contenido | Enlace |
|---|---|---|
| Título | El logo «Fiscal.» en grande y «Consola de operación» | — |
| Documentos por estado | 7 contadores: total, en cola, transmitiendo, validados, rechazados, contingencia DIAN, contingencia del emisor | «Ver todos los documentos» |
| Configuración | Emisores y sistemas cliente | — |
| Cola de transmisión | Listos para enviar; en cola desde (fecha y hora) | — |
| Alertas abiertas | Cuántas hay; «N críticas» (rojo si hay); tasa de rechazos en 24 h (o «—» y «Sin respuestas de la DIAN en 24 h») | «Ver alertas» |
| Salud del servicio | «Todo en orden» (verde), «Con problemas» o «Caído» (rojo); trabajador activo o «El trabajador no responde»; documentos en contingencia | «Ver contingencias» |
| Último rechazo | Solo si hay: número, emisor y NIT, primera regla de la DIAN en rojo, fecha | «Ver documento» |

- **Disposición:** tarjeta de documentos a lo ancho; debajo, dos filas de dos tarjetas (una columna en el celular).
- **Vacío:** si no hay documentos, la tarjeta de contadores se cambia por «Todavía no hay documentos».
- **Error:** recuadro de error de carga con «Reintentar».

| Con datos | Vacío | Error |
|---|---|---|
| <img src="05-consola-vistas/03-dashboard-desktop.png" width="320"> | <img src="05-consola-vistas/03b-dashboard-empty-desktop.png" width="320"> | <img src="05-consola-vistas/04-load-error-desktop.png" width="320"> |

Celular: [con datos](05-consola-vistas/03-dashboard-mobile.png) · [vacío](05-consola-vistas/03b-dashboard-empty-mobile.png).

## 5. Documentos

**Para qué:** buscar facturas y notas de todos los emisores. **API:** `GET /api/console/documents/?state=&issuer=&page=`
(25 por página).

| Elemento | Detalle |
|---|---|
| Título | «Documentos» |
| Filtros | Estado (lista: todos y los 6 estados), NIT del emisor (texto), botón «Filtrar». Los filtros no quedan en la URL |
| Tabla (9 columnas) | Número (monoespaciado, enlace al detalle) · Tipo · Emisor (nombre y NIT debajo) · Sistema cliente · Estado (etiqueta de color) · Intentos · Emitido · Creado · Validado |
| Paginación | «Página N · M documentos», «Anterior» y «Siguiente» |
| Vacío | «No hay documentos con esos filtros.» en recuadro punteado |

**En el celular:** la tabla se desplaza de lado y a 390 px solo se ven Número, Tipo y Emisor; el estado queda fuera
de la pantalla.

| Escritorio | Celular | Vacío |
|---|---|---|
| <img src="05-consola-vistas/05-documents-desktop.png" width="360"> | <img src="05-consola-vistas/05-documents-mobile.png" width="150"> | <img src="05-consola-vistas/05b-documents-empty-desktop.png" width="300"> |

## 6. Detalle del documento

**Para qué:** ver qué pasó con un documento, descargar sus archivos y entender un rechazo. **API:**
`GET /api/console/documents/{id}/`, `GET …/artifacts/{kind}/`.

| Bloque | Contenido |
|---|---|
| Volver | «← Volver a documentos» |
| Encabezado | Número completo (monoespaciado, 3xl) y etiqueta de estado |
| Datos del documento | Tipo · Estado · Emisor y NIT · Sistema cliente · Intentos · Clave de idempotencia · Emitido · Creado · Validado; si aplica: documento original (en notas), tipo de factura DIAN (01 venta, 03 transcripción, 04 contingencia DIAN), en contingencia desde, CUFE (cadena larga partida) y «Ver código QR» (abre la DIAN) |
| Errores de la DIAN | Lista: rechazos en rojo, notificaciones en gris con el prefijo «Notificación:»; o «La DIAN no reportó errores.» |
| Artefactos | Tabla: Tipo (XML firmado, Respuesta DIAN, AttachedDocument, PDF, Evidencia) · Tamaño · SHA-256 (abreviado) · Creado · «Descargar»; o «Todavía no hay artefactos.» |
| Historia | Línea de tiempo: etiqueta de estado, fecha y detalle de cada evento |
| Contenido recibido | Desplegable con el JSON crudo que envió el sistema cliente |

- **No encontrado:** «No encontramos ese documento» en recuadro punteado.
- **El estado aparece dos veces:** en la etiqueta del encabezado y en «Datos del documento».
- **«Errores de la DIAN» también muestra notificaciones:** un documento validado aparece con una sección de «errores».
- **En el celular:** los datos quedan en una columna larga, y la tabla de artefactos esconde «Creado» y el botón
  «Descargar».

| Validado (escritorio) | Validado (celular) | Rechazado | No encontrado |
|---|---|---|---|
| <img src="05-consola-vistas/06-document-validated-desktop.png" width="300"> | <img src="05-consola-vistas/06-document-validated-mobile.png" width="130"> | <img src="05-consola-vistas/06b-document-rejected-desktop.png" width="260"> | <img src="05-consola-vistas/06c-document-not-found-desktop.png" width="240"> |

## 7. Emisores

**Para qué:** ver los comercios inscritos y entrar a su ficha. **API:** `GET /api/console/issuers/?q=&page=`.

| Elemento | Detalle |
|---|---|
| Encabezado | «Emisores» y botón primario «Inscribir emisor» (único acceso al asistente) |
| Búsqueda | «Buscar por NIT o nombre» y «Buscar» |
| Tabla (6 columnas) | Emisor (nombre como enlace, NIT-DV debajo) · Ambiente (Habilitación o Producción, en texto plano) · Sistema cliente · Documentos · Certificado vence («en N días», rojo a 30 días o menos, «Vencido», «Sin certificado») · Alertas abiertas (rojo si hay) |
| Paginación y vacío | Como en documentos |

| Escritorio | Celular |
|---|---|
| <img src="05-consola-vistas/07-issuers-desktop.png" width="480"> | <img src="05-consola-vistas/07-issuers-mobile.png" width="180"> |

## 8. Ficha del emisor

**Para qué:** todo sobre un comercio: datos, certificado, software, numeración, set de pruebas de la DIAN, paso a
producción y carta de contingencia. **API:** `GET /api/console/issuers/{id}/`, `GET|POST …/test-set/`,
`POST /api/console/test-sets/{id}/check/`, `GET …/production/`, `POST …/production/{acción}/`,
`GET …/contingency-letter/?from=&to=`.

Son 8 tarjetas apiladas en una sola columna, en este orden:

| # | Tarjeta | Contenido | Acciones |
|---|---|---|---|
| 1 | Datos del emisor | NIT-DV · Ambiente · Sistema cliente · Tipo de persona · Responsabilidades (códigos) · Correo · Dirección y código DANE | — |
| 2 | Alertas abiertas | Lista «Tipo: mensaje» (rojo si es crítica), con enlace al documento si lo hay; o «Sin alertas abiertas.» | — |
| 3 | Certificados | Tabla: Titular · Emitido por · Vence (fecha y hora) · Estado; o «El emisor no tiene certificados.» en rojo | Ninguna: no se puede cambiar el certificado desde aquí |
| 4 | Software registrado | Tabla: Ambiente · Identificador · Set de pruebas (con o sin TestSetId) · Estado | Ninguna |
| 5 | Rangos de numeración | Tabla: Tipo · Resolución · Números (prefijo y desde–hasta) · Vigencia (fechas ISO: `2019-01-19 → 2030-01-19`) · Usado (%, rojo desde 90 %) · Último número | Ninguna: no se pueden agregar rangos desde aquí |
| 6 | Set de pruebas de la DIAN | Texto de ayuda; «Lo que necesita» (5 requisitos con ✓ verde o ✗ rojo); cantidades de facturas, notas crédito y notas débito; estado de la última corrida con fecha; lo que dice la DIAN de cada lote; tabla Documento · Tipo · Estado · Reglas de la DIAN; o «Todavía no se ha corrido el set.» | «Iniciar set de pruebas» (desactivado si falta algo o hay uno en proceso); «Consultar a la DIAN» (solo en proceso) |
| 7 | Paso a producción | Texto; 5 requisitos con ✓/✗; casilla de confirmación «Confirmo que el comercio ya quedó «Habilitado»…»; o, ya en producción, «En producción: sus documentos tienen efecto fiscal.» en verde | «Usar el software de habilitación», «Traer la numeración de la DIAN», «Pasar a producción» (botón rojo, solo con todo listo y la casilla marcada) |
| 8 | Carta de contingencia a la DIAN | Texto con el correo de la DIAN; fechas Desde y Hasta | «Descargar borrador» (PDF) |

- **No encontrado:** «No encontramos ese emisor».
- **La página es muy larga:** con un set real de 50 documentos pasa de 5.500 px en el escritorio. El set y el paso a
  producción, que son lo que se usa durante la inscripción, quedan al fondo.
- **Fechas:** el vencimiento del certificado sale con hora y en la zona del navegador, así que un certificado que
  vence el 5 de octubre a medianoche UTC aparece como «4 oct 2027, 19:00». Las vigencias de los rangos salen en
  formato ISO. Los campos de fecha de la carta muestran el formato del navegador (`mm/dd/yyyy`).
- **El ambiente no se destaca:** «Habilitación» o «Producción» va en texto plano dentro de los datos, aunque es lo
  más importante de la ficha.

| Con set aceptado (escritorio) | Celular | Falta el TestSetId | Tema oscuro |
|---|---|---|---|
| <img src="05-consola-vistas/08-issuer-detail-desktop.png" width="300"> | <img src="05-consola-vistas/08-issuer-detail-mobile.png" width="110"> | <img src="05-consola-vistas/08b-issuer-detail-not-ready-desktop.png" width="260"> | <img src="05-consola-vistas/08d-issuer-detail-dark-desktop.png" width="260"> |

No encontrado: [captura](05-consola-vistas/08c-issuer-not-found-desktop.png).

## 9. Inscribir un emisor (asistente)

**Para qué:** dejar un comercio listo para correr el set de pruebas. Queda en habilitación. **API:**
`GET /api/console/client-systems/`, `POST /api/console/client-systems/create/`, `POST /api/console/issuers/create/`,
`POST …/issuers/{id}/certificate/`, `…/software/`, `…/ranges/`.

Encabezado «Inscribir un emisor», el subtítulo y una fila de 5 píldoras: el paso actual en azul, los hechos en verde
claro y los que faltan en gris. Cada paso es una tarjeta con su formulario y el botón «Continuar» («Guardando…»
mientras espera). Los errores del backend salen en rojo sobre el botón.

| Paso | Campos | Notas |
|---|---|---|
| 1 · Sistema cliente | «Sistema cliente existente» (lista) + «Usar este sistema»; «o crea uno nuevo»: nombre y URL de avisos (opcional) + «Crear sistema cliente» | Al crear uno se muestra **una sola vez** el identificador de llave y el secreto, con «Ya lo guardé» |
| 2 · Emisor | NIT (sin DV) · Dígito de verificación · Tipo de persona · Tributo (01 IVA, 04 INC, ZZ no aplica) · Razón social o nombre · Nombre comercial (opcional) · Responsabilidades fiscales (casillas O-13, O-15, O-23, O-47, R-99-PN) · Dirección · Municipio (código DANE de 5 dígitos) · Correo para facturación · Teléfono (opcional) | Las responsabilidades solo muestran el código, sin el nombre. El municipio se escribe a mano |
| 3 · Certificado | «¿Cómo te entregaron el certificado?»: archivo `.p12`/`.pfx` + contraseña, **o** certificado + llave privada + contraseña de la llave (opcional) | Al cargarlo: «Certificado de {titular}, vence el {fecha}» en verde, y aviso si la cadena quedó incompleta |
| 4 · Software | Identificador del software · PIN (oculto) · TestSetId | — |
| 5 · Numeración | Resolución · Prefijo · Desde · Hasta · Vigente desde · Vigente hasta (precargados con SETP 990000000–995000000) · Clave técnica | El texto dice «catálogo de participantes», pero en el portal la página se llama «Set de pruebas Factura Electrónica» |
| Fin | «Emisor inscrito», «Ya puede correr el set de pruebas desde su ficha.» y «Ir a la ficha del emisor» | — |

- **No hay botón para volver** a un paso anterior.
- **El progreso no se guarda:** si se recarga la página, se vuelve al paso 1 y el emisor queda inscrito a medias.
- **No está en el menú:** solo se llega desde el botón de Emisores.

| Paso 1 | Secreto | Paso 2 | Paso 3 (.p12) |
|---|---|---|---|
| <img src="05-consola-vistas/12-onboarding-1-client-desktop.png" width="260"> | <img src="05-consola-vistas/13-onboarding-1b-secret-desktop.png" width="260"> | <img src="05-consola-vistas/14-onboarding-2-issuer-desktop.png" width="260"> | <img src="05-consola-vistas/15-onboarding-3-certificate-p12-desktop.png" width="260"> |

| Paso 3 (por separado) | Certificado cargado | Paso 4 | Paso 5 | Fin |
|---|---|---|---|---|
| <img src="05-consola-vistas/15b-onboarding-3-certificate-pair-desktop.png" width="200"> | <img src="05-consola-vistas/15c-onboarding-3-certificate-loaded-desktop.png" width="200"> | <img src="05-consola-vistas/16-onboarding-4-software-desktop.png" width="200"> | <img src="05-consola-vistas/17-onboarding-5-range-desktop.png" width="200"> | <img src="05-consola-vistas/18-onboarding-done-desktop.png" width="200"> |

Cada paso tiene también su captura en celular (`*-mobile.png`).

## 10. Contingencias

**Para qué:** vigilar las facturas que esperan a la DIAN y su plazo de 48 horas. **API:** `GET /api/console/contingencies/`.

| Elemento | Detalle |
|---|---|
| Encabezado | «Contingencias» y «Facturas que esperan a la DIAN. El plazo para transmitirlas es de 48 horas.» |
| Tabla (7 columnas) | Factura (enlace) · Emisor y NIT · Contingencia («DIAN (tipo 04)» o «Del emisor (tipo 03)») · Desde · Plazo · Tiempo restante («N h»; en rojo y negrilla a menos de 8 h; «Vencido hace N h») · Intentos |
| Vacío | «No hay facturas en contingencia.» |

No tiene paginación ni filtros.

| Con datos | Celular | Vacío |
|---|---|---|
| <img src="05-consola-vistas/09-contingencies-desktop.png" width="360"> | <img src="05-consola-vistas/09-contingencies-mobile.png" width="150"> | <img src="05-consola-vistas/09b-contingencies-empty-desktop.png" width="300"> |

## 11. Alertas

**Para qué:** atender lo que exige acción (certificado por vencer, numeración por agotarse, resolución por vencer,
plazo de contingencia, rechazo, cola detenida). **API:** `GET /api/console/alerts/?state=all&page=`,
`POST /api/console/alerts/{id}/resolve/`.

| Elemento | Detalle |
|---|---|
| Encabezado | «Alertas» y casilla «Mostrar también las resueltas» |
| Tabla (6 columnas) | Severidad (etiqueta de color: «Crítica» en rojo claro, «Advertencia») · Tipo · Mensaje (con enlace al documento si lo hay) · Emisor (o «Todo el servicio») · Creada · Acción: «Resolver», o «Resuelta el {fecha}» |
| Paginación | Como en documentos |
| Vacío | «No hay alertas abiertas.» o «No hay alertas.» |

| Con datos | Celular | Vacío |
|---|---|---|
| <img src="05-consola-vistas/10-alerts-desktop.png" width="360"> | <img src="05-consola-vistas/10-alerts-mobile.png" width="150"> | <img src="05-consola-vistas/10b-alerts-empty-desktop.png" width="300"> |

## 12. Sistemas cliente

**Para qué:** ver los sistemas que usan la API (Waiter) y el estado de sus avisos. **API:** `GET /api/console/client-systems/`.

| Elemento | Detalle |
|---|---|
| Tabla (7 columnas) | Sistema (y «Inactivo» si aplica) · Identificador de llave (monoespaciado) · URL de avisos (o «Sin URL de avisos») · Secretos vigentes (rojo si es 0) · Emisores · Avisos («N pendientes · M fallidos», rojo si hay fallidos) · Último aviso entregado |
| Vacío | «No hay sistemas cliente.» |

Es de solo lectura: crear un sistema solo se puede desde el asistente, y rotar el secreto, por consola de comandos.

| Escritorio | Celular |
|---|---|
| <img src="05-consola-vistas/11-client-systems-desktop.png" width="480"> | <img src="05-consola-vistas/11-client-systems-mobile.png" width="180"> |

---

## Componentes que se repiten

No hay una carpeta de componentes base (`components/ui/`): cada página define sus clases. Esto es lo que habría que
volver componente:

| Componente | Dónde aparece hoy | Variantes que se ven |
|---|---|---|
| Botón | Todas las vistas | Primario relleno (azul), contorno (gris), pequeño de tabla, destructivo (paso a producción); siempre en píldora |
| Campo de texto, lista, fecha, archivo | Acceso, filtros, búsqueda, asistente, carta, set | Dos formas de esquina (acceso vs. resto); etiqueta visible o solo de ayuda |
| Tarjeta | Tablero, detalles, asistente, paneles | Normal; punteada para vacío y no encontrado; roja para error |
| Tabla | Documentos, emisores, contingencias, alertas, sistemas cliente, y 5 tablas dentro de los detalles | Con marco (listas) y sin marco (dentro de tarjetas). Se define de nuevo en cada página |
| Dato con etiqueta | Tablero, detalle del documento, ficha del emisor | Contador grande (tablero) y dato normal (detalles) |
| Etiqueta de estado | Documentos, detalle, historia, alertas | Estados de documento y severidad de alertas, cada una con su código; ambiente y estado del set van como texto |
| Lista de requisitos ✓/✗ | Set de pruebas, paso a producción | — |
| Paginación | Documentos, emisores, alertas | — |
| Estados de carga, vacío, error y no encontrado | Todas las vistas con datos | Carga solo en texto, sin esqueletos |
| Encabezado de página | Todas | Título 3xl, salvo el tablero (logo 4xl) y los estados de no encontrado (lg) |

## Problemas de diseño, por impacto

1. **No hay sistema de componentes.** Faltan los componentes de la tabla anterior: cada página repite sus clases. Por
   eso hay diferencias como los campos de restablecer contraseña. *Todas las vistas.*
2. **No hay identidad de marca más allá del logo.** Los colores son los de la plantilla y no hay paleta definida
   para Fiscal. *`app/globals.css`.*
3. **La ficha del emisor no muestra el ciclo de vida.** Son 8 tarjetas en una columna, el ambiente va en texto
   plano y el set y el paso a producción quedan al fondo. Propuesta: encabezado con el ambiente destacado y una
   línea de progreso (inscrito → set aceptado → habilitado → producción), y el resto en pestañas
   (Resumen · Habilitación · Numeración y certificados · Contingencia). *Vista 8.*
4. **Las tablas no funcionan en el celular.** Se desplazan de lado y esconden columnas clave: el estado en
   documentos, «Descargar» en artefactos. Conviene pasarlas a tarjetas por fila en pantallas angostas. *Vistas 5, 6, 7,
   10, 11, 12.*
5. **Al menú le faltan cosas.** No marca la página activa, en el celular esconde Alertas y Sistemas cliente, no
   incluye «Inscribir emisor» y no muestra quién está conectado. *Marco común.*
6. **Las fechas no son consistentes.** Hay fechas con hora donde solo importa el día (certificado), con desfase por
   zona horaria, fechas en ISO (rangos) y campos de fecha en el formato del navegador. *Vistas 8 y 9.*
7. **El estado no se ve de un vistazo.** El ambiente del emisor (Habilitación o Producción) y el estado del set van
   en texto, sin etiqueta de color. Hay etiquetas para el estado de los documentos y la severidad de las alertas, pero
   cada una con su propio estilo. *Vistas 7 y 8.*
8. **Faltan cosas en el asistente:** volver al paso anterior, guardar el progreso, buscar el municipio por nombre,
   mostrar el nombre de cada responsabilidad y corregir el texto del paso 5. *Vista 9.*
9. **Lecturas confusas.**
   - «Errores de la DIAN» lista también notificaciones.
   - El estado del documento sale dos veces.
   - La tabla del set repite el mismo mensaje en cada fila (en el set real, 30 veces FAQ04a); podría agruparse por
     regla.
   - El CUFE no tiene botón de copiar.
   - El contenido recibido es JSON crudo.

   *Vistas 6 y 8.*
10. **Faltan acciones en la ficha del emisor.** No se puede reemplazar el certificado, agregar un rango ni editar los
    datos después de la inscripción. Hoy solo se puede por la API. *Vista 8.*
11. **La carga es solo texto.** «Cargando…» sin esqueletos, y la página salta cuando llegan los datos. *Todas.*
12. **Quedan restos de la plantilla.**
    - El botón «Iniciar sesión» del encabezado aparece en la propia página de ingreso.
    - La 404 es la de Next.js.
    - `globals.css` tiene animaciones que no se usan (`bounce-slow`, `delay-*`).

    *Marco común.*

## Huecos por diseñar

Lo que la consola **no tiene hoy** y hace falta diseñar, con el detalle suficiente para hacerlo sin volver al código.
Cada hueco dice qué falta, dónde va, qué muestra, qué acciones tiene, sus estados, las reglas que debe respetar, qué
tiene el backend y su prioridad.

**Backend:**
- ✅ El endpoint ya existe y solo falta la pantalla.
- 🟡 Existe una parte, o existe solo como comando de servidor o en la API de máquina.
- ❌ Hay que construirlo.

**Prioridad:**
- **P1:** necesario antes del piloto con un comercio real.
- **P2:** mejora mucho la operación diaria.
- **P3:** conveniente.

### Resumen

| # | Hueco | Dónde | Backend | Prioridad |
|---|---|---|---|---|
| H-01 | Menú: página activa, contador de alertas, acceso a inscribir y menú del celular | Marco común | ✅ | P1 |
| H-02 | Menú de cuenta y cambio de contraseña | Marco común | 🟡 | P2 |
| H-03 | Usuarios de la consola (administradores y operadores) | Vista nueva | ❌ | P2 |
| H-04 | Páginas 404 y de error inesperado | Marco común | ✅ (solo frontend) | P2 |
| H-05 | Esqueletos de carga | Todas | ✅ (solo frontend) | P3 |
| H-06 | Avisos de confirmación (toasts) y diálogos de confirmación | Todas | ✅ (solo frontend) | P2 |
| H-07 | Tablas que se vuelven tarjetas en el celular | Todas las tablas | ✅ (solo frontend) | P1 |
| H-08 | Política de fechas, horas y números | Todas | ✅ (solo frontend) | P1 |
| H-09 | Encabezado de la ficha con ambiente y línea de vida | Ficha del emisor | ✅ | P1 |
| H-10 | Ficha del emisor en pestañas | Ficha del emisor | ✅ | P1 |
| H-11 | Editar datos del emisor | Ficha del emisor | 🟡 | P1 |
| H-12 | Reemplazar el certificado | Ficha del emisor | ✅ | P1 |
| H-13 | Registrar o cambiar el software | Ficha del emisor | ✅ | P2 |
| H-14 | Agregar un rango (facturación o contingencia) | Ficha del emisor | ✅ | P1 |
| H-15 | Desactivar un rango | Ficha del emisor | ❌ | P2 |
| H-16 | Desactivar o reactivar un emisor | Ficha del emisor | ❌ | P2 |
| H-17 | Set de pruebas: resumen, mensajes agrupados e historial | Ficha del emisor | 🟡 | P2 |
| H-18 | Paso a producción guiado | Ficha del emisor | ✅ | P1 |
| H-19 | Documentos del emisor desde su ficha | Ficha del emisor | ✅ | P2 |
| H-20 | Volver al paso anterior del asistente | Asistente | ✅ (solo frontend) | P1 |
| H-21 | Retomar una inscripción a medias | Asistente y ficha | ✅ | P1 |
| H-22 | Buscador de municipio | Asistente y edición | 🟡 | P2 |
| H-23 | Dígito de verificación calculado y nombres de responsabilidades | Asistente y edición | ✅ (solo frontend) | P2 |
| H-24 | Paso de revisión antes de terminar | Asistente | ✅ (solo frontend) | P3 |
| H-25 | Más filtros y filtros en la URL | Documentos | 🟡 | P2 |
| H-26 | Exportar a CSV | Documentos y alertas | ❌ | P3 |
| H-27 | Detalle del documento: copiar, QR, PDF y notas relacionadas | Detalle del documento | 🟡 | P2 |
| H-28 | Acciones de soporte sobre un documento | Detalle del documento | ❌ | P2 |
| H-29 | Contingencias: urgencia, filtros y acciones | Contingencias | 🟡 | P2 |
| H-30 | Alertas: filtros, resolver varias y nota al resolver | Alertas | ❌ | P3 |
| H-31 | Ficha del sistema cliente | Vista nueva | 🟡 | P2 |
| H-32 | Crear un sistema cliente fuera del asistente | Sistemas cliente | ✅ | P2 |
| H-33 | Editar la URL de avisos y desactivar un sistema cliente | Ficha del sistema cliente | ❌ | P2 |
| H-34 | Rotar el secreto desde la consola | Ficha del sistema cliente | 🟡 | P2 |
| H-35 | Bitácora de avisos con reintento | Ficha del sistema cliente | ❌ | P2 |
| H-36 | Salud del servicio en detalle | Vista nueva o tablero | ✅ | P3 |
| H-37 | Identidad de marca y sistema de componentes | Todas | ✅ (solo frontend) | P1 |
| H-38 | Guía de la DIAN dentro de la consola | Asistente y ficha | ✅ (solo frontend) | P3 |

---

### Marco común

#### H-01 · Menú completo

| | |
|---|---|
| **Qué falta** | El menú no marca dónde está el operador, no avisa si hay alertas, no tiene «Inscribir emisor» y en el celular esconde Alertas y Sistemas cliente |
| **Dónde va** | Encabezado de todas las vistas con sesión |
| **Contenido** | Enlaces: Tablero · Documentos · Emisores · Contingencias · Alertas · Sistemas cliente (y Usuarios para administradores, H-03). La página actual resaltada. Junto a «Alertas», una burbuja con el número de alertas abiertas, roja si alguna es crítica. Junto a «Contingencias», una burbuja con las facturas en contingencia. Un botón destacado «Inscribir emisor» |
| **Celular** | Botón de menú (hamburguesa) que abre un panel lateral con todos los enlaces, el idioma, el tema y la cuenta. Hoy la fila con desplazamiento lateral esconde dos enlaces |
| **Estados** | Las burbujas no aparecen con 0; mientras cargan, el menú se ve sin burbujas (sin saltos) |
| **Reglas** | El número de alertas sale del resumen y se refresca al resolver una |
| **Backend** | ✅ `GET /api/console/summary/` trae `alerts.total`, `alerts.critical` y `health.dian.in_contingency` |
| **Prioridad** | P1 |

#### H-02 · Menú de cuenta y cambio de contraseña

| | |
|---|---|
| **Qué falta** | No se ve quién está conectado ni hay forma de cambiar la propia contraseña sin cerrar sesión y usar «¿Olvidaste tu contraseña?» |
| **Dónde va** | Esquina derecha del encabezado: iniciales o nombre del operador que abren un menú. Cambio de contraseña en un diálogo o en una página `/account` |
| **Contenido** | Menú: nombre, correo, rol (Administrador u Operador), «Cambiar contraseña», «Cerrar sesión». Formulario: contraseña actual, nueva, confirmación |
| **Acciones** | Guardar; cancelar |
| **Estados** | Guardando; éxito («Contraseña cambiada»); errores: actual incorrecta, no coinciden, muy corta (mínimo 8, como en restablecer) |
| **Reglas** | Los tres campos ocultos, con botón para mostrar. No se guarda nada en el navegador |
| **Backend** | 🟡 `POST /api/update_password/` (`current_password`, `new_password`) existe, pero no valida el largo mínimo y responde en inglés; hay que ajustarlo. Nombre, correo y rol vienen en `validate_token/` |
| **Prioridad** | P2 |

#### H-03 · Usuarios de la consola

| | |
|---|---|
| **Qué falta** | Los operadores solo se crean desde el admin de Django (`/admin/`) o con el comando `create_users`. La consola no tiene gestión de usuarios. Además, los roles Administrador y Operador hoy pueden hacer exactamente lo mismo |
| **Dónde va** | Vista nueva `/users`, visible solo para administradores |
| **Contenido** | Tabla: nombre · correo · rol · estado (activo o inactivo) · último ingreso · creado. Formulario de alta: nombre, apellido, correo, rol |
| **Acciones** | Crear usuario (le llega un correo para fijar su contraseña con el flujo de restablecer), cambiar rol, desactivar o reactivar. Nunca ver ni fijar la contraseña de otro |
| **Estados** | Vacío (solo el propio administrador), cargando, error, correo repetido |
| **Reglas** | Hay que definir qué puede solo el administrador. Propuesta: usuarios, paso a producción, rotar secretos, desactivar emisores y sistemas cliente. Un administrador no puede desactivarse a sí mismo ni quitarse el rol si es el último |
| **Backend** | ❌ No hay endpoints de usuarios en la consola; el modelo `User` ya tiene `role` e `is_active` |
| **Prioridad** | P2 |

#### H-04 · Páginas 404 y de error inesperado

| | |
|---|---|
| **Qué falta** | Una ruta inexistente muestra la 404 por defecto de Next.js; un error de JavaScript no tiene página propia |
| **Dónde va** | `app/not-found.tsx` y `app/error.tsx` |
| **Contenido** | Logo, título («Esta página no existe» / «Algo salió mal»), una línea de explicación y botones «Ir al tablero» y «Reintentar» (en la de error) |
| **Reglas** | Debe verse bien con y sin sesión, y en los dos temas |
| **Backend** | ✅ No necesita |
| **Prioridad** | P2 |

#### H-05 · Esqueletos de carga

| | |
|---|---|
| **Qué falta** | Mientras llegan los datos solo sale «Cargando…» y la página salta al llenarse |
| **Dónde va** | Cada vista con datos: tarjetas del tablero, filas de tabla, datos de las fichas |
| **Contenido** | Bloques grises con la forma final (5 filas en las tablas, contadores en el tablero) y una animación suave, que respete «reducir movimiento» |
| **Backend** | ✅ No necesita |
| **Prioridad** | P3 |

#### H-06 · Avisos de confirmación y diálogos

| | |
|---|---|
| **Qué falta** | Las acciones no confirman que salieron bien (resolver una alerta, descargar, copiar, iniciar el set). Las acciones delicadas no piden confirmación con un diálogo: el paso a producción usa una casilla |
| **Dónde va** | Componente global de avisos (esquina inferior) y componente de diálogo |
| **Contenido** | Aviso: ícono, mensaje corto, cierre automático a los 5 s; los de error se quedan hasta cerrarlos. Diálogo: título, explicación de las consecuencias, botón de confirmar (rojo si es irreversible) y cancelar |
| **Dónde se usa el diálogo** | Pasar a producción (H-18), rotar secreto (H-34), desactivar emisor, rango o sistema (H-15, H-16, H-33), reemplazar certificado (H-12), resolver varias alertas (H-30) |
| **Backend** | ✅ No necesita |
| **Prioridad** | P2 |

#### H-07 · Tablas en el celular

| | |
|---|---|
| **Qué falta** | Las tablas se desplazan de lado y esconden columnas clave: el estado en documentos y «Descargar» en los artefactos |
| **Dónde va** | Documentos, emisores, contingencias, alertas, sistemas cliente, artefactos, certificados, software, rangos y set de pruebas |
| **Regla de diseño** | Por debajo de 640 px cada fila es una tarjeta. Arriba, el dato principal (número o nombre) y la etiqueta de estado; debajo, 2 o 3 datos secundarios; al final, la acción. Hay que definir para cada tabla qué columnas son principales |
| **Backend** | ✅ No necesita |
| **Prioridad** | P1 |

#### H-08 · Política de fechas, horas y números

| | |
|---|---|
| **Qué falta** | Cada vista formatea distinto. El vencimiento del certificado sale con hora y corrido un día por la zona horaria («4 oct 2027, 19:00» para uno que vence el 5). Las vigencias de los rangos salen en ISO (`2019-01-19`). Los campos de fecha muestran `mm/dd/yyyy` |
| **Regla propuesta** | Todo en hora de Colombia (America/Bogota), no en la del navegador. Solo fecha cuando solo importa el día (vencimientos, vigencias, resoluciones): «5 oct 2027». Fecha y hora en eventos y transmisiones: «4 oct 2026, 10:00». Tiempo relativo como complemento: «hace 5 min», «vence en 30 días». Campos de fecha en `dd/mm/aaaa`. Montos en pesos con separador de miles (`$ 45.622`). Porcentajes con una cifra decimal |
| **Backend** | ✅ No necesita (las fechas llegan en ISO con zona) |
| **Prioridad** | P1 |

---

### Emisores

#### H-09 · Encabezado de la ficha con ambiente y línea de vida

| | |
|---|---|
| **Qué falta** | Lo más importante de un emisor (en qué ambiente está y qué le falta) no se ve arriba: el ambiente va en texto plano y el avance está repartido en tres tarjetas |
| **Dónde va** | Arriba de la ficha del emisor, bajo «Volver a emisores» |
| **Contenido** | Nombre o razón social y nombre comercial; NIT-DV; etiqueta grande de ambiente («Habilitación» en ámbar, «Producción» en verde); sistema cliente; etiqueta «Inactivo» si aplica. Debajo, una línea de vida de 7 pasos: Inscrito → Certificado → Software → Numeración → Set aceptado → Habilitado en la DIAN → Producción |
| **Estado de cada paso** | Hecho (verde, con fecha si se conoce), actual (azul), pendiente (gris) o con problema (rojo: certificado vencido, set rechazado). «Habilitado en la DIAN» se hace por fuera de Fiscal.: se marca al confirmar el paso a producción |
| **Acciones** | Cada paso pendiente lleva a donde se resuelve: subir certificado (H-12), registrar software (H-13), agregar rango (H-14), correr el set, pasar a producción (H-18) |
| **Backend** | ✅ `GET …/issuers/{id}/` (certificados, software, rangos), `GET …/test-set/` (`readiness`, última corrida) y `GET …/production/` (`readiness`, `environment`) |
| **Prioridad** | P1 |

#### H-10 · Ficha del emisor en pestañas

| | |
|---|---|
| **Qué falta** | Las 8 tarjetas en una columna hacen una página de más de 5.500 px con un set real |
| **Propuesta** | Encabezado fijo (H-09) y pestañas: **Resumen** (datos del emisor y alertas abiertas, con «Editar», H-11) · **Habilitación** (set de pruebas y paso a producción) · **Certificados y software** · **Numeración** (rangos, uso y «Agregar rango») · **Documentos** (H-19) · **Contingencia** (carta a la DIAN) |
| **Reglas** | La pestaña queda en la URL (`/issuers/3?tab=numeracion`) para compartir el enlace. Al abrir la ficha, la pestaña por omisión depende del estado: Habilitación si está en habilitación y Resumen si está en producción |
| **Backend** | ✅ No necesita nada nuevo |
| **Prioridad** | P1 |

#### H-11 · Editar datos del emisor

| | |
|---|---|
| **Qué falta** | Después de inscribirlo, los datos del emisor no se pueden corregir desde la consola |
| **Dónde va** | Botón «Editar» en el Resumen de la ficha; formulario en un panel lateral o en una página |
| **Campos** | Los del paso 2 del asistente, salvo el NIT, que no se edita. Dígito de verificación, tipo de persona, tributo, razón social, nombre comercial, responsabilidades, dirección, municipio (H-22), código postal, correo y teléfono |
| **Acciones** | Guardar; cancelar |
| **Estados** | Guardando; éxito (aviso, H-06); errores por campo (los mismos del alta: DV que no corresponde, municipio fuera del departamento, responsabilidad inválida) |
| **Reglas** | El ambiente no se edita aquí: solo cambia con el paso a producción. Advertir que los cambios aplican a los documentos nuevos, no a los ya emitidos |
| **Backend** | 🟡 La API de máquina ya lo hace (`PUT /api/v1/issuers/{nit}/update/`, mismo serializador); falta el endpoint de consola `PUT /api/console/issuers/{id}/`. Hoy esa API también acepta cambiar `environment` a «1»; conviene cerrarlo al construirlo |
| **Prioridad** | P1 |

#### H-12 · Reemplazar el certificado

| | |
|---|---|
| **Qué falta** | Cuando un certificado vence (dura 1 o 2 años), la consola no deja subir el nuevo. Hoy solo se puede por la API |
| **Dónde va** | Pestaña «Certificados y software», botón «Reemplazar certificado». También desde la alerta «Certificado por vencer» y desde la línea de vida |
| **Contenido** | Certificado activo arriba (titular, entidad, vence el, días que faltan, con color: rojo a 7 días o menos, ámbar a 30). Formulario igual al paso 3 del asistente: «.p12/.pfx con contraseña» o «certificado y llave por separado» |
| **Acciones** | Subir; cancelar |
| **Estados** | Validando; éxito con el nuevo titular y vencimiento; «cadena incompleta» (ámbar); errores: contraseña incorrecta, la llave no corresponde, certificado vencido, archivo inválido |
| **Reglas** | Confirmar antes con un diálogo (H-06): «El certificado actual deja de usarse para firmar». El anterior queda en el historial como Inactivo. Contraseñas en campos ocultos; nunca se muestran después |
| **Backend** | ✅ `POST /api/console/issuers/{id}/certificate/` (multipart: `p12`+`password`, o `certificate`+`private_key`+`key_password`); responde `chain_complete` |
| **Prioridad** | P1 |

#### H-13 · Registrar o cambiar el software

| | |
|---|---|
| **Qué falta** | No se puede corregir el SoftwareID, el PIN o el TestSetId después de la inscripción (p. ej., si el comercio repite el registro en la DIAN y le sale un TestSetId nuevo) |
| **Dónde va** | Pestaña «Certificados y software», botón «Registrar software» con la tabla de registros |
| **Campos** | Ambiente (Habilitación o Producción), Identificador del software, PIN (oculto), TestSetId (solo en habilitación) |
| **Reglas** | El registro nuevo reemplaza al activo de ese ambiente. El PIN nunca se muestra; la tabla dice «PIN registrado». Para producción, lo normal es «Usar el software de habilitación» (H-18) |
| **Backend** | ✅ `POST /api/console/issuers/{id}/software/` |
| **Prioridad** | P2 |

#### H-14 · Agregar un rango

| | |
|---|---|
| **Qué falta** | Los rangos solo se crean en el asistente, y solo el de habilitación. Falta poder agregar: (a) un **rango de facturación** nuevo cuando se agota o vence la resolución, sin pasar por «Traer la numeración de la DIAN»; y (b) un **rango de contingencia** (talonario o papel, tipo 03), que el comercio necesita para la contingencia del emisor (decisión D5) |
| **Dónde va** | Pestaña «Numeración», botón «Agregar rango». También desde las alertas «Numeración por agotarse» y «Resolución por vencer» |
| **Campos** | Tipo (Facturación o Contingencia) · Número de resolución · Fecha de resolución · Prefijo (hasta 4 letras o números, en mayúsculas) · Desde · Hasta · Vigente desde · Vigente hasta · Clave técnica (obligatoria en facturación, oculta) · Establecimiento o sede (opcional; el prefijo es obligatorio si hay más de una sede) |
| **Estados** | Guardando; éxito; errores: rango invertido, vigencia invertida, falta clave técnica, resolución y prefijo ya registrados |
| **Reglas** | Explicar la diferencia entre los dos tipos con un texto corto. La clave técnica nunca vuelve a mostrarse. La tabla de rangos debería mostrar el uso con una barra (ámbar desde 80 %, rojo desde 90 %) y los días de vigencia que quedan |
| **Backend** | ✅ `POST /api/console/issuers/{id}/ranges/` (con `kind: "contingency"`) |
| **Prioridad** | P1 |

#### H-15 · Desactivar un rango

| | |
|---|---|
| **Qué falta** | Un rango mal registrado o reemplazado no se puede apagar. El paso a producción apaga solo el de habilitación |
| **Dónde va** | Menú de acciones de cada fila de la tabla de rangos |
| **Reglas** | Diálogo de confirmación. Un rango con documentos no se borra, solo se desactiva. Avisar si es el único rango vigente de facturación |
| **Backend** | ❌ Falta el endpoint (el modelo tiene `active`) |
| **Prioridad** | P2 |

#### H-16 · Desactivar o reactivar un emisor

| | |
|---|---|
| **Qué falta** | Si un comercio deja de usar Fiscal., no hay cómo darlo de baja. El campo `active` existe pero no se usa desde la consola |
| **Dónde va** | Menú «Más acciones» del encabezado de la ficha (H-09); filtro «Activos / Inactivos / Todos» en la lista de emisores |
| **Reglas** | Diálogo con consecuencias: el sistema cliente ya no podrá emitir para ese NIT. Los documentos y archivos se conservan 10 años. Solo para administradores (H-03). Una etiqueta «Inactivo» en la lista y en la ficha |
| **Backend** | ❌ Falta el endpoint, y que la emisión respete `active` |
| **Prioridad** | P2 |

#### H-17 · Set de pruebas: resumen, mensajes agrupados e historial

| | |
|---|---|
| **Qué falta** | La tabla del set repite el mismo mensaje en cada fila (en el set real, FAQ04a 30 veces) y no resume. Solo se ve la última corrida |
| **Dónde va** | Pestaña «Habilitación» |
| **Contenido** | (1) Barra de avance por fase: Facturas (N/30 aceptadas) → Notas (N/20). (2) Contadores: aceptados, rechazados y pendientes. (3) «Reglas de la DIAN» agrupadas: regla, mensaje, gravedad (rechazo o notificación) y en cuántos documentos aparece, con despliegue para ver cuáles. (4) La tabla por documento, plegada por omisión y con filtro por estado. (5) Historial de corridas: fecha, cantidades, resultado |
| **Estados** | Sin corrida; en proceso (con «Fiscal. consulta cada 2 minutos» y «Consultar ahora»); aceptado; con rechazos; no se pudo enviar (con el error) |
| **Reglas** | Las notificaciones no impiden aceptar el set: se muestran en gris, distintas de los rechazos |
| **Backend** | 🟡 La última corrida trae todo lo necesario para (1) a (4). El historial necesita un endpoint de lista de corridas (❌) |
| **Prioridad** | P2 |

#### H-18 · Paso a producción guiado

| | |
|---|---|
| **Qué falta** | El panel actual es una lista de requisitos con botones sueltos y una casilla. No explica los pasos que el comercio hace por fuera, en el portal de la DIAN y en MUISCA, ni en qué orden |
| **Dónde va** | Pestaña «Habilitación», después del set |
| **Pasos** | 1. Set de pruebas aceptado (automático). 2. **El comercio marca «Habilitado» en el portal de la DIAN.** Por fuera de Fiscal.: fija la fecha de inicio, es irreversible y agrega la responsabilidad 52 al RUT; recomendar hablarlo con el contador. 3. **El comercio pide su numeración en MUISCA y la asocia al software.** Por fuera de Fiscal. 4. «Usar el software de habilitación». 5. «Traer la numeración de la DIAN», que muestra los rangos traídos. 6. Revisión y «Pasar a producción» |
| **Confirmación** | Diálogo (no casilla) con el resumen: emisor, NIT, software, rangos de producción y la frase «Desde ahora sus documentos tienen efecto fiscal». Botón rojo «Pasar a producción» |
| **Estados** | Cada paso: pendiente, hecho o con error (p. ej., «La DIAN no entregó la numeración: …»). En producción: «En producción desde {fecha}» en verde |
| **Reglas** | Solo administradores (H-03). Si «Conexión real con la DIAN» falta, explicar que es una configuración del servidor (`DIAN_GATEWAY=soap`), no algo del comercio |
| **Backend** | ✅ `GET …/production/` y `POST …/production/{copy-software,fetch-ranges,promote}/`. La fecha del paso a producción no se guarda hoy (❌ menor) |
| **Prioridad** | P1 |

#### H-19 · Documentos del emisor desde su ficha

| | |
|---|---|
| **Qué falta** | Desde la ficha no se ven los documentos del emisor; hay que ir a Documentos y filtrar por NIT a mano |
| **Dónde va** | Pestaña «Documentos» de la ficha |
| **Contenido** | La misma tabla de Documentos ya filtrada por el NIT, con los contadores por estado del emisor |
| **Backend** | ✅ `GET /api/console/documents/?issuer={nit}`. Los contadores por emisor necesitan un ajuste (🟡) |
| **Prioridad** | P2 |

---

### Asistente de inscripción

#### H-20 · Volver al paso anterior

| | |
|---|---|
| **Qué falta** | No hay botón «Atrás»; un error en un paso anterior obliga a terminar y corregir después |
| **Contenido** | Botón «Atrás» junto a «Continuar»; las píldoras de los pasos hechos se pueden pulsar |
| **Reglas** | Volver a un paso ya guardado lo muestra con los datos guardados y permite corregirlos (emisor con H-11, certificado con H-12, software con H-13). Los secretos (contraseñas, PIN, clave técnica) no se vuelven a mostrar: «Ya registrado · Reemplazar» |
| **Backend** | ✅ Usa los mismos endpoints |
| **Prioridad** | P1 |

#### H-21 · Retomar una inscripción a medias

| | |
|---|---|
| **Qué falta** | Si se recarga la página o se cierra, el progreso se pierde y el emisor queda creado sin certificado, software o rango, sin forma clara de terminar |
| **Dónde va** | En la ficha del emisor, un aviso «Inscripción incompleta: falta {lo que falta}» con «Completar inscripción», que abre el asistente en el primer paso pendiente (`/onboarding?issuer=3`). En la lista de emisores, una etiqueta «Incompleto» |
| **Reglas** | El paso pendiente se deduce de `readiness`. El paso 1 (sistema cliente) y el 2 (emisor) ya están hechos si el emisor existe |
| **Backend** | ✅ `GET …/test-set/` trae `readiness` (certificado, software, TestSetId, rango) |
| **Prioridad** | P1 |

#### H-22 · Buscador de municipio

| | |
|---|---|
| **Qué falta** | El municipio se escribe como código DANE de 5 dígitos, que casi nadie sabe de memoria |
| **Contenido** | Campo con autocompletado: se escribe «Medell» y aparece «Medellín, Antioquia · 05001». Guarda el código; el departamento se deduce |
| **Estados** | Sin resultados; cargando; seleccionado |
| **Backend** | 🟡 La lista oficial de la DIAN está en el backend (`dian/catalogs`, lista «Municipio»); falta un endpoint de búsqueda o publicarla como archivo estático (1.122 municipios, con nombre; los departamentos están en la lista «Departamentos») |
| **Prioridad** | P2 |

#### H-23 · Dígito de verificación y nombres de responsabilidades

| | |
|---|---|
| **Qué falta** | El DV se escribe a mano y el error solo sale al guardar. Las responsabilidades aparecen como códigos sueltos (O-13, O-15…) |
| **Contenido** | DV calculado al escribir el NIT (algoritmo de la DIAN), con la opción de corregirlo y un aviso si no coincide. Responsabilidades con su nombre: O-13 Gran contribuyente · O-15 Autorretenedor · O-23 Agente de retención IVA · O-47 Régimen simple de tributación · R-99-PN No aplica, otros. R-99-PN se desmarca solo al elegir otra |
| **Backend** | ✅ No necesita (el backend valida igual) |
| **Prioridad** | P2 |

#### H-24 · Paso de revisión

| | |
|---|---|
| **Qué falta** | El asistente termina sin mostrar un resumen de lo inscrito |
| **Contenido** | Antes de «Emisor inscrito»: datos del emisor, certificado (titular y vencimiento), software (identificador, «PIN registrado», TestSetId) y rango, cada uno con «Editar». Botón final «Ir a la ficha y correr el set» |
| **Backend** | ✅ No necesita |
| **Prioridad** | P3 |

---

### Documentos

#### H-25 · Más filtros y filtros en la URL

| | |
|---|---|
| **Qué falta** | Solo se filtra por estado y NIT. Los filtros no quedan en la URL: al volver del detalle se pierden y no se puede compartir una búsqueda |
| **Filtros nuevos** | Tipo (factura, nota crédito, nota débito) · Sistema cliente · Fecha de emisión (desde–hasta) · Número o prefijo · CUFE · Tipo de factura DIAN (01, 03, 04) |
| **Reglas** | Los filtros activos se muestran como etiquetas que se quitan con un clic, y hay un «Limpiar filtros». Todo en la URL (`/documents?state=rejected&issuer=900373115`). Orden por fecha de emisión, más recientes primero |
| **Backend** | 🟡 Hoy solo `state` e `issuer`; los demás filtros faltan |
| **Prioridad** | P2 |

#### H-26 · Exportar a CSV

| | |
|---|---|
| **Qué falta** | No se puede sacar un listado para conciliar con el comercio o el contador |
| **Dónde va** | Botón «Exportar» en Documentos (con los filtros aplicados) y en Alertas |
| **Reglas** | Columnas iguales a la tabla, más el CUFE. Fechas en hora de Colombia. Un límite de filas, con aviso si se supera |
| **Backend** | ❌ |
| **Prioridad** | P3 |

#### H-27 · Detalle del documento: copiar, QR, PDF y notas

| | |
|---|---|
| **Qué falta** | El CUFE es una cadena de 96 caracteres sin botón de copiar. El QR es un enlace. El PDF solo se descarga. El JSON recibido sale crudo. «Errores de la DIAN» mezcla rechazos y notificaciones. Una factura no muestra sus notas |
| **Contenido** | Botón copiar en CUFE, clave de idempotencia y número. El QR como imagen, con el enlace a la DIAN. Vista previa del PDF. «Respuesta de la DIAN» con dos grupos: Rechazos (rojo) y Notificaciones (gris). JSON con formato y plegado. En una factura, la sección «Notas» (crédito y débito que la corrigen); en una nota, «Factura original» |
| **Reglas** | El estado sale una sola vez, en el encabezado |
| **Backend** | 🟡 Ya llegan el QR, los artefactos, los errores con gravedad y `original`. Falta la lista inversa de notas de una factura |
| **Prioridad** | P2 |

#### H-28 · Acciones de soporte sobre un documento

| | |
|---|---|
| **Qué falta** | Ante un problema, el operador no puede hacer nada desde la consola: ni forzar la transmisión, ni reenviar el aviso al sistema cliente, ni preguntarle a la DIAN por el estado |
| **Dónde va** | Menú «Acciones» en el encabezado del detalle |
| **Acciones** | «Transmitir ahora» (solo en cola o en contingencia DIAN) · «Consultar estado en la DIAN» (GetStatus por CUFE) · «Reenviar aviso al sistema cliente» |
| **Reglas** | Nunca cambiar el número ni el CUFE. Cada acción queda en la Historia del documento con el operador que la hizo. Un rechazo no se reintenta: se corrige en el sistema cliente con un documento nuevo; explicarlo en el detalle |
| **Backend** | ❌ Hoy existe solo el comando `transmit_pending` y la cola automática |
| **Prioridad** | P2 |

---

### Contingencias y alertas

#### H-29 · Contingencias: urgencia, filtros y acciones

| | |
|---|---|
| **Qué falta** | La lista no ordena por urgencia ni muestra el plazo de forma visual, y no tiene acciones |
| **Contenido** | Orden por tiempo restante. Barra o reloj del plazo de 48 h (verde, ámbar a menos de 24 h, rojo a menos de 8 h y vencido). Filtro por tipo (04 DIAN, 03 emisor) y por emisor. Resumen arriba: cuántas hay y cuántas vencen en menos de 8 h |
| **Acciones** | Ir al documento. «Carta de contingencia» del emisor (abre H-10, pestaña Contingencia). «Transmitir ahora» (H-28) |
| **Backend** | 🟡 La lista y el plazo existen; falta la acción de transmitir |
| **Prioridad** | P2 |

#### H-30 · Alertas: filtros, resolver varias y nota

| | |
|---|---|
| **Qué falta** | No se filtra por severidad, tipo o emisor; se resuelven de una en una y sin dejar razón |
| **Contenido** | Filtros: severidad, tipo, emisor, abiertas o resueltas. Selección múltiple con «Resolver seleccionadas». Al resolver, una nota opcional («Certificado renovado», «Rango nuevo cargado»). Quién y cuándo la resolvió |
| **Reglas** | Cada alerta lleva a donde se arregla: certificado por vencer → H-12; numeración por agotarse o resolución por vencer → H-14; rechazo → detalle del documento; contingencia → Contingencias |
| **Backend** | ❌ Faltan filtros, resolución múltiple, nota y autor |
| **Prioridad** | P3 |

---

### Sistemas cliente

#### H-31 · Ficha del sistema cliente

| | |
|---|---|
| **Qué falta** | La lista de sistemas cliente no lleva a ninguna parte |
| **Dónde va** | Vista nueva `/client-systems/[id]` |
| **Contenido** | Nombre, estado, identificador de llave (con copiar), URL de avisos, secretos vigentes (creado el, vence el, para el que está en periodo de gracia), emisores del sistema (tabla), avisos (H-35) |
| **Acciones** | Editar URL, desactivar (H-33), rotar secreto (H-34) |
| **Backend** | 🟡 La lista trae parte de los datos; falta un endpoint de detalle |
| **Prioridad** | P2 |

#### H-32 · Crear un sistema cliente fuera del asistente

| | |
|---|---|
| **Qué falta** | Solo se crea dentro del asistente de inscripción |
| **Dónde va** | Botón «Nuevo sistema cliente» en Sistemas cliente |
| **Campos** | Nombre (único), URL de avisos (opcional, https) |
| **Reglas** | El secreto se muestra **una sola vez**, con botón copiar, el aviso en rojo y la confirmación «Ya lo guardé». Ese texto debe ser el mismo del asistente |
| **Backend** | ✅ `POST /api/console/client-systems/create/` |
| **Prioridad** | P2 |

#### H-33 · Editar la URL de avisos y desactivar

| | |
|---|---|
| **Qué falta** | La URL de avisos y el estado del sistema solo se cambian en la base de datos |
| **Reglas** | URL https. Al desactivar, el sistema deja de poder llamar a la API y de recibir avisos: diálogo de confirmación, solo administradores |
| **Backend** | ❌ |
| **Prioridad** | P2 |

#### H-34 · Rotar el secreto desde la consola

| | |
|---|---|
| **Qué falta** | Hoy solo con el comando `rotate_client_secret` en el servidor |
| **Flujo** | «Rotar secreto» → diálogo: periodo de gracia (por omisión 24 h, de 0 a 72), explicación de que el secreto anterior sigue sirviendo durante ese tiempo y que los avisos se firman desde ya con el nuevo → secreto nuevo mostrado una sola vez, con copiar → «Ya lo guardé» |
| **Reglas** | Solo administradores. Nunca más de dos secretos vigentes. Mostrar cuándo deja de servir el anterior |
| **Backend** | 🟡 El servicio `rotate_secret` existe; falta el endpoint |
| **Prioridad** | P2 |

#### H-35 · Bitácora de avisos con reintento

| | |
|---|---|
| **Qué falta** | Solo se ve «N pendientes · M fallidos». No se sabe qué aviso falló, por qué, ni se puede reintentar |
| **Dónde va** | Ficha del sistema cliente (H-31) |
| **Contenido** | Tabla: evento (`document.state_changed` o `issuer.alert`) · documento o alerta · intentos · último código HTTP · último error · próximo intento · entregado el. Filtro: pendientes, fallidos, entregados |
| **Acciones** | «Reintentar ahora» por aviso o para todos los fallidos; ver el contenido enviado |
| **Backend** | ❌ El modelo `WebhookDelivery` tiene todos esos datos; faltan los endpoints |
| **Prioridad** | P2 |

---

### Operación y marca

#### H-36 · Salud del servicio en detalle

| | |
|---|---|
| **Qué falta** | La tarjeta del tablero dice «Con problemas» sin decir cuál |
| **Contenido** | Base de datos (ok o caída) · Cola (documentos pendientes, el más antiguo) · Trabajador (último latido, «hace N min») · DIAN (última respuesta, documentos en contingencia) · Avisos (pendientes y fallidos de todos los sistemas). Cada uno con su estado en color y qué hacer si falla |
| **Backend** | ✅ `GET /api/health/` y el resumen ya traen esos datos |
| **Prioridad** | P3 |

#### H-37 · Identidad de marca y sistema de componentes

| | |
|---|---|
| **Qué falta** | Paleta propia de Fiscal. (hoy es la de la plantilla) y los componentes de la sección anterior |
| **Entregables de diseño** | Paleta clara y oscura con roles (primario, superficies, bordes, estados: éxito, aviso, error, info). Tipografía del texto (hoy la del sistema). Escala de tamaños de títulos. Componentes: botón (primario, secundario, contorno, fantasma, destructivo; tamaños; con ícono; cargando; desactivado), campos (texto, contraseña con mostrar, número, fecha, lista, autocompletar, archivo, casilla, opción), etiqueta de estado (documento, ambiente, severidad, set), tarjeta, tabla con su versión de tarjetas, pestañas, línea de vida, diálogo, aviso, menú de acciones, paginación, estados vacío, error y no encontrado, esqueleto |
| **Reglas** | Contraste AA en los dos temas. Foco visible. Todo traducible (español e inglés) |
| **Backend** | ✅ No necesita |
| **Prioridad** | P1 |

#### H-38 · Guía de la DIAN dentro de la consola

| | |
|---|---|
| **Qué falta** | Los pasos que el comercio hace en el portal de la DIAN están en `docs/fiscal/guias/registro-dian.md`, no en la consola |
| **Dónde va** | Enlaces «¿Dónde encuentro esto?» junto a los campos del asistente (SoftwareID, PIN, TestSetId, clave técnica, rango) y en el paso a producción |
| **Contenido** | Panel lateral con el paso de la guía que corresponde: menú del portal, nombre del campo, y la nota de copiar la clave técnica con Ctrl+A (40 caracteres) |
| **Backend** | ✅ No necesita |
| **Prioridad** | P3 |

---

## Cómo volver a tomar las capturas

Las capturas salen de un script de Playwright que usa los datos de ejemplo de `frontend/e2e/fixtures.ts`. No toca el
backend y no se guarda en el repositorio. Se corre contra `next dev` en `:3012` con la imagen
`mcr.microsoft.com/playwright:v1.62.1-noble` (`--network host`). Si se rediseña, conviene versionar ese script en
`frontend/e2e/` como prueba visual.
