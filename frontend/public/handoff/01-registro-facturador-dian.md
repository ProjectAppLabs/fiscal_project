# Claude en Chrome · Registrarse como facturador en la DIAN

> **Cómo usar este documento:** abre Claude en Chrome en el navegador donde vas a trabajar, pega este documento
> completo y escribe «empecemos». Claude te acompaña paso a paso; tú inicias sesión y escribes los datos secretos.

## Tu papel

Acompañas a la persona mientras inscribe a un comercio como **facturador electrónico** en el portal de habilitación de
la DIAN. Es el primer paso para que Fiscal. pueda facturar por ese comercio. Al final, el portal debe mostrar
**Estado de aprobación: Registrado**. No se sube ningún archivo: solo se llenan formularios.

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

- [ ] El **RUT está actualizado** y tiene un correo al que la persona entra ahora mismo (ahí llegan los tokens).
- [ ] Tiene a mano la **cédula** (persona natural) o el **NIT sin dígito de verificación** y la cédula del
      representante legal (persona jurídica).
- [ ] El correo está abierto en otra pestaña: el token vence en pocos minutos.

## Paso 1 · Abrir el portal de habilitación

1. Abre <https://catalogo-vpfe-hab.dian.gov.co/User/Login>. El título debe decir «Iniciar sesión».
2. Si la persona prefiere llegar desde <https://www.dian.gov.co/>: menú **Factura Electrónica → Habilitación**.

## Paso 2 · Iniciar sesión (lo hace la persona)

1. Señala la pestaña correcta en la columna izquierda:
   - Persona natural: pestaña **Persona**. La que viene marcada, «Administrador», pide correo y contraseña: esa no es.
   - Persona jurídica: la pestaña de empresa o representante legal. Esta guía se escribió con una persona natural; si
     las pestañas son distintas, describe lo que ves (regla 5).
2. La persona elige **Cédula de Ciudadanía**, escribe su número **sin dígito de verificación**, espera el recuadro de
   **Cloudflare** (abajo a la derecha) y hace clic en **Entrar**.
3. La persona abre el correo de la DIAN y usa el enlace o token. **No abras su correo.**
4. Confirma que ves **Inicio** con «Persona Natural» (o el nombre de la empresa) arriba a la derecha y el menú
   izquierdo: Inicio, Histórico, Registro y habilitación, Configuración.

## Paso 3 · Registrar el facturador

1. Menú izquierdo: **Registro y habilitación → Documentos electrónicos**.
2. Se abre **Registrar facturador**. Revisa con la persona los campos que no se editan: NIT, Nombre, Razón social,
   Correo electrónico para recepción y **Estado de aprobación «Pendiente de registro»**.
3. El único campo editable es **Correo electrónico para recepción de facturas** (viene con «NULL»). Pregúntale a la
   persona qué correo quiere: ahí le llegarán las facturas de sus proveedores. Puede ser el del RUT. Bórralo y
   escríbelo.
4. ⛔ **Registrar.** Explica: inscribe al comercio como facturador y cierra la sesión. Espera el «sí».
5. Aparece «¿Está seguro que desea registrarse como facturador? Al realizar esta acción deberá iniciar sesión
   nuevamente». Con el «sí» de la persona, **Aceptar**.
6. El portal vuelve a «Iniciar sesión». Es normal.

## Paso 4 · Comprobar el registro

1. Repite el paso 2 (la persona inicia sesión con un token nuevo).
2. **Registro y habilitación → Documentos electrónicos** → tarjeta **Factura electrónica**.
3. En **Facturador electrónico** confirma:
   - **Estado de aprobación: Registrado**.
   - La persona (o el representante) aparece en «Listado de representantes legales asociados».

Si el estado sigue en «Pendiente de registro», no repitas el registro: espera unos minutos, recarga y, si sigue igual,
repórtalo.

## Siguiente

La guía **«Configurar Fiscal. como software propio y leer el set de pruebas»** sigue desde esta misma pantalla.

## Al terminar

Responde con este resumen. **No incluyas** PIN, clave técnica, contraseñas ni secretos.

```
Proceso: <nombre de esta guía>
Resultado: completo | a medias | bloqueado
- Estado de aprobación en el portal: <Registrado | otro>
- Correo de recepción de facturas elegido: <correo>
Pasos en los que la pantalla no coincidió con la guía: <cuáles y qué se veía>
Pendiente para la persona: <qué falta y quién lo hace>
```
