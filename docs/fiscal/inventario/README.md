# Inventario de Fiscal. (4 de octubre de 2026)

Se levantó antes de escribir código, para planear sobre hechos.

> **Decisiones tomadas el 2026-10-04** sobre lo que este inventario dejó abierto (modalidad, primer documento,
> facturador de pruebas, contingencias, servidor y certificados): ver `docs/methodology/product_requirement_docs.md`.
> El plan está en `tasks/tasks_plan.md`.

Cuatro partes:

1. [Requisitos de la DIAN](01-requisitos-dian.md): documentos, anexos, CUFE y CUDE, firma, servicios web, catálogos,
   habilitación, entrega, contingencia, conservación y sanciones. Basado en la Resolución 000227 de 2025 compilada,
   los anexos técnicos 1.9 (factura) y 1.0 (documento equivalente) y el Estatuto Tributario.
2. [Lo que Waiter ya tiene](02-waiter.md): la app `billing` de experience, sus riesgos y lo que debe cambiar.
3. [Operación e infraestructura](03-operacion.md): servidor, red, respaldos, monitoreo, soporte y escala.
4. [Negocio y legal](04-negocio-y-legal.md): modalidad ante la DIAN, persona natural, certificados, responsabilidad,
   datos personales, conservación y costos. Termina con preguntas para el contador o abogado.

Es investigación, no opinión legal. Lo marcado «sin confirmar» no se pudo verificar en una fuente oficial.

## Hallazgos que deciden la planeación

1. **La modalidad legal es la primera decisión, antes que cualquier código.** Operar en nuestro servidor la
   generación, firma y transmisión para muchos NIT encaja en la definición de **proveedor tecnológico** (Decreto 1625,
   art. 1.6.1.4.1 num. 10; ET 616-4; Res. 227, art. 1.5.1.11.1; Concepto DIAN 1889 de 2025). La alternativa, que cada
   comercio lo use como «software adquirido» operado por nosotros, es una zona gris común en el mercado. Ser proveedor
   tecnológico exige una sociedad con unos COP 1.047 millones de patrimonio, ISO 27001, personal titulado y visita de
   la DIAN. [Detalle](04-negocio-y-legal.md#1-la-pregunta-crítica-software-propio-de-cada-comercio-o-proveedor-tecnológico)
2. **Fiscal. debe poder transmitir por dos caminos:** directo a la DIAN (software propio, y más adelante como proveedor
   tecnológico) y **a través de un proveedor tecnológico habilitado**, que es la salida segura mientras se resuelve el
   punto 1. Para Waiter da igual: le habla al mismo contrato.
3. **Para un restaurante basta empezar con la factura electrónica para todo** (consumidor final por omisión), con sus
   notas crédito y débito y la contingencia. El documento equivalente POS es opcional, exige una segunda habilitación,
   datos de caja y tiene una tensión legal sin resolver sobre el tope de 5 UVT. [Detalle](01-requisitos-dian.md#12-documento-equivalente-pos-electrónico-frente-a-factura-electrónica)
4. **Nada se entrega al comprador antes de que la DIAN valide**, salvo en la contingencia por falla de la DIAN. La
   venta no espera, pero el documento sí. El POS imprime la representación gráfica cuando hay validación (segundos).
   Si la DIAN falla, se reintenta como fija el anexo: ante un error del servicio, a los 5 s y dos veces más (15 s);
   ante una demora de más de 1 minuto, cada 2 minutos hasta 5 veces. Después, el documento se vuelve a firmar como
   tipo 04 con el mismo número y se entrega sin validar.
5. **Waiter tiene que cambiar antes de conectarse.** Hoy:
   - llama al proveedor dentro de una transacción que bloquea toda la organización;
   - puede reutilizar un número ya emitido;
   - emite a mano desde la consola y no al cobrar;
   - no tiene documento fiscal sin red;
   - le faltan datos DIAN (códigos de impuestos, DANE, tipos de documento, medios de pago);
   - registra el canje de puntos como línea negativa, que la DIAN no acepta.

   [Detalle](02-waiter.md)
6. **Contingencia del emisor (Waiter sin red) significa papel o talonario,** con carta a la DIAN y transcripción en
   48 h como tipo 03. Hay que decidir cómo la maneja el modo de emergencia de Waiter.
7. **Conservar 10 años** el XML firmado, la respuesta de la DIAN, el contenedor entregado y las evidencias de
   contingencia.
8. **La responsabilidad ante la DIAN es siempre del comercio.** La nuestra es por contrato: hacen falta términos con
   límite de responsabilidad, niveles de servicio y un contrato de transmisión de datos (Ley 1581).

## Preguntas abiertas que necesitan a una persona

- **Contador o abogado:** las diez preguntas al final de [Negocio y legal](04-negocio-y-legal.md). La primera es la
  modalidad.
- **Sin confirmar en fuente oficial:**
  - tope de 5 UVT del POS;
  - tamaño actual del set de pruebas;
  - direcciones de los servicios web;
  - campo del código de contingencia del POS;
  - fecha de operación de `GetAcquirer`.
