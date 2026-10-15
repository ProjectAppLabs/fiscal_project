'use client';

import { Callout, Code, CodeBlock, CodeTabs, DocLink, Endpoint, H2, H3, Lead, OnlyIn, P, Strong, Table, Ul } from '../Prose';
import { EXAMPLE, call, useDocVars } from '../examples';

const ISSUER_BODY = `{
  "dv": "${EXAMPLE.dv}",
  "person_type": "1",
  "legal_name": "${EXAMPLE.name}",
  "trade_name": "La Prueba",
  "tax_responsibilities": ["R-99-PN"],
  "tax_scheme": "04",
  "address_line": "Calle 10 # 43-12",
  "municipality_code": "05001",
  "department_code": "05",
  "email": "facturacion@restaurante.test",
  "environment": "2"
}`;

export function EnrolIssuer() {
  const { prod, prefix, resolution } = useDocVars();
  return (
    <>
      <Lead>
        Cada comercio factura con su propio NIT, certificado y registro ante la DIAN. El sistema cliente lo inscribe con
        cuatro llamadas; el PIN, la clave técnica y la contraseña del certificado los escribe el comercio y viajan una sola
        vez.
      </Lead>
      <Callout tone="info" title="Antes, fuera de la API">
        El comercio compra su certificado digital (entidad acreditada por la ONAC) y se registra en el portal de
        habilitación de la DIAN con el modo «Software propio», software «Fiscal.» y un PIN. Las guías para Claude en Chrome
        de la consola (Guías y ayuda) lo acompañan paso a paso.
      </Callout>

      <H2 id="1-emisor">1. El emisor</H2>
      <Endpoint method="PUT" path="/api/v1/issuers/{nit}/update/" />
      <P>
        Crea (<Code>201</Code>) o actualiza (<Code>200</Code>) el comercio. El NIT va en la ruta, sin puntos ni dígito de
        verificación. Con dominio registrado, el emisor queda atado al <Code>X-Fiscal-Origin</Code> de esta petición.
      </P>
      <CodeBlock code={ISSUER_BODY} lang="json" title="Cuerpo" />
      <Table
        head={['Campo', 'Regla']}
        rows={[
          [<Code key="1">person_type</Code>, '1 persona jurídica, 2 persona natural (RUT, casilla 24)'],
          [<Code key="2">tax_responsibilities</Code>, 'Tabla 13.2.6.1: O-13, O-15, O-23, O-47 o R-99-PN (no aplica). El antiguo ZZ se guarda como R-99-PN: con ZZ la DIAN rechaza (FAJ26)'],
          [<Code key="3">tax_scheme</Code>, '01 IVA, 04 INC (restaurantes), ZZ no aplica'],
          [<Code key="4">municipality_code</Code>, 'DANE de 5 dígitos; debe empezar por department_code'],
          [<Code key="5">environment</Code>, <>Siempre <Code key="c">2</Code> al crearlo. Producción solo con el paso a producción (<Code key="e">environment_locked</Code>)</>],
        ]}
      />

      <H2 id="2-certificado">2. El certificado</H2>
      <Endpoint method="PUT" path="/api/v1/issuers/{nit}/certificate/update/" />
      <P>Reemplaza el certificado activo. Acepta un <Code>.p12</Code> con su contraseña, o el certificado y la llave por separado:</P>
      <CodeBlock code={`{"p12": "<base64 del .p12 o .pfx>", "password": "…"}`} lang="json" title="Un archivo" />
      <CodeBlock
        code={`{"certificate": "<base64 del .cer, .crt, .pem, .der o .zip>",
 "private_key": "<base64 de la llave, PEM o DER>",
 "key_password": "<solo si la llave tiene contraseña>"}`}
        lang="json"
        title="Certificado y llave"
      />
      <P>
        Responde titular, emisor, serie, vigencia y <Code>chain_complete</Code> (<Code>false</Code> si no pudo descargar la cadena;
        el certificado firma igual). Los archivos y contraseñas quedan cifrados y no vuelven a salir.
      </P>

      <H2 id="3-software">3. El software</H2>
      <Endpoint method="PUT" path="/api/v1/issuers/{nit}/software/update/" />
      <CodeBlock code={`{"environment": "2", "software_id": "<uuid>", "software_pin": "<pin>", "test_set_id": "<uuid>"}`} lang="json" />
      <P>
        Lo que entrega el portal de habilitación: el <Strong>SoftwareID</Strong> (columna ID de «Software propio»), el{' '}
        <Strong>PIN</Strong> que eligió el comercio y el <Strong>TestSetId</Strong> (aviso «¡Importante!» de la página del set).
        Queda como el registro activo de ese ambiente.
      </P>

      <H2 id="4-numeracion">4. La numeración</H2>
      <Endpoint method="POST" path="/api/v1/issuers/{nit}/ranges/create/" />
      <CodeBlock
        code={`{
  "kind": "invoice",
  "resolution_number": "${resolution}",
  "prefix": "${prefix}",
  "number_from": ${prod ? 1 : 990000000},
  "number_to": ${prod ? 5000 : 995000000},
  "valid_from": "${prod ? '2026-09-01' : '2019-01-19'}",
  "valid_to": "${prod ? '2028-09-01' : '2030-01-19'}",
  "technical_key": "<40 caracteres, del portal>"
}`}
        lang="json"
      />
      <OnlyIn env="test">
        <P>
          En habilitación el rango es el mismo para todos (<Code>SETP</Code>, resolución <Code>18760000001</Code>); la clave técnica
          es la del comercio, en «Información del software» de la página del set.
        </P>
      </OnlyIn>
      <OnlyIn env="prod">
        <P>
          En producción no se escribe el rango a mano: <DocLink to="paso-a-produccion" hash="numeracion">se trae de la DIAN</DocLink>{' '}
          con su clave técnica. Este endpoint queda para los rangos de <Code>contingency</Code> (talonario, tipo 03).
        </P>
      </OnlyIn>
      <Ul>
        <li>
          <Code>kind</Code>: <Code>invoice</Code> o <Code>contingency</Code>.
        </li>
        <li>
          <Code>prefix</Code>: hasta 4 caracteres; obligatorio si el comercio tiene varios locales.
        </li>
        <li>
          <Code>technical_key</Code>: obligatoria en facturación, porque entra en el CUFE.
        </li>
      </Ul>

      <H2 id="comprobar">Comprobar</H2>
      <Endpoint method="GET" path="/api/v1/issuers/{nit}/" />
      <P>
        Devuelve el emisor con su certificado, sus registros de software (<Code>has_software_pin</Code> en vez del PIN) y sus
        rangos (<Code>has_technical_key</Code> en vez de la clave). Siguiente paso: <DocLink to="set-de-pruebas">el set de pruebas</DocLink>.
      </P>
    </>
  );
}

