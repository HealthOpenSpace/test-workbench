import {
  GherkinScenario,
  GherkinStep,
  ParsedScenario,
  ParseIssue,
  Step,
  DataModel
} from '../types';

/** Parse a Gherkin doc string (triple-quoted block) starting at line index i+1 */
function parseDocString(lines: string[], startIdx: number): { text: string; endIdx: number } | null {
  let j = startIdx;
  // skip blank lines
  while (j < lines.length && lines[j].trim() === '') j++;
  if (j >= lines.length) return null;
  const openMatch = /^(\s*)"""(.*)$/.exec(lines[j]);
  if (!openMatch) return null;
  const indent = openMatch[1].length;
  const firstLine = openMatch[2]; // content after opening """
  const contentLines: string[] = [];
  if (firstLine.trim()) contentLines.push(firstLine);
  j++;
  while (j < lines.length) {
    const line = lines[j];
    if (/^\s*"""/.test(line)) {
      j++; // consume closing """
      return { text: contentLines.join('\n'), endIdx: j };
    }
    // strip leading indent (up to the indent of the opening """)
    const stripped = line.length >= indent ? line.slice(indent) : line.trimStart();
    contentLines.push(stripped);
    j++;
  }
  // unterminated doc string — return what we have
  return { text: contentLines.join('\n'), endIdx: j };
}

import { loadCatalog, Catalog, CatalogAction } from './languageCatalog';


export type IRAction =
  | { type: 'call', path: string, output?: string, from?: string, to?: string, inputs?: Record<string,string> }
  | { type: 'verify', handler: string, desc?: string, inputs: Record<string,string> }
  | { type: 'process', handler: string, operation: string, output?: string, from?: string, to?: string, inputs: Record<string,string>, hidden?: boolean }
  | { type: 'assign', to: string, value: string }
  | { type: 'listAppend', list: string, item: Record<string,string> }
  | { type: 'foreach', from: string, do: IRAction[] }
  | { type: 'declareActor', id: string, name?: string, role?: string, endpoint?: string, canonical?: string };


type ServicesMap = Record<string, string>; // { "FHIR-validator": "1.2.0", "Monitor": "2.1.0" }

/** Minimal, self-contained parser + catalog expander */
export class GherkinParser {
  private catalog?: Catalog;
  private model?: DataModel;
  private services: ServicesMap;
  private strictRequirements: boolean;  

  constructor(model?: DataModel, options?: { services?: ServicesMap; strictRequirements?: boolean }) {
    this.model = model;
    this.services = options?.services ?? {};
    this.strictRequirements = options?.strictRequirements ?? false; // warning by default
  }

  /** Loads /lang/en.yml once */
  async ensureCatalog(locale='en') {
    if (!this.catalog) this.catalog = await loadCatalog(locale);
  }

