// xmlGenerator.ts
import type { ParsedScenario } from '../types';
import type { IRAction } from './gherkinParser';

export class XMLGenerator {
  constructor(private parser: any) {}

  generate(parsed: ParsedScenario) {
    const ir: IRAction[] = ((parsed as any).__ir ?? []) as IRAction[];
    const stepsXml = emitIR(ir);

    const featureTitle = (parsed.scenario as any).feature ?? 'Feature';
    const testcaseName = parsed.scenario.name || 'Test Case';
    const testcaseId = toId(testcaseName);

    // Optional documentation URL if you ever attach it on the parsed object
    const documentationUrl: string | undefined = (parsed as any).documentationUrl;
    const docLine = documentationUrl
      ? `\n    <gitb:documentation import="${escapeAttr(documentationUrl)}"/>`
      : '';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testcase id="${escapeAttr(testcaseId)}"
          xmlns="http://www.gitb.com/tdl/v1/"
          xmlns:gitb="http://www.gitb.com/core/v1/">
  <metadata>
    <gitb:name>${escapeXml(testcaseName)}</gitb:name>
    <gitb:version>1.0</gitb:version>
    <gitb:description>${escapeXml(featureTitle)}</gitb:description>${docLine}
  </metadata>

  <actors>
    <gitb:actor id="client" role="SUT"/>
    <gitb:actor id="server"/>
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

    return { testcaseName, xml };
  }
}

function emitIR(ir: IRAction[]): string {
  const out: string[] = [];
  for (const a of ir) {
    if (a.type === 'call') {
      out.push(`<call path="${escapeAttr(a.path)}"${a.output ? ` output="${escapeAttr(a.output)}"` : ''}>`);
      out.push(...emitInputs(a.inputs));
      out.push(`</call>`);
    } else if (a.type === 'verify') {
      out.push(`<verify handler="${escapeAttr(a.handler)}"${a.desc ? ` desc="${escapeAttr(a.desc)}"` : ''}>`);
      out.push(...emitInputs(a.inputs));
      out.push(`</verify>`);
    } else if (a.type === 'process') {
      out.push(
        `<process handler="${escapeAttr(a.handler)}" operation="${escapeAttr(a.operation)}"${a.output ? ` output="${escapeAttr(a.output)}"` : ''}${a.hidden ? ` hidden="true"` : ''}>`
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
