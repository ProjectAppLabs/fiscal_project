# Guías para Claude en Chrome

Cada proceso que toca un portal de la DIAN o un paso delicado de la consola tiene una guía en Markdown para entregársela
a **Claude en Chrome** (la extensión del navegador). La persona abre el portal, pega la guía y Claude la acompaña paso a
paso: le dice qué hacer y llena los datos que no son secretos.

## Dónde están

Las guías viven en `frontend/public/handoff/` y la consola las sirve en `/handoff/<archivo>.md`:

| Archivo | Proceso | Dónde la ofrece la consola |
| --- | --- | --- |
| `01-registro-facturador-dian.md` | Registrarse como facturador en el portal de habilitación | Asistente, paso Software; `/help` |
| `02-software-propio-y-set.md` | Asociar Fiscal. como software propio y leer el set de pruebas | Asistente, pasos Software y Numeración; ficha del emisor |
| `03-certificado-digital.md` | Conseguir y cargar el certificado digital | Asistente, paso Certificado; ficha, pestaña Certificados |
| `04-inscribir-emisor.md` | El asistente de inscripción, con el RUT casilla por casilla | Asistente, paso Emisor |
| `05-set-de-pruebas.md` | Correr el set de pruebas | Ficha, pestaña Habilitación |
| `06-paso-a-produccion.md` | «Habilitado», numeración en MUISCA, prefijo y paso a producción | Ficha, pestañas Habilitación y Numeración |
| `07-conectar-sistema-cliente.md` | Crear un sistema cliente y probar la conexión | Asistente, paso Sistema cliente; página del sistema cliente |
| `08-revisar-un-rechazo.md` | Entender un rechazo de la DIAN y quién lo corrige | Documento rechazado; ficha del emisor |

`/help` (menú de cuenta → «Guías y ayuda») las reúne todas.

Al copiar o descargar desde la consola se reemplazan `{{CONSOLA_URL}}`, `{{EMISOR}}` y `{{EMISOR_URL}}` con la dirección
de la consola y el emisor de la página. Descargadas desde el repositorio quedan sin reemplazar; la guía le dice a Claude
que pida esos datos.

## Lo que toda guía debe tener

1. **Las mismas reglas que no se negocian**: los secretos (PIN, clave técnica, contraseñas, secreto del sistema cliente,
   tokens) no pasan por Claude; la persona inicia sesión, elige los archivos y escribe los secretos; nada irreversible
   sin un «sí» escrito (marcado con ⛔); si la pantalla no coincide, Claude describe y pregunta.
2. **Datos de contexto** con los marcadores.
3. **Pasos numerados** con lo que debe verse al terminar cada uno.
4. **Un resumen final sin secretos**, con plantilla.

`frontend/lib/__tests__/handoff.test.ts` comprueba que las ocho guías tengan las reglas, el marcador de la consola y el
resumen. Si cambian las reglas, se cambian en las ocho.

## Ayudas en los campos

Junto a los campos que piden datos de la DIAN, del RUT o del certificado hay un «?» (`HelpTip`) que explica qué es el
dato y de dónde sale; los secretos llevan además un aviso. Los textos están en `messages/{es,en}.json`, en
`help.tips.<grupo>.<campo>` (`what`, `where` y, cuando aplica, `secret`, `link` y `linkLabel`).

## Mantenimiento

- Los portales de la DIAN cambian. Cuando un paso no coincida con lo que se ve, corrígelo aquí y en
  `registro-dian.md`; las guías le piden a Claude reportar en el resumen final los pasos que no coincidieron.
- Las partes B y C de `06-paso-a-produccion.md` (numeración en MUISCA y asociar el prefijo) todavía no se han recorrido
  con un emisor real: hay que confirmarlas en el primer paso a producción.
