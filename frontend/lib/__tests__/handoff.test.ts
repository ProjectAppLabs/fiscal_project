import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

import { HANDOFF_GUIDES, fillHandoff, handoffUrl } from '../handoff';

const ORIGIN = 'https://fiscal.example.co';
const TEMPLATE = 'Consola {{CONSOLA_URL}} · emisor {{EMISOR}} en {{EMISOR_URL}}';
const readGuide = (file: string) => readFileSync(join(__dirname, '../../public/handoff', file), 'utf-8');

describe('fillHandoff', () => {
  it('fills the issuer with its name, NIT and page', () => {
    const text = fillHandoff(TEMPLATE, { origin: ORIGIN, issuer: { id: 3, legal_name: 'Restaurante de Prueba SAS', nit: '900373115' } }, '—');

    expect(text).toBe('Consola https://fiscal.example.co · emisor Restaurante de Prueba SAS (NIT 900373115) en https://fiscal.example.co/issuers/3');
  });

  it('names an issuer known only by its id', () => {
    const text = fillHandoff(TEMPLATE, { origin: ORIGIN, issuer: { id: 3 } }, '—');

    expect(text).toBe('Consola https://fiscal.example.co · emisor #3 en https://fiscal.example.co/issuers/3');
  });

  it('asks for the issuer when the page has none', () => {
    const text = fillHandoff(TEMPLATE, { origin: ORIGIN, issuer: null }, 'por definir');

    expect(text).toBe('Consola https://fiscal.example.co · emisor por definir en https://fiscal.example.co/issuers');
  });
});

describe('handoff guides', () => {
  it('serves each guide from the public handoff folder', () => {
    expect(handoffUrl('production')).toBe('/handoff/06-paso-a-produccion.md');
  });

  // Every guide must carry the safety rules, the console address and a summary without secrets.
  const REQUIRED = ['## Reglas que no se negocian', '{{CONSOLA_URL}}', '**No incluyas** PIN, clave técnica, contraseñas ni secretos.'];

  it.each(HANDOFF_GUIDES.flatMap((guide) => REQUIRED.map((text) => [guide.file, text])))('%s contains «%s»', (file, text) => {
    expect(readGuide(file)).toContain(text);
  });
});