  /** Basic Gherkin parser: Feature/Scenarios/Steps (+ DataTables) -> ParsedFeature
   *  Supports multiple scenarios; Background steps are shared across all scenarios. */
  parse(text: string): ParsedScenario {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const issues: ParseIssue[] = [];
    let inFeaturePreamble = false;
    let featureDescription = '';

    let featureTitle = '';
    const backgroundSteps: Step[] = [];
    const scenarios: { name: string; steps: Step[] }[] = [];
    let currentTarget: Step[] | null = null; // null = not collecting steps yet
    let currentScenarioName = '';

    const STEP_RE = /^(Given|When|Then|And|But)\s+(.*)$/i;
    let i = 0;
    while (i < lines.length) {
      const raw = lines[i];
      const lineNo = i + 1;
      const line = stripInlineComments(raw).trim();

      if (!line) { i++; continue; }

      if (/^Feature:/i.test(line)) {
        featureTitle = line.replace(/^Feature:\s*/i, '').trim();
        inFeaturePreamble = true;
        i++; continue;
      }

      if (/^Background:/i.test(line)) {
        inFeaturePreamble = false;
        currentTarget = backgroundSteps;
        i++; continue;
      }

      if (/^Scenario:/i.test(line)) {
        currentScenarioName = line.replace(/^Scenario:\s*/i, '').trim();
        const scenarioSteps: Step[] = [];
        scenarios.push({ name: currentScenarioName, steps: scenarioSteps });
        currentTarget = scenarioSteps;
        inFeaturePreamble = false;
        i++; continue;
      }

      if (inFeaturePreamble) {
        // Collect feature description lines
        if (featureDescription) featureDescription += ' ';
        featureDescription += line;
        i++; continue;
      }

      if (!currentTarget) { i++; continue; }

      const m = STEP_RE.exec(line);
      if (m) {
        const type = m[1] as Step['type'];
        const text = m[2].trim();

        // optional data table
        const tableRows: Record<string,string>[] = [];
        let j = i + 1;
        while (j < lines.length && /^\s*\|.*\|\s*$/.test(lines[j])) {
          const row = splitRow(stripInlineComments(lines[j]));
          if (tableRows.length === 0) {
            tableRows.push(Object.fromEntries(row.map((h) => [h, h])));
          } else {
            const header = Object.keys(tableRows[0]);
            const obj: Record<string,string> = {};
            header.forEach((h, idx) => { obj[h] = row[idx] ?? ''; });
            tableRows.push(obj);
          }
          j++;
        }
        let table: Record<string,string>[] | undefined;
        if (tableRows.length > 1) table = tableRows.slice(1);

        // optional doc string (triple-quoted block)
        let docString: string | undefined;
        if (!table || table.length === 0) {
          const ds = parseDocString(lines, j);
          if (ds) {
            docString = ds.text;
            j = ds.endIdx;
          }
        }

        currentTarget.push({
          type,
          text,
          line: lineNo,
          table,
          docString
        } as Step);

        i = j;
        continue;
      }

      if (/^\s*#/.test(raw)) { i++; continue; }

      // Unknown line -> warning
      issues.push({ line: lineNo, severity: 'warning', message: `Unrecognized line: "${line}"` });
      i++;
    }

    if (scenarios.length === 0) {
      issues.push({ line: 1, severity: 'error', message: 'Missing "Scenario:" line' });
    }

    // Build scenarios with background steps prepended
    const builtScenarios = scenarios.map(s => ({
      name: s.name,
      steps: [...backgroundSteps, ...s.steps]
    }));

    // For backwards compat, the first scenario is the "main" scenario
    const firstScenario = builtScenarios[0] || { name: 'Scenario', steps: [] };

    const scenario: GherkinScenario = {
      feature: featureTitle || 'Feature',
      name: firstScenario.name,
      steps: firstScenario.steps
    } as unknown as GherkinScenario;

    const parsed: ParsedScenario = {
      scenario,
      errors: issues
    } as ParsedScenario;

    // Attach all scenarios + feature metadata for test suite generation
    (parsed as any).__scenarios = builtScenarios;
    (parsed as any).__featureTitle = featureTitle || 'Feature';
    (parsed as any).__featureDescription = featureDescription;

    return parsed;
  }

  /** Expand a single step to IR actions using the language catalog */
  expandStep(step: Step): { actions: IRAction[]; mappingLabel?: string; issues: ParseIssue[] } {
    const issues: ParseIssue[] = [];
    const text = step.text.trim();

    if (!this.catalog) {
      issues.push({ line: step.line, severity: 'error', message: 'Language catalog not loaded' });
      return { actions: [], issues };
    }

    for (const entry of this.catalog.steps) {
      const re = new RegExp(entry.match, 'i');
      const m = re.exec(text);
      if (!m) continue;

      // 1) Table validation (unchanged)
      if (entry.table?.required?.length) {
        if (!step.table || step.table.length === 0) {
          issues.push({ line: step.line, severity: 'error', message: 'Step requires a table' });
          return { actions: [], issues };
        }
        const missing = entry.table.required.filter(k => !Object.keys(step.table![0]).includes(k));
        if (missing.length) {
          issues.push({ line: step.line, severity: 'error', message: `Missing columns: ${missing.join(', ')}` });
          return { actions: [], issues };
        }
      }

      // 2) REQUIREMENTS CHECK (NEW)
      const reqs = Array.isArray(entry.requires) ? entry.requires : (entry.requires ? [entry.requires] : []);
      for (const req of reqs) {
        const available = this.services[req.service];
        const ok = !!available && (!req.version || satisfies(available, req.version));
        if (!ok) {
          issues.push({
            line: step.line,
            severity: this.strictRequirements ? 'error' : 'warning',
            message: !available
              ? `Missing required service "${req.service}" for step "${text}"`
              : `Service "${req.service}" version ${available} does not satisfy requirement ${req.version}`
          });
        }
      }

      // 3) Expand actions (unchanged)
      const ctx = { groups: m.slice(1), tableRows: step.table || [], docString: step.docString || '' };
      const actions = materialize(entry.actions, ctx);
      const label = entry.match.replace(/^\^|\$$/g, '');
      return { actions, mappingLabel: label, issues };
    }

    issues.push({ line: step.line, severity: 'error', message: `No mapping for step: "${text}"` });
    return { actions: [], issues };
  }



  

  getStepMapping(text: string): string | null {
    if (!this.catalog) {
      // fire & forget; next render will have it
      this.ensureCatalog('en').catch(() => {});
      return null;
    }
    for (const entry of this.catalog.steps) {
      if (new RegExp(entry.match, 'i').test(text.trim())) {
        return entry.match.replace(/^\^|\$$/g, '');
      }
    }
    return null;
  }

  /** Parse (if needed), load catalog, expand steps → IR; append issues to parsed.errors */
  async expandScenarioToIR(parsed: ParsedScenario) {
    await this.ensureCatalog('en');
    const allIssues: ParseIssue[] = [];

    // Expand all scenarios
    const scenarios = (parsed as any).__scenarios as { name: string; steps: Step[] }[] | undefined;
    const scenarioIRs: { name: string; ir: IRAction[] }[] = [];

    if (scenarios && scenarios.length > 0) {
      for (const sc of scenarios) {
        const scIr: IRAction[] = [];
        for (const s of sc.steps) {
          const { actions, issues } = this.expandStep(s);
          allIssues.push(...issues);
          scIr.push(...actions);
        }
        scenarioIRs.push({ name: sc.name, ir: scIr });
      }
    } else {
      // Fallback: single scenario from parsed.scenario.steps
      const ir: IRAction[] = [];
      for (const s of parsed.scenario.steps) {
        const { actions, issues } = this.expandStep(s);
        allIssues.push(...issues);
        ir.push(...actions);
      }
      scenarioIRs.push({ name: parsed.scenario.name || 'Test Case', ir });
    }

    (parsed as any).__scenarioIRs = scenarioIRs;
    (parsed as any).__ir = scenarioIRs[0]?.ir ?? []; // backwards compat
    parsed.errors = [...(parsed.errors || []), ...allIssues];
    return parsed;
  }
}

/** Helpers */

function splitRow(line: string): string[] {
  // split | a | b | c |  -> ["a","b","c"] (trimmed)
  const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return cells.map(c => c.trim());
}

function materialize(actions: CatalogAction[], ctx: any): IRAction[] {
  const out: IRAction[] = [];
  const subst = (v: any): any =>
    typeof v === 'string'
      ? v.replace(/\$docString/g, () => ctx.docString ?? '')
           .replace(/\$([0-9]+)/g, (_: any, i: string) => ctx.groups[Number(i)-1] ?? '')
           .replace(/\$row\.([A-Za-z0-9_]+)/g, (_: any, k: string) => ctx._row?.[k] ?? '')
      : v;

  const visit = (a: any) => {
    const clone = JSON.parse(JSON.stringify(a));

    if (clone.foreach) {
      for (const row of ctx.tableRows) {
        const rctx = { ...ctx, _row: row };
        clone.foreach.do.forEach((child: any) => {
          const before = ctx._row;
          ctx._row = rctx._row;
          visit(child);
          ctx._row = before;
        });
      }
      return;
    }
    if (clone.declareActor) {
      out.push({ type: 'declareActor', id: subst(clone.declareActor.id), name: subst(clone.declareActor.name ?? ''), role: subst(clone.declareActor.role ?? ''), endpoint: subst(clone.declareActor.endpoint ?? ''), canonical: subst(clone.declareActor.canonical ?? '') });
      return;
    }
    if (clone.call) {
      if (clone.call.inputs) for (const k in clone.call.inputs) clone.call.inputs[k] = subst(clone.call.inputs[k]);
      out.push({ type: 'call', path: clone.call.path, output: clone.call.output, from: subst(clone.call.from ?? ''), to: subst(clone.call.to ?? ''), inputs: clone.call.inputs });
      return;
    }
    if (clone.verify) {
      for (const k in clone.verify.inputs) clone.verify.inputs[k] = subst(clone.verify.inputs[k]);
      out.push({ type: 'verify', handler: clone.verify.handler, desc: clone.verify.desc, inputs: clone.verify.inputs });
      return;
    }
    if (clone.process) {
      for (const k in clone.process.inputs) clone.process.inputs[k] = subst(clone.process.inputs[k]);
      out.push({ type: 'process', handler: clone.process.handler, operation: clone.process.operation, output: clone.process.output, from: clone.process.from ? subst(clone.process.from) : undefined, to: clone.process.to ? subst(clone.process.to) : undefined, inputs: clone.process.inputs, hidden: clone.process.hidden });
      return;
    }
    if (clone.assign) {
      clone.assign.value = subst(clone.assign.value);
      out.push({ type: 'assign', to: clone.assign.to, value: clone.assign.value });
      return;
    }
    if (clone.listAppend) {
      const item: Record<string,string> = {};
      for (const k in clone.listAppend.item) item[k] = subst(clone.listAppend.item[k]);
      out.push({ type: 'listAppend', list: clone.listAppend.list, item });
      return;
    }
  };

  actions.forEach(visit);
  return out;
}

/** Semver helpers (very small, supports >=, >, =, <=, < with x.y[.z]) */
function satisfies(actual: string, requirement: string): boolean {
  // requirement examples: ">=1.0", ">2.0.1", "1.3.0", "<=2.1"
  const m = requirement.match(/^\s*(>=|<=|>|<|=)?\s*([0-9]+(?:\.[0-9]+){0,2})\s*$/);
  if (!m) return false;
  const op = (m[1] || '>=').trim();
  const req = m[2];
  const cmp = compareVersions(normalize(actual), normalize(req));
  switch (op) {
    case '>':  return cmp > 0;
    case '>=': return cmp >= 0;
    case '<':  return cmp < 0;
    case '<=': return cmp <= 0;
    case '=':  return cmp === 0;
    default:   return cmp >= 0;
  }
}

function normalize(v: string): [number, number, number] {
  const parts = v.split('.').map(n => parseInt(n, 10));
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

function compareVersions(a: [number,number,number], b: [number,number,number]): number {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

function stripInlineComments(raw: string): string {
  // removes '#' and everything after, unless inside quotes
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
    if (ch === '#' && !inDouble && !inSingle) {
      return raw.slice(0, i);
    }
  }
  return raw;
}