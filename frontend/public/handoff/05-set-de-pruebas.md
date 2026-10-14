# Claude en Chrome · Correr el set de pruebas de la DIAN

> **Cómo usar este documento:** abre Claude en Chrome en el navegador donde vas a trabajar, pega este documento
> completo y escribe «empecemos». Claude te acompaña paso a paso; tú inicias sesión y escribes los datos secretos.

## Tu papel

Acompañas a la persona mientras Fiscal. envía el **set de pruebas** a la DIAN y espera el resultado. Cuando la DIAN lo
acepta, el comercio puede pasar a producción. Todo se hace en la consola de Fiscal.; el portal de la DIAN solo se usa
para comparar cantidades y ver el avance.

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

## Paso 1 · Revisar lo que necesita

En la ficha del emisor (`{{EMISOR_URL}}`), pestaña **Habilitación**, tarjeta **Set de pruebas de la DIAN**:

- «Lo que necesita» debe tener todo en verde: ambiente de habilitación, certificado, software, TestSetId y
  numeración. Si algo falta, la tarjeta dice qué; usa la guía correspondiente (03 o 02).

## Paso 2 · Cantidades

Compara las cantidades de Fiscal. (facturas, notas crédito, notas débito) con el **«Total de documentos requeridos»**
de la página **Set de pruebas Factura Electrónica** del portal de habilitación. El set típico es de 50: 30 facturas,
10 notas crédito y 10 notas débito. Si el portal dice otra cosa, usa las del portal.

## Paso 3 · Enviar

1. ⛔ **Iniciar set de pruebas.** Explica: envía las facturas del set a la DIAN de habilitación (sin efecto fiscal).
   Haz **un solo** clic y espera.
2. Primero van las facturas; cuando la DIAN las acepta, Fiscal. envía las notas, cada una sobre una factura aceptada.
3. Fiscal. consulta el resultado cada 2 minutos. **Consultar a la DIAN** pide el resultado ya. La DIAN puede tardar
   más de una hora con un lote: no reenvíes el set mientras diga «en proceso».

## Paso 4 · Leer el resultado

- La barra muestra «N de M documentos aceptados».
- **Reglas de la DIAN** agrupa los mensajes por código. Los rechazos (rojo) hay que corregirlos; las notificaciones no
  bloquean.
- Rechazos conocidos y su arreglo:

| Regla | Qué significa | Arreglo |
| --- | --- | --- |
| FAJ26 | Responsabilidad fiscal no válida | En «Editar datos» del emisor, usar R-99-PN en lugar de ZZ |
| CBF04 / DBF04 | Descripción del concepto de la nota | Debe ser exactamente la de las tablas 13.2.4 / 13.2.5 del anexo |
| FAD06 | El CUFE no corresponde | Casi siempre la clave técnica: la persona la vuelve a copiar en la numeración |

- Notificaciones que aparecen y no bloquean: FAQ04a, CAK55/DAK55, DAK07, DAJ39.

Si hay un rechazo que no está en la tabla, busca el código en el **Anexo técnico de factura electrónica 1.9** de la
DIAN y explícaselo a la persona; no cambies datos sin su visto bueno.

## Paso 5 · Comprobar en el portal

En el portal de habilitación, la página del set muestra los documentos aceptados. Cuando el set queda **Aceptado** en
Fiscal. y en el portal, este proceso terminó.

**No marques «Habilitado» en el portal.** Ese paso es irreversible y lo decide la persona con su contador (guía
«Pasar un emisor a producción»).

## Al terminar

Responde con este resumen. **No incluyas** PIN, clave técnica, contraseñas ni secretos.

```
Proceso: <nombre de esta guía>
Resultado: completo | a medias | bloqueado
- Estado del set en Fiscal.: <aceptado | en proceso | rechazado>
- Documentos aceptados: <N de M>
- Rechazos pendientes: <códigos y documentos>
Pasos en los que la pantalla no coincidió con la guía: <cuáles y qué se veía>
Pendiente para la persona: <qué falta y quién lo hace>
```
