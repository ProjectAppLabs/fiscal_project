'use client';

import { API_ENDPOINTS } from '@/lib/constants';
import { api } from '@/lib/services/http';

/** The parts of an OpenAPI 3.1 document the console's reference reads. */
export interface OpenApiSchema {
  type?: string | string[];
  description?: string;
  enum?: (string | number)[];
  format?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  example?: unknown;
  $ref?: string;
  oneOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  pattern?: string;
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface OpenApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: { name: string; in: string; required?: boolean; description?: string; schema?: OpenApiSchema }[];
  requestBody?: { description?: string; content?: Record<string, { schema?: OpenApiSchema; example?: unknown }> };
  responses?: Record<string, { $ref?: string; description?: string; content?: Record<string, { schema?: OpenApiSchema; example?: unknown }> }>;
}

export interface OpenApiSpec {
  info: { title: string; version: string; description?: string };
  tags?: { name: string; description?: string }[];
  paths: Record<string, Record<string, OpenApiOperation>>;
  webhooks?: Record<string, Record<string, OpenApiOperation>>;
  components?: { schemas?: Record<string, OpenApiSchema>; responses?: Record<string, { description?: string }> };
}

export interface ApiDocsData {
  /** Public address of the machine API; empty when the console's own origin serves it. */
  api_base_url: string;
  spec: OpenApiSpec;
}

export async function fetchApiDocs(): Promise<ApiDocsData> {
  return (await api.get<ApiDocsData>(API_ENDPOINTS.CONSOLE_API_DOCS)).data;
}

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
