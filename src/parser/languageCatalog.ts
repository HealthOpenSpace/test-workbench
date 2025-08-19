import yaml from 'js-yaml';

// If you prefer dynamic locale switching, make the path configurable.
export type CatalogAction =
  | { call: { path: string; output?: string; inputs?: Record<string,string> } }
  | { verify: { handler: string; desc?: string; inputs: Record<string,string> } }
  | { process: { handler: string; operation: string; output?: string; inputs: Record<string,string>; hidden?: boolean } }
  | { assign: { to: string; value: string } }
  | { listAppend: { list: string; item: Record<string,string> } }
  | { foreach: { from: string; do: CatalogAction[] } };

export interface CatalogStep {
  match: string;                // regex string
  table?: { required: string[] };
  actions: CatalogAction[];
}

export interface Catalog {
  version: number;
  locale: string;
  steps: CatalogStep[];
}

export async function loadCatalog(locale = 'en'): Promise<Catalog> {
  // Served statically by Vite from /public (so put the file in /public/lang/en.yml)
  const res = await fetch(`/lang/${locale}.yml`);
  const text = await res.text();
  return yaml.load(text) as Catalog;
}
