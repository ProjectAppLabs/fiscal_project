import type { ComponentType } from 'react';

import type { DocsSlug } from '@/lib/apiDocs/nav';
import { Authentication, Environments, Introduction, Origin, QuickStart } from './start';
import { Contingencies, EnrolIssuer, Errors, IssueDocuments, Notes, Notices, Production, TestSet } from './guides';
import { Events, Reference } from './reference';

/** The content of each API docs page; a slug in the nav without content here fails the typecheck. */
export const DOC_CONTENT: Record<DocsSlug, ComponentType> = {
  introduccion: Introduction,
  'inicio-rapido': QuickStart,
  autenticacion: Authentication,
  origen: Origin,
  ambientes: Environments,
  'inscribir-emisor': EnrolIssuer,
  'set-de-pruebas': TestSet,
  'paso-a-produccion': Production,
  'emitir-documentos': IssueDocuments,
  notas: Notes,
  avisos: Notices,
  contingencias: Contingencies,
  errores: Errors,
  referencia: Reference,
  eventos: Events,
};
