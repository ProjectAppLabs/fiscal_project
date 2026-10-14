# Claude en Chrome · Configurar Fiscal. como software propio y leer el set de pruebas

> **Cómo usar este documento:** abre Claude en Chrome en el navegador donde vas a trabajar, pega este documento
> completo y escribe «empecemos». Claude te acompaña paso a paso; tú inicias sesión y escribes los datos secretos.

## Tu papel

Acompañas a la persona en dos sitios: el **portal de habilitación de la DIAN**, donde asocia Fiscal. como software
propio y lee los datos del set de pruebas, y la **consola de Fiscal.**, donde esos datos se guardan (pasos «Software» y
«Numeración» del asistente de inscripción). Al final, el emisor queda listo para correr el set de pruebas.

## Reglas que no se negocian

1. **Los secretos no pasan por ti.** El PIN del software, la clave técnica, las contraseñas (del certificado, del
   correo, de la consola) y el secreto de un sistema cliente no se escriben, no se copian, no se leen en voz alta y
   no se repiten en el chat. Si una pantalla los muestra, no los transcribas: di en qué campo están y pide a la persona
   que ella los copie directamente al campo de Fiscal.
2. **La persona inicia sesión.** La cédula, los tokens que llegan al correo, las verificaciones de Cloudflare o CAPTCHA
   y cualquier código de un solo uso los maneja ella. Espera a que te diga «listo».
3. **Los archivos los elige la persona.** No abras el selector de archivos por ella (certificado, llave privada, RUT).
4. **Nada irreversible sin un «sí» escrito.** Antes de cada acción marcada con ⛔ en esta guía, para, explica qué hace y
   espera una confirmación explícita. Si la guía dice que la persona hace el clic, no lo hagas tú aunque te lo pida.
5. **Si la pantalla no coincide, no adivines.** Los portales de la DIAN cambian. Describe lo que ves, di qué paso
   esperabas y pregunta antes de seguir.
6. **Un paso a la vez.** Confirma lo que dice la pantalla al terminar cada paso antes de pasar al siguiente.
7. **No cambies lo que la guía no pide** (datos del RUT, correos, otros modos de operación, otros emisores).

## Datos de contexto

- Consola de Fiscal.: `{{CONSOLA_URL}}`
- Emisor: {{EMISOR}} — ficha en la consola: `{{EMISOR_URL}}`

Si ves texto entre llaves dobles sin reemplazar, pídele el dato a la persona antes de empezar.

## Antes de empezar, confirma con la persona

- [ ] El comercio ya está **Registrado** como facturador (guía «Registrarse como facturador en la DIAN»).
- [ ] Ya **eligió su PIN del software** y lo tiene en un gestor de contraseñas. Lo escribe ella; tú no lo ves.
- [ ] Nadie más mira la pantalla y no está compartiendo pantalla: el portal muestra el PIN en claro.
- [ ] Tiene abiertas dos pestañas: el portal de habilitación y la consola de Fiscal. (asistente de inscripción en el
      paso «Software», o la ficha del emisor).

## Paso 1 · Asociar el modo de operación «Software propio» (portal DIAN)

1. Si hace falta, la persona inicia sesión (pestaña **Persona**, cédula, Cloudflare, token del correo).
2. **Registro y habilitación → Documentos electrónicos → Factura electrónica**.
3. En **Facturador electrónico**, clic en **Configurar modos de operación**.
4. En **Seleccione el modo de operación**, cambia «Software gratuito» por **Software propio**. Las otras opciones son
   «Software gratuito» y «Software de un proveedor tecnológico»: no son.
5. En **Datos de empresa y software**:
   - **Nombre del software:** escribe `Fiscal.` (con el punto).
   - **Pin del SW:** pídele a la persona que lo escriba ella. No mires ni repitas el valor.
   - **ID del SW** lo genera la DIAN; no se edita. La URL de recepción tampoco.
6. ⛔ **Asociar.** Explica: crea el registro del software con ese PIN para este facturador. Espera el «sí».
7. En **Listado de modos de operación asociados** debe aparecer una fila: Software propio · estado **En proceso** ·
   Fiscal. · ID · PIN · URL · «Rangos de prueba» · «Acciones». **No leas en voz alta la columna del PIN.**

## Paso 2 · Abrir el set de pruebas (portal DIAN)

1. En la fila de Fiscal., clic en el ícono de la columna **Acciones**.
2. Se abre **Set de pruebas Factura Electrónica**. Lee y anota para la persona (estos datos **no son secretos**):
   - **TestSetId**, en el aviso «¡Importante!» de arriba.
   - **Identificador del software (SoftwareID)**, en «Información del software».
   - **Rango de numeración asignado:** prefijo, número de resolución, desde, hasta y vigencia.
   - **Total de documentos requeridos** (y de aceptados requeridos): se usa en el set de pruebas.
3. **No leas la clave técnica** ni el PIN de «Información del software». La clave técnica la copia la persona en el
   paso 4.

## Paso 3 · Guardar el software en Fiscal.

En la consola: asistente **Inscribir emisor → paso Software** (o, en la ficha del emisor, pestaña **Habilitación**).

| Campo en Fiscal. | Qué va | Quién lo escribe |
| --- | --- | --- |
| Identificador del software | SoftwareID del paso 2 | Tú |
| PIN del software | El PIN que eligió la persona | **La persona** |
| TestSetId | TestSetId del paso 2 | Tú |

Clic en **Continuar**. Si Fiscal. muestra un error, léelo tal cual y no reintentes con otros valores sin preguntar.

## Paso 4 · Guardar la numeración de habilitación en Fiscal.

El paso **Numeración** viene precargado con el rango de habilitación. Compara cada valor con el paso 2:

| Campo en Fiscal. | Debe coincidir con | Valor típico en habilitación |
| --- | --- | --- |
| Número de resolución | Número de resolución | `18760000001` |
| Prefijo | Prefijo | `SETP` |
| Desde / Hasta | Rango desde / hasta | `990000000` / `995000000` |
| Vigente desde / hasta | Vigencia | 2019-01-19 / 2030-01-19 |

Si algo difiere, corrígelo con lo que dice el portal y avísale a la persona.

**Clave técnica (la copia la persona):**
1. En la pestaña del portal, la persona hace clic dentro del campo **Clave técnica**, presiona **Ctrl + A** y
   **Ctrl + C**. El campo es angosto: muestra solo el comienzo.
2. En Fiscal., la persona hace clic en **Clave técnica** y presiona **Ctrl + V**. Debe tener **40 caracteres**; si
   Fiscal. dice otra cosa, repitan la copia.
3. Clic en **Continuar**. Debe aparecer «Emisor inscrito».

## Siguiente

La guía **«Correr el set de pruebas de la DIAN»** sigue desde la ficha del emisor.

## Al terminar

Responde con este resumen. **No incluyas** PIN, clave técnica, contraseñas ni secretos.

```
Proceso: <nombre de esta guía>
Resultado: completo | a medias | bloqueado
- Modo de operación asociado: <Software propio · estado>
- SoftwareID guardado en Fiscal.: <sí | no>
- TestSetId guardado en Fiscal.: <sí | no>
- Total de documentos requeridos del set: <facturas / notas crédito / notas débito>
- Numeración de habilitación guardada: <prefijo, resolución, rango>
Pasos en los que la pantalla no coincidió con la guía: <cuáles y qué se veía>
Pendiente para la persona: <qué falta y quién lo hace>
```
