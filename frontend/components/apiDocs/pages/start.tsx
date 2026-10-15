'use client';

import { Callout, Code, CodeBlock, CodeTabs, DocLink, Endpoint, H2, H3, Lead, Ol, OnlyIn, P, Strong, Table, Ul } from '../Prose';
import { EXAMPLE, call, signingHelper, useDocVars } from '../examples';

export function Introduction() {
  const { base } = useDocVars();
  return (
    <>
      <Lead>
        Fiscal. es el servicio de facturación electrónica DIAN de ProjectApp. Los sistemas de ProjectApp (Waiter primero) le
        mandan documentos comerciales por esta API; Fiscal. los convierte en XML UBL 2.1, los firma con el certificado del
        comercio, los transmite a la DIAN y avisa el resultado.
      </Lead>

      <H2 id="que-hace-cada-uno">Qué hace cada uno</H2>
      <Table
        head={['', 'Sistema cliente (Waiter)', 'Fiscal.']}
        rows={[
          ['Comercio', 'Lo inscribe con los datos del RUT, su certificado y su registro ante la DIAN', 'Lo guarda, valida y cifra los secretos'],
          ['Numeración', 'Asigna prefijo y número a cada documento', 'Comprueba que esté en un rango vigente'],
          ['Documento', 'Envía la venta: líneas, impuestos, totales y pago', 'Valida contra el anexo técnico, arma el XML y lo firma'],
          ['DIAN', '—', 'Transmite, reintenta y maneja la contingencia'],
          ['Resultado', 'Recibe el aviso firmado y entrega el PDF al comprador', 'Guarda los archivos 10 años y avisa cada cambio'],
        ]}
      />

      <H2 id="como-se-ve-una-factura">Cómo se ve una factura de punta a punta</H2>
      <Ol>
        <li>
          Waiter cierra una cuenta y llama <Code>POST /api/v1/documents/create/</Code> con el documento comercial.
        </li>
        <li>
          Fiscal. responde <Code>202</Code> con el documento en <Code>queued</Code>: la venta nunca espera a la DIAN.
        </li>
        <li>Fiscal. lo firma y lo transmite; si la DIAN no responde, entra en contingencia y lo reintenta solo.</li>
        <li>
          Cuando la DIAN lo valida o lo rechaza, Fiscal. hace <Code>POST</Code> firmado a la URL de avisos de Waiter.
        </li>
        <li>Waiter descarga el PDF o el contenedor firmado y se lo entrega al comprador.</li>
      </Ol>

      <H2 id="como-leer-esta-documentacion">Cómo leer esta documentación</H2>
      <Ul>
        <li>
          <Strong>Empezar</Strong> explica la firma de cada petición, el origen (dominio y subdominios) y los ambientes.
        </li>
        <li>
          <Strong>Guías</Strong> recorre cada tarea en orden: inscribir un emisor, el set de pruebas, producción, emitir y
          los avisos.
        </li>
        <li>
          <Strong>Referencia</Strong> trae cada endpoint con sus campos, generada del mismo <Code>openapi.json</Code> que una
          prueba del backend mantiene al día con las rutas.
        </li>
      </Ul>
      <Callout title="Selector de ambiente" tone="tip">
        En el menú, <Strong>Ambiente</Strong> cambia los ejemplos y las advertencias de todas las páginas entre{' '}
        <Strong>Pruebas</Strong> (habilitación DIAN, sin efecto fiscal) y <Strong>Producción</Strong> (con efecto fiscal).
        Es una sola API: lo que cambia es el ambiente de cada emisor.
      </Callout>

      <H2 id="direccion-de-la-api">Dirección de la API</H2>
      <P>
        Todas las rutas cuelgan de <Code>/api/v1/</Code>, con cuerpos JSON en UTF-8:
      </P>
      <CodeBlock code={`${base}/api/v1/`} lang="plain" title="Base" />
      <Callout tone="info">
        Esta documentación y la API son solo para ProjectApp: la documentación pide sesión en la consola y la API pide la
        firma de un sistema cliente registrado.
      </Callout>
    </>
  );
}