export function TestSet() {
  return (
    <>
      <Lead>
        En habilitación, la DIAN exige un set de documentos de prueba antes de dejar facturar al comercio. Fiscal. lo arma,
        lo firma y lo envía con los datos del emisor, sobre el rango de habilitación.
      </Lead>
      <OnlyIn env="prod">
        <Callout tone="info">El set de pruebas solo existe en habilitación. Cambia el selector a Pruebas para ver los ejemplos de esta guía.</Callout>
      </OnlyIn>

      <H2 id="que-necesita">Qué necesita</H2>
      <Endpoint method="GET" path="/api/v1/issuers/{nit}/test-set/" />
      <CodeBlock code={`{"readiness": {"environment": true, "certificate": true, "software": true, "test_set_id": true, "range": true},
 "run": null}`} lang="json" />

      <H2 id="iniciar">Iniciar</H2>
      <Endpoint method="POST" path="/api/v1/issuers/{nit}/test-set/start/" />
      <CodeBlock code={`{"invoices": 30, "credit_notes": 10, "debit_notes": 10}`} lang="json" />
      <P>
        Usa el «Total de documentos requeridos» de la página del set en el portal (si no envías nada, van 30, 10 y 10). Primero
        van las facturas; las notas salen solas, cada una sobre una factura aceptada, cuando la DIAN acepta las facturas.
        Responde <Code>201</Code> con la corrida en <Code>processing</Code>.
      </P>

      <H2 id="resultado">El resultado</H2>
      <Endpoint method="POST" path="/api/v1/issuers/{nit}/test-set/check/" />
      <Table
        head={['state', 'Qué hacer']}
        rows={[
          [<Code key="1">processing</Code>, 'Esperar. En habilitación la DIAN puede tardar más de una hora'],
          [<Code key="2">accepted</Code>, 'Listo: el comercio ya puede marcar «Habilitado» en el portal'],
          [<Code key="3">rejected</Code>, 'Leer messages de cada documento, corregir y empezar otra corrida'],
          [<Code key="4">failed</Code>, 'No se pudo enviar: error dice por qué'],
        ]}
      />
      <P>
        Fiscal. consulta solo las corridas en proceso cada 2 minutos; <Code>check</Code> fuerza una consulta y el <Code>GET</Code>{' '}
        lee el resultado sin ir a la DIAN. No hay aviso por webhook del set.
      </P>
      <H3 id="rechazos-conocidos">Rechazos conocidos</H3>
      <Table
        head={['Regla', 'Arreglo']}
        rows={[
          ['FAJ26', 'Responsabilidad fiscal: usar R-99-PN en vez de ZZ'],
          ['CBF04 / DBF04', 'Concepto de la nota con la descripción exacta de las tablas 13.2.4 y 13.2.5'],
          ['FAD06', 'CUFE: casi siempre la clave técnica del rango'],
        ]}
      />
    </>
  );
}

