'use client';

import { Fragment, type ReactNode } from 'react';

import { ConsoleLoadError } from '@/components/console/ConsoleStatus';
import { SkeletonCard } from '@/components/ui/States';
import { HTTP_METHODS, type OpenApiOperation, type OpenApiSchema, type OpenApiSpec } from '@/lib/services/apiDocs';
import { useApiDocsStore } from '@/lib/stores/apiDocsStore';
import { Callout, Code, CodeTabs, DocLink, H2, Lead, MethodBadge, P, Table, operationAnchor } from '../Prose';
import { EXAMPLE, call, useDocVars } from '../examples';

/** The specification, or its loading and error states. */
function WithSpec({ children }: { children: (spec: OpenApiSpec) => ReactNode }) {
  const spec = useApiDocsStore((s) => s.data?.spec);
  const status = useApiDocsStore((s) => s.status);
  const load = useApiDocsStore((s) => s.load);
  if (spec) return <>{children(spec)}</>;
  if (status === 'error') return <ConsoleLoadError message="No pudimos cargar la especificación de la API." onRetry={() => void load(true)} />;
  return (
    <div className="mt-8 flex flex-col gap-4">
      <SkeletonCard lines={4} />
      <SkeletonCard lines={4} />
    </div>
  );
}

export function Reference() {
  const { base } = useDocVars();
  return (
    <>
      <Lead>
        Cada ruta de <Code>/api/v1/</Code>, generada del <Code>openapi.json</Code> que una prueba del backend mantiene al día. Todas
        piden la firma (<DocLink to="autenticacion">Autenticación</DocLink>) y, con dominio registrado, <Code>X-Fiscal-Origin</Code>.
      </Lead>
      <P>
        Base: <Code>{base}</Code>. Los ejemplos usan la función <Code>fiscal()</Code> del <DocLink to="inicio-rapido" hash="2-firmar">inicio rápido</DocLink>.
      </P>
      <WithSpec>
        {(spec) => {
          const tags = spec.tags?.length ? spec.tags : [{ name: 'API' }];
          return tags.map((tag) => {
            const operations = Object.entries(spec.paths).flatMap(([path, item]) =>
              HTTP_METHODS.filter((method) => item[method] && (item[method]?.tags ?? ['API']).includes(tag.name)).map((method) => ({ path, method, operation: item[method] as OpenApiOperation })),
            );
            if (!operations.length) return null;
            return (
              <Fragment key={tag.name}>
                <H2 id={slugify(tag.name)}>{tag.name}</H2>
                {tag.description ? <P>{tag.description}</P> : null}
                {operations.map(({ path, method, operation }) => (
                  <Operation key={`${method} ${path}`} method={method} operation={operation} path={path} spec={spec} />
                ))}
              </Fragment>
            );
          });
        }}
      </WithSpec>
    </>
  );
}

function Operation({ method, path, operation, spec }: { method: string; path: string; operation: OpenApiOperation; spec: OpenApiSpec }) {
  const body = operation.requestBody?.content?.['application/json'];
  const bodySchema = body?.schema ? resolve(body.schema, spec) : null;
  const example = path.replace('{nit}', EXAMPLE.nit).replace('{id}', '4821').replace('{kind}', 'pdf');
  const payload = body ? JSON.stringify(body.example ?? sampleOf(bodySchema, spec), null, 2) : undefined;

  return (
    <section aria-labelledby={operationAnchor(method, path)} className="mt-8 rounded-lg px-5 py-5 shadow-[inset_0_0_0_1px_var(--line)]">
      <h3 className="flex scroll-mt-28 flex-wrap items-center gap-2 text-[17px] font-bold text-ink" data-doc-heading="3" data-doc-title={`${method.toUpperCase()} ${path}`} id={operationAnchor(method, path)}>
        <MethodBadge method={method} />
        <span className="font-mono text-[14px] font-semibold">{path}</span>
      </h3>
      {operation.summary ? <p className="mt-2 text-[16px] font-semibold text-ink">{operation.summary}</p> : null}
      {operation.description ? <Description text={operation.description} /> : null}
      {operation.parameters?.length ? (
        <Table
          head={['Parámetro', 'En', 'Descripción']}
          rows={operation.parameters.map((parameter) => [<Code key="n">{parameter.name}</Code>, parameter.in === 'path' ? 'ruta' : parameter.in, parameter.description ?? '—'])}
        />
      ) : null}
      {bodySchema ? (
        <>
          <p className="mt-6 text-label">Cuerpo</p>
          <SchemaTable schema={bodySchema} spec={spec} />
        </>
      ) : null}
      <p className="mt-6 text-label">Respuestas</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {Object.entries(operation.responses ?? {})
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([code, response]) => (
            <li className="flex gap-3 text-[14px] text-ink-2" key={code}>
              <span className={`w-10 shrink-0 font-mono font-bold ${code.startsWith('2') ? 'text-success-fg' : 'text-danger-fg'}`}>{code}</span>
              <span>{responseDescription(response, spec)}</span>
            </li>
          ))}
      </ul>
      <CodeTabs examples={call(method.toUpperCase(), example, payload)} />
    </section>
  );
}