export function QuickStart() {
  const { base, prod, environment } = useDocVars();
  const helper = signingHelper(base);
  return (
    <>
      <Lead>De cero a la primera llamada firmada. Para el paso 1 necesitas entrar a la consola; cambiar después el dominio o las IPs es de administradores.</Lead>

      <H2 id="1-credenciales">1. Credenciales del sistema cliente</H2>
      <P>
        En la consola, <Strong>Sistemas cliente → Nuevo sistema cliente</Strong>, con su dominio (<Code>{EXAMPLE.domain}</Code>) y
        «Acepta subdominios» si cada comercio vive en uno. La consola muestra una sola vez:
      </P>
      <CodeBlock
        code={`FISCAL_URL=${base}
FISCAL_KEY_ID=fk_…            # público, va en X-Fiscal-Key
FISCAL_SECRET=…               # secreto: solo en el .env del servidor`}
        lang="bash"
        title=".env del sistema cliente"
      />
      <Callout tone="danger" title="El secreto no sale del servidor">
        Nunca lo pongas en el frontend, en un repositorio, en un chat ni en un log. Si se expone, un administrador lo rota
        desde la consola.
      </Callout>

      <H2 id="2-firmar">2. Una función que firme</H2>
      <P>
        Toda petición va firmada con HMAC-SHA256. Copia esta función; el resto de los ejemplos la usan. El detalle está en{' '}
        <DocLink to="autenticacion">Autenticación y firma</DocLink>.
      </P>
      <CodeTabs examples={helper} />

      <H2 id="3-primera-llamada">3. La primera llamada</H2>
      <P>Consulta un emisor. Si no existe, la respuesta es <Code>404 issuer_not_found</Code>, y eso también prueba que la firma funciona.</P>
      <CodeTabs examples={{ ...call('GET', `/api/v1/issuers/${EXAMPLE.nit}/`), curl: helper.curl }} />

      <H2 id="4-inscribir">4. Inscribir el comercio</H2>
      <P>
        Emisor, certificado, software y numeración: cuatro llamadas que sigue la guía{' '}
        <DocLink to="inscribir-emisor">Inscribir un emisor</DocLink>.
        {prod ? ' En producción, el emisor llega ahí después del set de pruebas y del paso a producción.' : ''}
      </P>

      <H2 id="5-emitir">5. Emitir</H2>
      <P>
        Con el emisor listo en el ambiente <Code>{environment}</Code>, envía documentos con{' '}
        <DocLink to="emitir-documentos">Emitir documentos</DocLink> y recibe el resultado en tu URL de avisos (
        <DocLink to="avisos">Avisos</DocLink>).
      </P>
      <OnlyIn env="prod">
        <Callout tone="danger" title="Producción tiene efecto fiscal">
          Cada factura validada en producción es una venta ante la DIAN. Prueba todo primero con el ambiente Pruebas.
        </Callout>
      </OnlyIn>
    </>
  );
}

export function Authentication() {
  const { base } = useDocVars();
  return (
    <>
      <Lead>
        La API no usa sesiones ni tokens: cada petición lleva una firma HMAC-SHA256 hecha con el secreto del sistema cliente.
        Fiscal. firma igual sus avisos, así que la misma función sirve en los dos sentidos.
      </Lead>

      <H2 id="cabeceras">Cabeceras</H2>
      <Table
        head={['Cabecera', 'Valor']}
        rows={[
          [<Code key="k">X-Fiscal-Key</Code>, 'El identificador público de llave (FISCAL_KEY_ID)'],
          [<Code key="t">X-Fiscal-Timestamp</Code>, 'Segundos Unix del momento de la firma'],
          [<Code key="s">X-Fiscal-Signature</Code>, 'hex(HMAC-SHA256(FISCAL_SECRET, texto canónico))'],
          [<Code key="o">X-Fiscal-Origin</Code>, <>El host para el que se hace la petición. Obligatoria si el sistema cliente tiene dominio (<DocLink key="l" to="origen">Origen y dominios</DocLink>)</>],
        ]}
      />

      <H2 id="texto-canonico">El texto canónico</H2>
      <P>Cuatro líneas unidas con <Code>\n</Code>, sin salto final; con <Code>X-Fiscal-Origin</Code>, su valor exacto es la quinta:</P>
      <CodeBlock
        code={`1700000000
POST
/api/v1/documents/create/
9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
${EXAMPLE.origin}`}
        lang="plain"
        title="Ejemplo"
      />
      <Ul>
        <li>
          <Strong>Método</Strong> en mayúsculas.
        </li>
        <li>
          <Strong>Ruta</Strong> con su consulta tal como viaja (<Code>/api/v1/issuers/{EXAMPLE.nit}/</Code>), sin el dominio.
        </li>
        <li>
          <Strong>Huella del cuerpo</Strong>: SHA-256 en hexadecimal de los bytes exactos enviados; de un cuerpo vacío si no hay.
        </li>
      </Ul>
      <Callout tone="warning" title="Firma lo mismo que envías">
        Serializa el JSON una sola vez y envía ese mismo texto. Si el cliente HTTP lo vuelve a serializar (espacios, orden de
        claves), la huella cambia y la respuesta es <Code>signature_invalid</Code>.
      </Callout>

      <H2 id="implementacion">Implementación</H2>
      <CodeTabs examples={signingHelper(base)} />

      <H2 id="reloj">La hora</H2>
      <P>
        Una firma con más de <Strong>5 minutos</Strong> de diferencia con el reloj de Fiscal. se rechaza (<Code>signature_expired</Code>).
        Los dos servidores deben tener NTP.
      </P>

      <H2 id="rotar-el-secreto">Rotar el secreto</H2>
      <P>
        «Rotar secreto» en la consola emite uno nuevo; el anterior sigue sirviendo durante el periodo de gracia (24 horas por
        defecto). Cambia el secreto en el sistema cliente dentro de ese tiempo. Nunca hay más de dos vigentes.
      </P>

      <H2 id="errores-de-firma">Errores de firma</H2>
      <Table
        head={['Código', 'HTTP', 'Qué revisar']}
        rows={[
          [<Code key="1">signature_missing</Code>, '401', 'Falta alguna de las tres cabeceras'],
          [<Code key="2">signature_expired</Code>, '401', 'El reloj del servidor del sistema cliente'],
          [<Code key="3">signature_invalid</Code>, '401', 'El secreto, la ruta con su consulta, los bytes del cuerpo y que el origen firmado sea el enviado'],
        ]}
      />
      <Callout tone="info">Un JWT de operador de la consola no abre esta API: es solo para sistemas cliente.</Callout>
    </>
  );
}

