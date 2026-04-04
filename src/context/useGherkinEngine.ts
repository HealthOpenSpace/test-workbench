import { useState, useEffect, useMemo } from 'react';
import { useAppContext } from './AppContext';
import { XMLOutput } from '../parser/xmlGenerator';
import { ParsedScenario } from '../types';
import { RequiredActor } from '../components/ComponentsPanel';
import { validateTDL } from '../validation/gitbValidator';

export interface GherkinEngine {
  gherkinContent: string;
  setGherkinContent: (v: string) => void;
  parsedScenario: ParsedScenario | null;
  xmlOutput: XMLOutput | null;
  issues: any[];
  requiredActors: RequiredActor[];
  errorCount: number;
  warnCount: number;
  scenarioCount: number;
}

export function useGherkinEngine(): GherkinEngine {
  const { parser, generator } = useAppContext();
  const [gherkinContent, setGherkinContent] = useState<string>('');
  const [parsedScenario, setParsedScenario] = useState<ParsedScenario | null>(null);
  const [issues, setIssues] = useState<any[]>([]);

  // Parse + expand on content change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!gherkinContent.trim()) {
          setParsedScenario(null);
          setIssues([]);
          return;
        }
        const parsed = parser.parse(gherkinContent);
        await parser.expandScenarioToIR(parsed);
        if (!cancelled) {
          setParsedScenario(parsed);
          setIssues(parsed.errors ?? []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setParsedScenario(null);
          setIssues([{ severity: 'error', message: String(e?.message ?? e), line: 1 }]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [gherkinContent, parser]);

  // Generate XML
  const xmlOutput: XMLOutput | null = useMemo(() => {
    if (!parsedScenario) return null;
    return generator.generate(parsedScenario);
  }, [parsedScenario, generator]);

  // Schema validation
  useEffect(() => {
    (async () => {
      if (!xmlOutput || !parsedScenario) return;
      const allSchemaIssues = [];
      for (const file of xmlOutput.files) {
        const fileIssues = await validateTDL(file.xml);
        allSchemaIssues.push(...fileIssues.map(i => ({ ...i, message: `[${file.filename}] ${i.message}` })));
      }
      setIssues([...(parsedScenario.errors ?? []), ...allSchemaIssues]);
    })();
  }, [xmlOutput, parsedScenario]);

  // Required actors from IR
  const requiredActors: RequiredActor[] = useMemo(() => {
    if (!parsedScenario) return [];
    const scenarioIRs = (parsedScenario as any).__scenarioIRs as { name: string; ir: any[] }[] | undefined;
    if (!scenarioIRs) return [];
    const seen = new Set<string>();
    const actors: RequiredActor[] = [];
    for (const sc of scenarioIRs) {
      for (const action of sc.ir) {
        if (action.type === 'declareActor' && action.role !== 'SUT' && !seen.has(action.id)) {
          seen.add(action.id);
          actors.push({ id: action.id, endpoint: action.endpoint || undefined });
        }
      }
    }
    return actors;
  }, [parsedScenario]);

  const errorCount = issues.filter(e => e.severity === 'error').length;
  const warnCount = issues.filter(e => e.severity === 'warning').length;
  const scenarioCount = (parsedScenario as any)?.__scenarios?.length ?? 0;

  return {
    gherkinContent, setGherkinContent,
    parsedScenario, xmlOutput, issues, requiredActors,
    errorCount, warnCount, scenarioCount,
  };
}