export function Production() {
  return (
    <>
      <Lead>
        Cuando la DIAN acepta el set, el comercio queda listo para facturar de verdad. Hay dos pasos del comercio y tres del
        sistema cliente.
      </Lead>
      <Callout tone="danger" title="Irreversible">
        Desde el paso a producción, cada documento validado tiene efecto fiscal. Antes, el comercio marca «Habilitado» en el
        portal con su contador: esa fecha de inicio no se puede cambiar.
      </Callout>

      <H2 id="estado">Qué falta</H2>
      <Endpoint method="GET" path="/api/v1/issuers/{nit}/production/" />
      <CodeBlock code={`{"environment": "2",
 "readiness": {"test_set_accepted": true, "certificate": true, "software": false, "range": false, "gateway": true}}`} lang="json" />

      <H2 id="software">Software de producción</H2>
      <Endpoint method="POST" path="/api/v1/issuers/{nit}/production/copy-software/" />
      <P>
        Registra el software de producción con el mismo SoftwareID y PIN de habilitación (la DIAN los conserva). Si el comercio
        registró otro, usa <Code>PUT …/software/update/</Code> con <Code>&quot;environment&quot;: &quot;1&quot;</Code>.
      </P>

      <H2 id="numeracion">Numeración de la DIAN</H2>
      <Endpoint method="POST" path="/api/v1/issuers/{nit}/production/fetch-ranges/" />
      <P>
        Trae de la DIAN (<Code>GetNumberingRange</Code>) los rangos que el comercio asoció al software, cada uno con su clave
        técnica. <Code>409 production_not_ready</Code> si la DIAN aún no los entrega.
      </P>

      <H2 id="pasar">Pasar a producción</H2>
      <Endpoint method="POST" path="/api/v1/issuers/{nit}/production/promote/" />
      <CodeBlock code={`{"confirm": true}`} lang="json" />
      <P>
        <Code>confirm</Code> afirma que el comercio ya quedó «Habilitado». El emisor pasa a <Code>environment</Code>{' '}
        <Code>1</Code> y se desactiva el rango de habilitación. Si ya estaba en producción, no cambia nada.
      </P>
      <CodeTabs examples={call('POST', `/api/v1/issuers/${EXAMPLE.nit}/production/promote/`, '{"confirm": true}')} />
    </>
  );
}