export function Origin() {
  const { base } = useDocVars();
  return (
    <>
      <Lead>
        Una llamada de servidor a servidor no trae un dominio que se pueda comprobar. Por eso el sistema cliente declara el host
        para el que hace cada petición y lo firma con el resto; Fiscal. comprueba ese host contra el dominio registrado y ata
        cada emisor al suyo.
      </Lead>

      <H2 id="dominio-y-subdominios">Dominio y subdominios</H2>
      <P>
        Un administrador registra en la consola el dominio del sistema cliente y si acepta subdominios. Con{' '}
        <Code>{EXAMPLE.domain}</Code> y subdominios:
      </P>
      <Table
        head={['X-Fiscal-Origin', 'Resultado']}
        rows={[
          [<Code key="1">{EXAMPLE.domain}</Code>, 'Aceptado'],
          [<Code key="2">{EXAMPLE.origin}</Code>, 'Aceptado'],
          [<Code key="3">evilwaiter.co</Code>, <><Code key="c">origin_not_allowed</Code>: no termina en .waiter.co</>],
          [<Code key="4">waiter.co.otro.com</Code>, <><Code key="c">origin_not_allowed</Code></>],
          ['(sin cabecera)', <><Code key="c">origin_required</Code></>],
        ]}
      />
      <P>Sin «acepta subdominios», solo pasa el dominio exacto. Sin dominio registrado, la cabecera es opcional y no se valida.</P>

      <H2 id="emisores-atados">Cada emisor atado a su host</H2>
      <P>
        El emisor que se crea con <Code>PUT /issuers/&#123;nit&#125;/update/</Code> queda atado al <Code>X-Fiscal-Origin</Code> de esa
        petición. Desde entonces, toda petición sobre ese emisor o sus documentos debe declarar ese mismo host:
      </P>
      <CodeTabs
        examples={{
          python: `# Restaurante X crea su emisor desde su subdominio: queda atado a él.
fiscal('PUT', '/api/v1/issuers/${EXAMPLE.nit}/update/', issuer, origin='${EXAMPLE.origin}')

# Una petición del restaurante Y sobre ese emisor se rechaza: 403 origin_mismatch.
fiscal('GET', '/api/v1/issuers/${EXAMPLE.nit}/', origin='restaurante-y.waiter.co')`,
          node: `// Restaurante X crea su emisor desde su subdominio: queda atado a él.
await fiscal('PUT', '/api/v1/issuers/${EXAMPLE.nit}/update/', issuer, '${EXAMPLE.origin}')

// Una petición del restaurante Y sobre ese emisor se rechaza: 403 origin_mismatch.
await fiscal('GET', '/api/v1/issuers/${EXAMPLE.nit}/', undefined, 'restaurante-y.waiter.co')`,
        }}
      />
      <Callout tone="tip" title="Por qué importa">
        Si Waiter tuviera un error y mezclara comercios, Fiscal. no deja que un restaurante vea o facture como otro. Si un
        comercio cambia de subdominio, un administrador cambia su origen en la ficha del emisor.
      </Callout>

      <H2 id="ips">IPs permitidas</H2>
      <P>
        Opcional. Si el sistema cliente tiene IPs o redes registradas, la petición debe venir de una de ellas (
        <Code>ip_not_allowed</Code>). Es el único candado de red: si el servidor cambia y no se actualizan, todas las llamadas
        fallan. Detrás de un proxy de confianza, Fiscal. toma la IP de <Code>X-Forwarded-For</Code> sin creerle al cliente.
      </P>

      <H2 id="la-url-de-avisos">La URL de avisos</H2>
      <P>
        Con dominio registrado, la URL de avisos tiene que estar en él (por ejemplo <Code>https://api.waiter.co/internal/fiscal/events</Code>).
      </P>

      <H2 id="probar-el-origen">Probar el origen</H2>
      <CodeTabs examples={{ ...call('GET', `/api/v1/issuers/${EXAMPLE.nit}/`), curl: signingHelper(base).curl }} />
    </>
  );
}

export function Environments() {
  const { prod } = useDocVars();
  return (
    <>
      <Lead>
        Fiscal. es una sola API. Cada emisor está en un ambiente de la DIAN: <Strong>habilitación</Strong> (pruebas,{' '}
        <Code>2</Code>) o <Strong>producción</Strong> (<Code>1</Code>). Un emisor nuevo siempre empieza en habilitación.
      </Lead>

      <H2 id="que-cambia">Qué cambia</H2>
      <Table
        head={['', 'Pruebas (habilitación, 2)', 'Producción (1)']}
        rows={[
          ['Efecto fiscal', 'Ninguno', <Strong key="p">Sí: cada documento validado es real</Strong>],
          ['Servicio de la DIAN', <Code key="h">vpfe-hab.dian.gov.co</Code>, <Code key="p">vpfe.dian.gov.co</Code>],
          ['Portal', 'catalogo-vpfe-hab.dian.gov.co', 'catalogo-vpfe.dian.gov.co'],
          ['Numeración', <>Rango de habilitación: <Code key="s">SETP</Code> 990000000–995000000, resolución 18760000001</>, 'La resolución del comercio (MUISCA), traída de la DIAN con su clave técnica'],
          ['Software', 'SoftwareID, PIN y TestSetId del portal de habilitación', 'El mismo SoftwareID y PIN (copia-software)'],
          ['Qué se corre', 'El set de pruebas', 'La facturación real'],
        ]}
      />

      <H2 id="como-se-pasa">Cómo se pasa de uno a otro</H2>
      <Ol>
        <li>La DIAN acepta el set de pruebas del emisor.</li>
        <li>El comercio marca «Habilitado» en el portal (fecha irreversible, con su contador) y pide su numeración en MUISCA.</li>
        <li>
          El sistema cliente copia el software, trae la numeración y confirma el paso: <DocLink to="paso-a-produccion">Paso a producción</DocLink>.
        </li>
      </Ol>
      <Callout tone="warning">
        Un emisor no pasa a producción cambiando <Code>environment</Code> en <Code>PUT /update/</Code>: eso responde{' '}
        <Code>environment_locked</Code>. Solo pasa con <Code>POST …/production/promote/</Code>.
      </Callout>

      <H2 id="esta-documentacion">El selector de esta documentación</H2>
      <P>
        Ahora ves <Strong>{prod ? 'Producción' : 'Pruebas'}</Strong>. Cambia ejemplos (prefijo, número, ambiente) y
        advertencias, no la API: una misma integración sirve para los dos ambientes.
      </P>
      <H3 id="en-pruebas">En pruebas</H3>
      <Ul>
        <li>Usa el rango de habilitación y el set de pruebas para practicar cualquier caso (notas, propinas, descuentos).</li>
        <li>Los rechazos no tienen costo: corrige y vuelve a enviar.</li>
      </Ul>
      <H3 id="en-produccion">En producción</H3>
      <Ul>
        <li>Cada número de factura se usa una sola vez y no vuelve.</li>
        <li>Una factura con error no se borra: se corrige con una nota crédito o débito.</li>
      </Ul>
      <Endpoint method="POST" path="/api/v1/issuers/{nit}/production/promote/" />
    </>
  );
}
