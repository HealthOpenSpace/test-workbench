// xmlGenerator.ts
import type { ParsedScenario } from '../types';
import type { IRAction } from './gherkinParser';

export interface GeneratedFile {
  filename: string;
  xml: string;
  type: 'testsuite' | 'testcase';
  id: string;
  name: string;
}

export interface XMLOutput {
  testcaseName: string;
  xml: string;               // backwards compat: full combined XML preview
  files: GeneratedFile[];    // individual files for zip download
  scriptletCount?: number;
}

export class XMLGenerator {
  constructor(private parser: any) {}

  generate(parsed: ParsedScenario): XMLOutput {
    const featureTitle = (parsed as any).__featureTitle ?? (parsed.scenario as any).feature ?? 'Feature';
    const featureDescription = (parsed as any).__featureDescription ?? featureTitle;
    const scenarioIRs = (parsed as any).__scenarioIRs as { name: string; ir: IRAction[] }[] | undefined;

    const files: GeneratedFile[] = [];

    // If we have multiple scenarios, generate individual test case files + a test suite
    const scenarios = scenarioIRs && scenarioIRs.length > 0
      ? scenarioIRs
      : [{ name: parsed.scenario.name || 'Test Case', ir: (parsed as any).__ir ?? [] }];

    // Generate individual test case XMLs
    for (const sc of scenarios) {
      const testcaseId = toId(sc.name);
      const actors = collectActors(sc.ir);
      const stepsXml = emitIR(sc.ir);
      const actorsXml = emitActors(actors);

      const testcaseXml = `<?xml version="1.0" encoding="UTF-8"?>
<testcase id="${escapeAttr(testcaseId)}"
          xmlns="http://www.gitb.com/tdl/v1/"
          xmlns:gitb="http://www.gitb.com/core/v1/">
  <metadata>
    <gitb:name>${escapeXml(sc.name)}</gitb:name>
    <gitb:version>1.0</gitb:version>
    <gitb:description>${escapeXml(featureTitle)}</gitb:description>
  </metadata>

  <actors>
${indent(actorsXml, 4)}
  </actors>

  <steps stopOnError="true">
${indent(stepsXml || '<!-- no steps generated for this scenario -->', 4)}
  </steps>

  <output>
    <success>
      <default>"Test case completed successfully."</default>
    </success>
    <failure>
      <default>"Test case failed. Check step reports and logs."</default>
    </failure>
  </output>
</testcase>`;

      files.push({
        filename: `${testcaseId}.xml`,
        xml: testcaseXml,
        type: 'testcase',
        id: testcaseId,
        name: sc.name
      });
    }

    // Generate test suite XML
    const suiteId = toId(featureTitle);
    const testcaseRefs = files
      .filter(f => f.type === 'testcase')
      .map(f => `  <testcase id="${escapeAttr(f.id)}"/>`)
      .join('\n');

    // Collect all actors from all scenarios
    const allActors = new Map<string, { name?: string; role?: string; endpoint?: string; canonical?: string }>();
    for (const sc of scenarios) {
      for (const a of collectActors(sc.ir)) {
        if (!allActors.has(a.id)) allActors.set(a.id, { name: a.name, role: a.role, endpoint: a.endpoint, canonical: a.canonical });
      }
    }
    const suiteActorsXml = emitActors([...allActors.entries()].map(([id, v]) => ({ id, ...v })));

    const testsuiteXml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite id="${escapeAttr(suiteId)}"
           xmlns="http://www.gitb.com/tdl/v1/"
           xmlns:gitb="http://www.gitb.com/core/v1/">
  <metadata>
    <gitb:name>${escapeXml(featureTitle)}</gitb:name>
    <gitb:version>1.0</gitb:version>
    <gitb:description>${escapeXml(featureDescription)}</gitb:description>
  </metadata>

  <actors>
${indent(suiteActorsXml, 4)}
  </actors>

${testcaseRefs}

</testsuite>`;

    files.unshift({
      filename: `${suiteId}.xml`,
      xml: testsuiteXml,
      type: 'testsuite',
      id: suiteId,
      name: featureTitle
    });

    // Combined preview: test suite + all test cases separated by comments
    const combinedXml = files.map(f =>
      `<!-- ===== ${f.type}: ${f.filename} ===== -->\n${f.xml}`
    ).join('\n\n');

    return {
      testcaseName: featureTitle,
      xml: combinedXml,
      files
    };
  }
}

interface DeclaredActor {
  id: string;
  name?: string;
  role?: string;
  endpoint?: string;
  canonical?: string;
}

function collectActors(ir: IRAction[]): DeclaredActor[] {
  const actors: DeclaredActor[] = [];
  const seen = new Set<string>();
  for (const a of ir) {
    if (a.type === 'declareActor' && !seen.has(a.id)) {
      seen.add(a.id);
      actors.push({ id: a.id, name: a.name, role: a.role, endpoint: a.endpoint, canonical: a.canonical });
    }
  }
  // If no actors were declared, use defaults
  if (actors.length === 0) {
    actors.push({ id: 'client', role: 'SUT' });
    actors.push({ id: 'server' });
  }
  return actors;
}

function emitActors(actors: DeclaredActor[]): string {
  return actors.map(a => {
    const roleAttr = a.role ? ` role="${escapeAttr(a.role)}"` : '';
    const endpointAttr = a.endpoint ? ` endpoint="${escapeAttr(a.endpoint)}"` : '';
    const canonicalAttr = a.canonical ? ` canonical="${escapeAttr(a.canonical)}"` : '';
    const attrs = `${roleAttr}${endpointAttr}${canonicalAttr}`;
    if (a.name) {
      return `<gitb:actor id="${escapeAttr(a.id)}"${attrs}>\n  <gitb:name>${escapeXml(a.name)}</gitb:name>\n</gitb:actor>`;
    }
    return `<gitb:actor id="${escapeAttr(a.id)}"${attrs}/>`;
  }).join('\n');
}

function emitIR(ir: IRAction[]): string {
  const out: string[] = [];
  for (const a of ir) {
    if (a.type === 'declareActor') {
      // Actor declarations are handled separately in <actors> section
      continue;
    } else if (a.type === 'call') {
      const fromAttr = a.from ? ` from="${escapeAttr(a.from)}"` : '';
      const toAttr = a.to ? ` to="${escapeAttr(a.to)}"` : '';
      out.push(`<call path="${escapeAttr(a.path)}"${a.output ? ` output="${escapeAttr(a.output)}"` : ''}${fromAttr}${toAttr}>`);
      out.push(...emitInputs(a.inputs));
      out.push(`</call>`);
    } else if (a.type === 'verify') {
      out.push(`<verify handler="${escapeAttr(a.handler)}"${a.desc ? ` desc="${escapeAttr(a.desc)}"` : ''}>`);
      out.push(...emitInputs(a.inputs));
      out.push(`</verify>`);
    } else if (a.type === 'process') {
      const fromAttr = a.from ? ` from="${escapeAttr(a.from)}"` : '';
      const toAttr = a.to ? ` to="${escapeAttr(a.to)}"` : '';
      out.push(
        `<process handler="${escapeAttr(a.handler)}" operation="${escapeAttr(a.operation)}"${a.output ? ` output="${escapeAttr(a.output)}"` : ''}${fromAttr}${toAttr}${a.hidden ? ` hidden="true"` : ''}>`
      );
      out.push(...emitInputs(a.inputs));
      out.push(`</process>`);
    } else if (a.type === 'assign') {
      out.push(`<assign to="${escapeAttr(a.to)}">${escapeXml(a.value)}</assign>`);
    } else if (a.type === 'listAppend') {
      out.push(
        `<assign to="${escapeAttr(a.list)}" append="true">${escapeXml(JSON.stringify(a.item))}</assign>`
      );
    }
  }
  return out.join('\n');
}

function emitInputs(inputs?: Record<string, string>): string[] {
  if (!inputs) return [];
  return Object.entries(inputs).map(
    ([k, v]) => `  <input name="${escapeAttr(k)}">${escapeXml(v)}</input>`
  );
}

function toId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return base.length ? base : 'tc-1';
}

function escapeXml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string) {
  return escapeXml(s);
}

function indent(s: string, spaces = 2): string {
  const pad = ' '.repeat(spaces);
  return s
    .split('\n')
    .map((line) => (line.length ? pad + line : line))
    .join('\n');
}