export function Events() {
  return (
    <>
      <Lead>
        Lo que Fiscal. envía por <Code>POST</Code> a la URL de avisos del sistema cliente, firmado con las cabeceras{' '}
        <Code>X-Fiscal-*</Code>. Cómo verificarlos: <DocLink to="avisos" hash="verificar">Avisos</DocLink>.
      </Lead>
      <WithSpec>
        {(spec) =>
          Object.entries(spec.webhooks ?? {}).map(([name, item]) => {
            const operation = item.post;
            const schema = operation?.requestBody?.content?.['application/json']?.schema;
            const resolved = schema ? resolve(schema, spec) : null;
            return (
              <Fragment key={name}>
                <H2 id={slugify(name)}>{name}</H2>
                {operation?.summary ? <P className="font-semibold text-ink">{operation.summary}</P> : null}
                {operation?.description ? <Description text={operation.description} /> : null}
                {resolved ? <SchemaTable schema={resolved} spec={spec} /> : null}
              </Fragment>
            );
          })
        }
      </WithSpec>
      <Callout tone="tip">
        Responde <Code>2xx</Code> rápido y procesa después: un aviso que tarda más de lo que espera Fiscal. se reintenta.
      </Callout>
    </>
  );
}

function Description({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n{2,}/).map((paragraph, index) => (
        <P key={index}>{inlineCode(paragraph)}</P>
      ))}
    </>
  );
}

/** `code` in OpenAPI descriptions becomes inline code; everything else stays text (never HTML). */
function inlineCode(text: string): ReactNode[] {
  return text.split(/(`[^`]+`)/).map((part, index) => (part.startsWith('`') && part.endsWith('`') ? <Code key={index}>{part.slice(1, -1)}</Code> : part));
}

/** The fields of an object schema, one level deep (nested objects show their own fields as parent.child). */
function SchemaTable({ schema, spec }: { schema: OpenApiSchema; spec: OpenApiSpec }) {
  const rows: ReactNode[][] = [];
  const walk = (current: OpenApiSchema, prefix: string, depth: number) => {
    const required = new Set(current.required ?? []);
    Object.entries(current.properties ?? {}).forEach(([name, raw]) => {
      const property = resolve(raw, spec);
      rows.push([
        <Code key="n">{prefix + name}</Code>,
        <span className="font-mono text-[12px] text-ink-3" key="t">
          {typeOf(property)}
          {required.has(name) ? <span className="ml-1 text-danger-fg">*</span> : null}
        </span>,
        <span key="d">
          {property.description ? inlineCode(property.description) : '—'}
          {property.enum ? <span className="mt-1 block text-[12px] text-ink-3">{property.enum.join(' · ')}</span> : null}
        </span>,
      ]);
      const inner = property.type === 'array' && property.items ? resolve(property.items, spec) : property;
      if (depth < 1 && inner.properties) walk(inner, `${prefix}${name}${property.type === 'array' ? '[]' : ''}.`, depth + 1);
    });
  };
  walk(schema, '', 0);
  if (!rows.length) return <P>{schema.description ? inlineCode(schema.description) : 'Sin campos.'}</P>;
  return <Table head={['Campo', 'Tipo', 'Descripción']} rows={rows} />;
}

function resolve(schema: OpenApiSchema, spec: OpenApiSpec): OpenApiSchema {
  if (!schema.$ref) return schema;
  const name = schema.$ref.split('/').pop() ?? '';
  return spec.components?.schemas?.[name] ?? schema;
}

function typeOf(schema: OpenApiSchema): string {
  const type = Array.isArray(schema.type) ? schema.type.join(' | ') : schema.type;
  if (type === 'array') return `${schema.items?.$ref ? schema.items.$ref.split('/').pop() : (schema.items?.type ?? 'valor')}[]`;
  return type ?? (schema.oneOf || schema.anyOf ? 'uno de varios' : 'objeto');
}

function responseDescription(response: { $ref?: string; description?: string }, spec: OpenApiSpec): ReactNode {
  if (response.$ref) return inlineCode(spec.components?.responses?.[response.$ref.split('/').pop() ?? '']?.description ?? '');
  return inlineCode(response.description ?? '');
}

/** A minimal example body from the schema's examples, for the request samples. */
function sampleOf(schema: OpenApiSchema | null, spec: OpenApiSpec, depth = 0): unknown {
  if (!schema) return {};
  const resolved = resolve(schema, spec);
  if (resolved.example !== undefined) return resolved.example;
  if (resolved.properties && depth < 2) {
    return Object.fromEntries(
      Object.entries(resolved.properties)
        .filter(([name]) => (resolved.required ?? []).includes(name))
        .map(([name, property]) => [name, sampleOf(property, spec, depth + 1)]),
    );
  }
  if (resolved.enum?.length) return resolved.enum[0];
  const type = Array.isArray(resolved.type) ? resolved.type[0] : resolved.type;
  if (type === 'array') return [];
  if (type === 'boolean') return true;
  if (type === 'integer' || type === 'number') return 0;
  return type === 'object' ? {} : '…';
}

function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