export function IssueDocuments() {
  const { prefix, number, prod } = useDocVars();
  const envelope = `{
  "idempotency_key": "waiter:org-1:cuenta-4821",
  "issuer": "${EXAMPLE.nit}",
  "kind": "invoice",
  "prefix": "${prefix}",
  "number": ${number},
  "issue_datetime": "2026-10-15T13:05:00-05:00",
  "document": {
    "buyer": {"final_consumer": true},
    "sale_channel": "on_site",
    "lines": [
      {"code": "HAM-01", "description": "Hamburguesa de la casa", "quantity": "2", "unit_code": "94",
       "unit_price": "18450.00", "line_extension": "36900.00",
       "taxes": [{"code": "04", "rate": "8.00", "taxable_amount": "36900.00", "amount": "2952.00"}]},
      {"code": "LIM-01", "description": "Limonada natural", "quantity": "1", "unit_code": "94",
       "unit_price": "6000.00", "line_extension": "6000.00",
       "taxes": [{"code": "04", "rate": "8.00", "taxable_amount": "6000.00", "amount": "480.00"}]}
    ],
    "allowances": [{"reason": "Canje de puntos", "amount": "5000.00"}],
    "charges": [{"kind": "tip", "reason": "Propina voluntaria", "amount": "4290.00"}],
    "totals": {"line_extension": "42900.00", "tax_exclusive": "42900.00", "tax_inclusive": "46332.00",
               "allowance_total": "5000.00", "charge_total": "4290.00", "payable": "45622.00"},
    "payment": {"form": "1", "means": ["10"]}
  }
}`;
  return (
    <>
      <Lead>
        El sistema cliente manda la venta y Fiscal. responde de inmediato: la transmisión a la DIAN sigue sola y el resultado
        llega por aviso.
      </Lead>
      <OnlyIn env="prod">
        <Callout tone="danger" title="Producción">
          Este documento será una factura real ante la DIAN. El número, una vez usado, no vuelve.
        </Callout>
      </OnlyIn>

      <H2 id="enviar">Enviar</H2>
      <Endpoint method="POST" path="/api/v1/documents/create/" />
      <P>Una cuenta de restaurante: dos hamburguesas y una limonada con INC 8 %, canje de puntos y propina del 10 %.</P>
      <CodeBlock code={envelope} lang="json" title="Cuerpo" />
      <P>
        Responde <Code>202</Code> con el documento en <Code>queued</Code>{prod ? '' : ' (en habilitación, sobre el rango SETP)'}.
      </P>

      <H2 id="sobre">El sobre</H2>
      <Table
        head={['Campo', 'Regla']}
        rows={[
          [<Code key="1">idempotency_key</Code>, 'Única por documento en el sistema cliente. El mismo cuerpo con la misma clave devuelve 200 con el mismo documento; otro cuerpo, 409 idempotency_conflict'],
          [<Code key="2">kind</Code>, 'invoice, credit_note o debit_note'],
          [<Code key="3">prefix / number</Code>, 'Los asigna el sistema cliente. En una factura, dentro de un rango vigente para la fecha'],
          [<Code key="4">issue_datetime</Code>, 'Con zona horaria. No futura y, fuera de contingencia, de menos de 24 horas (FAD09e)'],
        ]}
      />
      <Callout tone="tip" title="Reintentar sin miedo">
        Tras un corte de red, reenvía el mismo cuerpo con la misma clave: nunca se duplica la factura.
      </Callout>

      <H2 id="documento-comercial">El documento comercial</H2>
      <P>Los montos van como texto con hasta dos decimales y nunca negativos.</P>
      <Table
        head={['Bloque', 'Reglas']}
        rows={[
          [<Code key="1">buyer</Code>, '{"final_consumer": true} para consumidor final (222222222222); si no, id_type, id_number, dv (NIT), person_type, name, tax_responsibilities, tax_scheme'],
          [<Code key="2">sale_channel</Code>, 'on_site o delivery; un domicilio a persona natural lleva delivery_address'],
          [<Code key="3">lines</Code>, 'Entre 1 y 500; quantity > 0; unit_code de UnidadesMedida (94 = unidad); line_extension = cantidad × precio − descuentos + cargos'],
          [<Code key="4">lines[].taxes</Code>, 'IVA 01 (0, 5, 16, 19) e INC 04 (2, 4, 8, 16). La base es el valor de la línea: la propina nunca entra en la base'],
          [<Code key="5">allowances</Code>, 'Descuentos globales; nunca una línea negativa'],
          [<Code key="6">charges</Code>, 'Cargos globales; la propina con kind tip, sin impuestos y como máximo el 10 %'],
          [<Code key="7">totals</Code>, 'Se comprueban como la DIAN (FAU02 a FAU14); tolerancia ±2,00'],
          [<Code key="8">payment</Code>, 'form 1 contado o 2 crédito (con due_date); means: 10 efectivo, 48 crédito, 49 débito…'],
        ]}
      />
      <P>
        Si algo no cuadra, la respuesta es <Code>400 invalid_document</Code> con <Code>problems</Code>: la lista completa, para
        corregir todo de una vez.
      </P>

      <H2 id="estados">Estados</H2>
      <Endpoint method="GET" path="/api/v1/documents/{id}/" />
      <Table
        head={['Estado', 'Qué significa']}
        rows={[
          [<Code key="1">queued</Code>, 'En cola o esperando un reintento'],
          [<Code key="2">transmitting</Code>, 'Un trabajador lo está enviando'],
          [<Code key="3">validated</Code>, 'La DIAN lo validó: trae cufe y qr_url'],
          [<Code key="4">rejected</Code>, 'La DIAN lo rechazó: errors trae las reglas'],
          [<Code key="5">contingency_dian</Code>, 'La DIAN no respondió: factura tipo 04, entregable al comprador (ver Contingencias)'],
        ]}
      />

      <H2 id="archivos">Archivos</H2>
      <Endpoint method="GET" path="/api/v1/documents/{id}/artifacts/{kind}/" />
      <P>
        <Code>pdf</Code> (con el QR), <Code>attached_document</Code> (el contenedor firmado para el comprador),{' '}
        <Code>signed_xml</Code>, <Code>dian_response</Code> y <Code>evidence</Code>. Cada respuesta trae{' '}
        <Code>X-Fiscal-SHA256</Code>; los archivos se conservan 10 años. La entrega al comprador la hace el sistema cliente.
      </P>
    </>
  );
}

