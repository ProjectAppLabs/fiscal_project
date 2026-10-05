# Plan de implementación F5 · Consola de operación — ✅ terminada (PRs #17 a #19)

> 2026-10-05. Fase F5 de `tasks/tasks_plan.md` y la sección «Frontend: consola de operación» de
> `docs/methodology/architecture.md`. La consola es para el equipo de ProjectApp. El comercio no la usa: su vista vive
> en la consola del dueño de Waiter (F6). Todo se prueba con el gateway simulado y respuestas simuladas en los E2E.

## Páginas

| Página | Qué muestra | Qué permite |
|---|---|---|
| Tablero | Documentos por estado, tasa de rechazo de las últimas 24 h, cola, alertas abiertas, contingencias y salud del servicio (trabajador y DIAN) | Ir a cada sección |
| Documentos (existe) | Lista con filtros y detalle | **Nuevo:** tipo de factura (01, 03, 04), reglas con su severidad y **descarga** de PDF, `AttachedDocument`, XML firmado, respuesta de la DIAN y evidencia |
| Emisores | Lista: NIT, nombre, ambiente, vencimiento del certificado y alertas abiertas | Abrir el detalle |
| Detalle del emisor | Datos, certificados (sin secretos), software registrado (sin PIN), rangos con su uso y vigencia, y alertas | Descargar el borrador de la carta de contingencia para un período |
| Contingencias | Facturas en contingencia (DIAN 04 y papel 03), con el reloj de 48 h | Ir al documento |
| Alertas | Abiertas y resueltas, por severidad | Resolver una alerta (los rechazos se cierran a mano) |
| Sistemas cliente | Nombre, identificador de llave, URL de avisos, secretos vigentes y avisos pendientes o fallidos | — |

## PRs

### F5 PR 1 · API de la consola (`feat/…-console-api`) — ✅ hecho

- Todas las rutas bajo `/api/console/` con JWT y rol de operador:
  - `summary/` ampliado;
  - `issuers/` y `issuers/{id}/`;
  - `alerts/` y `alerts/{id}/resolve/`;
  - `contingencies/`;
  - `client-systems/`;
  - `documents/{id}/artifacts/{kind}/` (descarga con verificación de integridad).
- Nunca salen secretos: ni el `.p12` ni su contraseña, ni el PIN, ni las claves técnicas, ni los secretos de los
  clientes.

### F5 PR 2 · Tablero, documento y emisores (`feat/…-console-issuers`) — ✅ hecho

- Navegación nueva, tablero ampliado, descargas en el detalle del documento, lista y detalle de emisores con la carta
  de contingencia.
- Pruebas unitarias (Jest) y E2E (Playwright) con respuestas simuladas.
- **Errores de F1 corregidos:**
  - la historia del documento pintaba el `detail` de cada evento como texto, pero el backend lo envía como objeto,
    así que con datos reales la página fallaba. Ahora cada clave se muestra legible;
  - la sesión vive en cookies que el render del servidor no lee, así que las páginas y la navegación no coincidían
    al hidratar y React regeneraba el árbol. `useHydrated` hace esperar a la hidratación.

### F5 PR 3 · Contingencias, alertas y sistemas cliente (`feat/…-console-operations`) — ✅ hecho

- Las tres páginas, con sus pruebas unitarias y E2E.
- La navegación tiene seis enlaces. En pantallas pequeñas pasan a su propia fila y se desplazan de lado, en vez de
  formar un encabezado de cuatro renglones; es una sola `nav`, reordenada con CSS.

## Fuera de F5

- Crear o editar emisores, rangos y certificados desde la consola: hoy entran por la API de máquina (los carga el
  sistema cliente) y por el admin de Django. Se agrega si la operación lo pide.
