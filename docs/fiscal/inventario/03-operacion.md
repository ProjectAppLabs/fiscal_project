# Operación e infraestructura de Fiscal.

Inventario del 4 de octubre de 2026.



## Punto de partida

- **Waiter todavía no está en producción.** Su despliegue está escrito (`waiter_project/deploy/`): una máquina con
  Docker, MySQL 8.4, Redis, experience con Gunicorn, tareas con supercronic, POS y menú en Next.js y Caddy con
  certificado comodín para `*.waiter.projectapp.co`. Falta el acceso al DNS y al servidor.
- **ProjectApp estandariza MySQL 8.4** en sus servidores; el despliegue de Waiter ya contempla usar un servidor MySQL
  existente.
- **Fiscal. no tiene servidor asignado.** La decisión del dueño es que viva en su propio servidor, aparte de Waiter.

## Qué necesita Fiscal. para operar

| Necesidad | Por qué | Opciones a decidir |
|---|---|---|
| Servidor propio | Aislamiento: certificados de todos los clientes y una falla de Waiter no lo tumba (ni al revés) | VPS en el mismo proveedor y región que Waiter (latencia baja y red privada) |
| Red entre Waiter y Fiscal. | Fiscal. no se publica en internet | Red privada del proveedor (VPC); túnel WireGuard o Tailscale; o HTTPS público con lista de IP y TLS mutuo como último recurso |
| Salida a la DIAN | SOAP sobre HTTPS a los servicios de habilitación y producción | Salida directa; registrar la IP de salida por si la DIAN o un firewall la exigen |
| Base de datos | Documentos, eventos, emisores, certificados cifrados | MySQL 8.4 propio en la máquina, o una base aparte en el servidor MySQL de ProjectApp (con usuario y respaldos propios) |
| Almacenamiento de archivos | XML firmado, respuesta de la DIAN, `AttachedDocument`, PDF, por años | Disco local con respaldo diario cifrado fuera del servidor, u objeto (S3 compatible) con versionado |
| Proceso web y trabajadores | API y cola de transmisión | Gunicorn + uno o más `fiscal_worker` (Docker Compose o systemd) |
| Hora exacta | La firma y la DIAN rechazan horas desfasadas; la firma HMAC tiene ventana de 5 min | NTP (chrony) obligatorio en ambos servidores |
| Secretos | Clave Fernet de Fiscal., secreto de Django, secretos de los clientes | Solo en el `.env` del servidor; respaldo de la clave Fernet en un gestor de contraseñas: sin ella no se descifra nada |

## Respaldos y recuperación

- Respaldo diario de la base y de los archivos, cifrado y fuera del servidor; prueba de restauración mensual.
- Objetivos a fijar: cuánto se puede perder (por ejemplo 1 hora de documentos) y en cuánto tiempo se vuelve a operar
  (por ejemplo 4 horas). Mientras Fiscal. está caído, Waiter sigue vendiendo y encolando: el tiempo de recuperación
  debe quedar muy por debajo del plazo de 48 horas de la contingencia.
- La clave Fernet y los respaldos se guardan por separado: un respaldo robado no debe abrir los certificados.

## Monitoreo y alertas

| Qué se vigila | Umbral sugerido | Quién se entera |
|---|---|---|
| Fiscal. responde (`/v1/health`) | 3 fallas seguidas | ProjectApp |
| La DIAN responde (sondeo de `GetStatus` o `GetNumberingRange`) | Sin respuesta 5 min | ProjectApp; los restaurantes ven el aviso en el POS |
| Documentos en cola sin salir | Más de 15 min | ProjectApp |
| Documentos en contingencia | A las 24 h y a las 40 h del plazo de 48 h | ProjectApp y el dueño del comercio |
| Rechazos de la DIAN | Cualquier rechazo; tasa > 2 % en una hora | Dueño del comercio (con el mensaje en español) y ProjectApp |
| Certificado por vencer | 30, 15 y 7 días | Dueño del comercio y ProjectApp |
| Numeración por agotarse o resolución por vencer | Menos del 10 % del rango; 30 días antes | Dueño del comercio |
| Disco, memoria, respaldos | Respaldo fallido; disco > 80 % | ProjectApp |

Canales: correo (el MCP de comunicaciones de ProjectApp ya envía correos), la consola de ProjectApp y la consola del
dueño en Waiter. Registros sin secretos ni datos de compradores.

## Soporte

- **La venta nunca espera a Fiscal. ni a la DIAN.** Ese es el principio que evita que una falla tumbe a todos los
  restaurantes a la vez.
- Protocolo de atención para: DIAN caída (aviso general, nada que hacer en el comercio), rechazo de un documento
  (corregir el dato y reemitir; nota crédito si aplica), certificado vencido (el comercio renueva y lo sube),
  numeración agotada (el comercio pide una nueva resolución en el portal).
- Una segunda persona capacitada en Fiscal. antes de pasar de unos 20 comercios en producción (riesgo de depender de
  una sola persona, señalado en el documento 233).

## Seguridad operativa

- Fiscal. solo acepta peticiones firmadas de sus clientes y, además, solo desde la red de ellos.
- Acceso al servidor con llave SSH, sin contraseña; usuarios nominales; registro de quién entra.
- Actualizaciones de seguridad del sistema operativo y de las dependencias (Django, cryptography, lxml) con fecha.
- Rotación de los secretos de los clientes sin cortar el servicio (dos secretos vigentes durante el cambio).
- Pruebas de aislamiento: un cliente nunca ve ni firma con el certificado de otro.

## Escala

- Volumen de referencia: 3.000 documentos por local al mes; con 100 locales, unos 300.000 al mes (≈ 7 por minuto en
  promedio, con picos a la hora del almuerzo y la cena). Un servidor pequeño basta; los trabajadores se pueden
  multiplicar.
- La DIAN puede limitar la frecuencia de envío: hay que medirlo en habilitación.