export function Notes() {
  return (
    <>
      <Lead>
        Una factura validada no se borra ni se edita: se corrige con una nota crédito (baja el valor) o débito (lo sube) que
        la referencia.
      </Lead>
      <H2 id="enviar-una-nota">Enviar una nota</H2>
      <P>
        Mismo endpoint y sobre que una factura, con <Code>kind</Code> <Code>credit_note</Code> o <Code>debit_note</Code> y{' '}
        <Code>billing_reference</Code> en el documento comercial:
      </P>
      <CodeBlock
        code={`"billing_reference": {"document_id": 4821, "concept_code": "2", "reason": "Cliente canceló el pedido"}`}
        lang="json"
      />
      <Ul>
        <li>
          <Code>document_id</Code>: el id en Fiscal. de la factura que se corrige.
        </li>
        <li>Las notas se numeran sin resolución.</li>
        <li>Una nota espera en cola hasta que su factura tenga CUFE.</li>
      </Ul>
      <H2 id="conceptos">Conceptos</H2>
      <Table
        head={['Código', 'Nota crédito (13.2.4)', 'Nota débito (13.2.5)']}
        rows={[
          ['1', 'Devolución parcial', 'Intereses'],
          ['2', 'Anulación', 'Gastos por cobrar'],
          ['3', 'Rebaja o descuento', 'Cambio del valor'],
          ['4', 'Ajuste de precio', 'Otros'],
          ['5', 'Descuento por pronto pago', '—'],
          ['6', 'Descuento por volumen', '—'],
        ]}
      />
      <Callout tone="info">
        La DIAN exige como descripción la del concepto (CBF04, DBF04): <Code>reason</Code> no la reemplaza, va al XML como nota
        «Motivo: …». Las notas no tienen contingencia (<Code>contingency_not_allowed</Code>).
      </Callout>
    </>
  );
}

export function Notices() {
  return (
    <>
      <Lead>
        Fiscal. avisa a la URL de avisos del sistema cliente cada vez que un documento cambia de estado o algo exige acción
        del comercio. Los avisos van firmados como las peticiones.
      </Lead>
      <H2 id="cuando-llegan">Cuándo llegan</H2>
      <Table
        head={['Evento', 'Cuándo']}
        rows={[
          [<Code key="1">document.state_changed</Code>, 'Un documento queda validated, rejected o entra en contingency_dian'],
          [<Code key="2">issuer.alert</Code>, 'Certificado por vencer, numeración por agotarse, resolución por vencer, plazo de contingencia o un rechazo'],
          [<Code key="3">ping</Code>, '«Enviar aviso de prueba» en la consola; no se reintenta'],
        ]}
      />
      <P>
        Los cuerpos están en <DocLink to="eventos">Eventos de aviso</DocLink>.
      </P>

      <H2 id="verificar">Verificar la firma</H2>
      <P>
        Mismas cabeceras <Code>X-Fiscal-*</Code>, firmadas con el secreto vigente. El texto canónico usa la ruta y la consulta
        de la URL de avisos registrada. Verifica firma y hora antes de creer el aviso:
      </P>
      <CodeTabs
        examples={{
          python: `import hashlib, hmac, time

def fiscal_notice_is_genuine(request, secret):
    ts = request.headers.get('X-Fiscal-Timestamp', '')
    if not ts.isdigit() or abs(time.time() - int(ts)) > 300:
        return False
    canonical = '\\n'.join([ts, 'POST', request.get_full_path(), hashlib.sha256(request.body).hexdigest()])
    expected = hmac.new(secret.encode(), canonical.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, request.headers.get('X-Fiscal-Signature', ''))`,
          node: `import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// Con el cuerpo crudo: express.raw({ type: 'application/json' })
export function fiscalNoticeIsGenuine(req, secret) {
  const ts = req.get('X-Fiscal-Timestamp') ?? ''
  if (!/^\\d+$/.test(ts) || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false
  const bodyHash = createHash('sha256').update(req.body).digest('hex')
  const canonical = [ts, 'POST', req.originalUrl, bodyHash].join('\\n')
  const expected = Buffer.from(createHmac('sha256', secret).update(canonical).digest('hex'))
  const received = Buffer.from(req.get('X-Fiscal-Signature') ?? '')
  return expected.length === received.length && timingSafeEqual(expected, received)
}`,
        }}
      />
      <Callout tone="warning" title="Al rotar el secreto">
        Fiscal. firma con el nuevo desde ese momento: durante el periodo de gracia, acepta la firma con cualquiera de los dos.
      </Callout>

      <H2 id="reintentos">Reintentos</H2>
      <P>
        Un <Code>2xx</Code> lo da por entregado. Si no, se reintenta a los 30 s, 1 min, 5 min, 15 min y luego cada hora, hasta 30
        intentos. La consola muestra la bitácora y permite reintentar. Como respaldo, consulta{' '}
        <Code>GET /api/v1/documents/&#123;id&#125;/</Code> de tus pendientes.
      </P>
    </>
  );
}

export function Contingencies() {
  return (
    <>
      <Lead>Dos tipos: cuando la DIAN no responde (tipo 04) y cuando el comercio facturó en papel (tipo 03).</Lead>
      <H2 id="tipo-04">La DIAN no responde (tipo 04)</H2>
      <P>
        Fiscal. reintenta según el anexo (§12.4). Si la DIAN sigue sin responder, la factura se firma de nuevo como tipo 04 con
        el mismo número y CUFE y queda en <Code>contingency_dian</Code>: <Strong>se puede entregar al comprador</Strong>.
        Fiscal. reintenta cada 30 minutos; el plazo para transmitirla es de 48 horas.
      </P>
      <Ul>
        <li>
          El aviso <Code>document.state_changed</Code> llega con <Code>invoice_type</Code> <Code>04</Code> y{' '}
          <Code>contingency_started_at</Code>.
        </li>
        <li>Las notas no tienen contingencia: esperan a que la DIAN responda.</li>
        <li>
          A las 24 y 40 horas llega <Code>issuer.alert</Code> <Code>contingency_deadline</Code>.
        </li>
      </Ul>
      <H2 id="tipo-03">El comercio facturó en papel (tipo 03)</H2>
      <P>
        Si el comercio expidió una factura de talonario porque su sistema o Fiscal. no estaban disponibles, el sistema cliente
        la envía con <Code>&quot;issuer_contingency&quot;: true</Code> en el documento comercial, el prefijo y número del rango de{' '}
        <Code>contingency</Code> y la fecha real de la factura de papel. Debe enviarse dentro de las 48 horas siguientes a
        superar la falla.
      </P>
    </>
  );
}

export function Errors() {
  return (
    <>
      <Lead>Todo error tiene la misma forma, con un código estable y un mensaje en español listo para mostrar.</Lead>
      <CodeBlock code={`{"error": {"code": "issuer_not_found", "message": "No hay un emisor con ese NIT."}}`} lang="json" />
      <P>
        Los errores de validación agregan <Code>fields</Code>; los del documento, <Code>problems</Code>.
      </P>
      <H2 id="codigos">Códigos</H2>
      <Table
        head={['Código', 'HTTP', 'Qué hacer']}
        rows={[
          ['signature_missing / expired / invalid', '401', 'Revisar la firma (Autenticación)'],
          ['origin_required / origin_not_allowed', '403', 'Enviar X-Fiscal-Origin con un host del dominio'],
          ['origin_mismatch', '403', 'El emisor es de otro host: usar el suyo'],
          ['ip_not_allowed', '403', 'Llamar desde una IP registrada o pedir que se registre'],
          ['issuer_not_found / document_not_found', '404', 'No existe en este sistema cliente'],
          ['invalid_data', '400', 'Ver fields'],
          ['invalid_document', '400', 'Ver problems: la lista completa'],
          ['issuer_not_ready', '409', 'Falta certificado vigente o software en su ambiente'],
          ['issuer_inactive', '409', 'Un administrador desactivó el emisor'],
          ['number_out_of_range', '400', 'El número no está en un rango vigente'],
          ['idempotency_conflict / duplicate_number', '409', 'Misma clave con otro contenido; número repetido'],
          ['environment_locked', '400', 'Producción solo con el paso a producción'],
          ['test_set_not_ready / production_not_ready', '409', 'Lo que falta viene en message'],
        ]}
      />
      <H2 id="que-reintentar">Qué reintentar</H2>
      <Ul>
        <li>
          <Strong>Errores de red y 5xx:</Strong> reintentar con la misma <Code>idempotency_key</Code>.
        </li>
        <li>
          <Strong>4xx:</Strong> no reintentar igual; corregir lo que dice el mensaje.
        </li>
      </Ul>
    </>
  );
}
