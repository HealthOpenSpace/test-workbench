import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Download,
  Upload,
  Sun,
  Moon,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  FileCode2,
  Code2,
  Database,
  Rocket,
  Settings,
  Loader2,
  ExternalLink,
  Play,
  Puzzle,
} from 'lucide-react';
import { Editor, EditorHandle } from './components/Editor';
import { OutputPanel } from './components/OutputPanel';
import { ModelSelector } from './components/ModelSelector';
import { ExamplesPanel } from './components/ExamplesPanel';
import { DataPoolsPanel } from './components/DataPoolsPanel';
import { ComponentsPanel, RequiredActor } from './components/ComponentsPanel';
import { SnippetPalette } from './components/SnippetPalette';
import { GherkinParser } from './parser/gherkinParser';
import { XMLGenerator, XMLOutput } from './parser/xmlGenerator';
import { dataModels, exampleMetas, loadExampleContent } from './data/models';
import { validateTDL } from './validation/gitbValidator.ts';
import { ITBSettingsDialog } from './components/ITBSettingsDialog';
import {
  ITBConfig, loadITBConfig, saveITBConfig, deployToITB, ITBDeployResult,
  getITBAppUrl, resolveITBIds, getSpecificationActors, ensureSystem, ensureConformance, startTest, ITBTestResult,
} from './services/itbClient';
import { DataModel, ExampleScenario, ParsedScenario } from './types';
import JSZip from 'jszip';

type RightPanel = 'output' | 'examples' | 'datapools' | 'components';

function App() {
  const [selectedModel, setSelectedModel] = useState<DataModel>(dataModels[0]);
  const [gherkinContent, setGherkinContent] = useState<string>('');
  const [parsedScenario, setParsedScenario] = useState<ParsedScenario | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [isDark, setIsDark] = useState(() => {
    const saved = window.localStorage?.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  });
  const [snippetsOpen, setSnippetsOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState<RightPanel>('output');
  const [itbConfig, setITBConfig] = useState<ITBConfig>(loadITBConfig);
  const [itbSettingsOpen, setITBSettingsOpen] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<ITBDeployResult | null>(null);
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<ITBTestResult[] | null>(null);
  const [resolvedIds, setResolvedIds] = useState<Record<string, number | undefined>>({});
  const editorRef = useRef<EditorHandle>(null);

  // ── Parser & Generator ───────────────────────────────────────────
  const parser = useMemo(
    () =>
      new GherkinParser(selectedModel, {
        services: {
          'FHIR-validator': '1.2.0',
          'HCERT-validator': '1.0.0',
          'Monitor': '2.0.1',
          'UploadProxy': '1.6.0',
          'ProxyTrafficProcessor': '1.0.0',
        },
        strictRequirements: false,
      }),
    [selectedModel]
  );
  const generator = useMemo(() => new XMLGenerator(parser), [parser]);

  // ── Parse + expand ───────────────────────────────────────────────
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

  // ── Generate XML ─────────────────────────────────────────────────
  const xmlOutput: XMLOutput | null = useMemo(() => {
    if (!parsedScenario) return null;
    return generator.generate(parsedScenario);
  }, [parsedScenario, generator]);

  // ── Schema validation ────────────────────────────────────────────
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

  // ── Theme ────────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      document.body.style.backgroundColor = '#0f172a';
      document.body.style.color = '#f9fafb';
    } else {
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#f8fafc';
      document.body.style.color = '#111827';
    }
    window.localStorage?.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // ── Load examples ────────────────────────────────────────────────
  const [loadedExamples, setLoadedExamples] = useState<ExampleScenario[]>([]);

  useEffect(() => {
    Promise.allSettled(
      exampleMetas.map(async (meta) => {
        const content = await loadExampleContent(meta);
        return { ...meta, content } as ExampleScenario;
      })
    ).then((results) => {
      setLoadedExamples(
        results
          .filter((r): r is PromiseFulfilledResult<ExampleScenario> => r.status === 'fulfilled')
          .map(r => r.value)
      );
    });
  }, []);

  useEffect(() => {
    if (!gherkinContent && loadedExamples.length > 0) {
      const def = loadedExamples.find(ex => ex.dataModel === selectedModel.id);
      if (def) setGherkinContent(def.content);
    }
  }, [selectedModel.id, gherkinContent, loadedExamples]);

  // ── Handlers ─────────────────────────────────────────────────────
  const handleModelChange = (model: DataModel) => {
    setSelectedModel(model);
    if (!gherkinContent.trim()) {
      const ex = loadedExamples.find(e => e.dataModel === model.id);
      if (ex) setGherkinContent(ex.content);
    }
  };

  const handleExampleSelect = (example: ExampleScenario) => {
    setGherkinContent(example.content);
    setRightPanel('output');
  };

  const handleDownloadXML = async () => {
    if (!xmlOutput) return;
    const zip = new JSZip();
    for (const file of xmlOutput.files) {
      zip.file(file.filename, file.xml);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${xmlOutput.testcaseName.replace(/[^a-zA-Z0-9]/g, '_')}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.feature')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setGherkinContent(e.target?.result as string);
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  const handleDownloadFeature = () => {
    if (!gherkinContent) return;
    const blob = new Blob([gherkinContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scenario.feature';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSnippetInsert = (text: string) => {
    editorRef.current?.insertText(text);
  };

  const handleInsertPoolStep = (poolId: string) => {
    const step = `    Given the test environment is configured with data pool "${poolId}"`;
    editorRef.current?.insertText(step);
  };

  const handleITBConfigSave = (config: ITBConfig) => {
    setITBConfig(config);
    saveITBConfig(config);
  };

  const handleDeploy = async () => {
    if (!xmlOutput) return;
    setDeploying(true);
    setDeployResult(null);
    const result = await deployToITB(xmlOutput.files, itbConfig);
    console.log('[ITB Deploy]', result);
    // ITB returns { completed: true/false, errors: [...], warnings: [...] }
    // Treat completed===false as failure even if HTTP was 200
    if (result.success && result.details && result.details.completed === false) {
      result.success = false;
      result.message = 'ITB rejected the test suite.';
    }
    // Resolve numeric IDs for "Open in ITB" link before showing dialog
    if (result.success && result.details) {
      try {
        // Find the SUT actor from the generated test suite XML
        const suiteFile = xmlOutput?.files.find(f => f.type === 'testsuite');
        const sutMatch = suiteFile?.xml.match(/actor id="([^"]+)"[^>]*role="SUT"/);
        // Fallback: check test case files
        const tcFile = xmlOutput?.files.find(f => f.type === 'testcase');
        const sutMatch2 = tcFile?.xml.match(/actor id="([^"]+)"[^>]*role="SUT"/);
        const sutActorId = sutMatch?.[1] || sutMatch2?.[1];
        console.log('[ITB] SUT actor:', sutActorId);
        const ids = await resolveITBIds(itbConfig, result.details, sutActorId);
        console.log('[ITB] Resolved IDs:', ids);
        setResolvedIds(ids);

        // Auto-create conformance so test cases appear in ITB UI
        try {
          const actors = await getSpecificationActors(itbConfig);
          const sutActorInfo = actors.find((a: any) => a.actorId === sutActorId) || actors.find((a: any) => a.default) || actors[0];
          if (sutActorInfo?.apiKey) {
            const systemApiKey = await ensureSystem(itbConfig);
            if (systemApiKey) {
              const ok = await ensureConformance(itbConfig, systemApiKey, sutActorInfo.apiKey);
              console.log('[ITB] Conformance:', ok ? 'created/verified' : 'failed');
            }
          }
        } catch (err) {
          console.warn('[ITB] Auto-conformance failed:', err);
        }
      } catch (err) {
        console.warn('[ITB] Failed to resolve IDs:', err);
      }
    }

    setDeployResult(result);
    setDeploying(false);
  };

  const handleRunTests = async () => {
    if (!xmlOutput) return;
    setRunningTests(true);
    setTestResults(null);
    try {
      // Get actors for the specification
      const actors = await getSpecificationActors(itbConfig);
      if (actors.length === 0) {
        setTestResults([{ message: 'No actors found for the specification. Deploy first.' }]);
        setRunningTests(false);
        return;
      }

      // Find the SUT actor (role=SUT) or first actor
      const sutActor = actors.find((a: any) => a.default) || actors[0];
      const actorApiKey = sutActor.apiKey;

      // Ensure system exists
      const systemApiKey = await ensureSystem(itbConfig);
      if (!systemApiKey) {
        setTestResults([{ message: 'Could not create/find a test system. Check ITB configuration.' }]);
        setRunningTests(false);
        return;
      }

      // Ensure conformance
      await ensureConformance(itbConfig, systemApiKey, actorApiKey);

      // Find test case IDs from the generated XML
      const testCaseIds = xmlOutput.files
        .filter(f => f.type === 'testcase')
        .map(f => f.filename.replace(/\.xml$/, ''));

      if (testCaseIds.length === 0) {
        setTestResults([{ message: 'No test cases found to execute.' }]);
        setRunningTests(false);
        return;
      }

      const results = await startTest(itbConfig, testCaseIds, systemApiKey, actorApiKey);
      setTestResults(results);

      // Save system API key for reuse
      if (systemApiKey !== itbConfig.systemApiKey) {
        const updated = { ...itbConfig, systemApiKey };
        setITBConfig(updated);
        saveITBConfig(updated);
      }
    } catch (err: any) {
      setTestResults([{ message: `Error: ${err?.message || err}` }]);
    }
    setRunningTests(false);
  };

  const errorCount = issues.filter(e => e.severity === 'error').length;
  const warnCount = issues.filter(e => e.severity === 'warning').length;
  const scenarioCount = (parsedScenario as any)?.__scenarios?.length ?? 0;

  // Extract required actors from the IR (declareActor actions, excluding SUT)
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

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className={`h-screen flex flex-col ${isDark ? 'dark' : ''}`}>
      {/* ── Top Bar ───────────────────────────────────────────────── */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-4 py-2 flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2 mr-2">
            <FileCode2 size={20} className="text-blue-600 dark:text-blue-400" />
            <span className="font-bold text-sm text-gray-900 dark:text-gray-100">Gherkin FHIR Compiler</span>
          </div>

          {/* Model selector */}
          <div className="w-56">
            <ModelSelector
              models={dataModels}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Status pill */}
          {parsedScenario && (
            <div className="flex items-center gap-3 text-xs">
              <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {scenarioCount} scenario{scenarioCount !== 1 ? 's' : ''}
              </span>
              {errorCount > 0 ? (
                <span className="px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 flex items-center gap-1">
                  <AlertCircle size={12} /> {errorCount} error{errorCount !== 1 ? 's' : ''}
                </span>
              ) : (
                <span className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center gap-1">
                  <CheckCircle size={12} /> Valid
                </span>
              )}
              {warnCount > 0 && (
                <span className="px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300">
                  {warnCount} warn
                </span>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <input type="file" accept=".feature" onChange={handleFileUpload} className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
              <Upload size={14} /> Import
            </label>
            <button onClick={handleDownloadFeature} disabled={!gherkinContent.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors">
              <Download size={14} /> .feature
            </button>
            <button onClick={handleDownloadXML} disabled={!xmlOutput || errorCount > 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors">
              <Download size={14} /> ZIP
            </button>

            {/* Deploy to ITB */}
            <div className="border-l border-gray-200 dark:border-slate-600 mx-1 h-5" />
            <button
              onClick={handleDeploy}
              disabled={!xmlOutput || errorCount > 0 || deploying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
              title={`Deploy to ITB at ${itbConfig.baseUrl}`}
            >
              {deploying ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
              {deploying ? 'Deploying...' : 'Deploy'}
            </button>
            <button
              onClick={() => setITBSettingsOpen(true)}
              className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              title="ITB Settings"
            >
              <Settings size={16} />
            </button>

            <button onClick={() => setIsDark(!isDark)} className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-md hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors" title={isDark ? 'Light mode' : 'Dark mode'}>
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0">

        {/* ── Left: Snippet Palette ────────────────────────────────── */}
        <div className={`flex-shrink-0 border-r border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-200 ${snippetsOpen ? 'w-64' : 'w-0 overflow-hidden'}`}>
          {snippetsOpen && (
            <SnippetPalette onInsert={handleSnippetInsert} isDark={isDark} />
          )}
        </div>

        {/* ── Center: Editor ───────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Editor toolbar */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700">
            <button onClick={() => setSnippetsOpen(!snippetsOpen)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 transition-colors" title={snippetsOpen ? 'Hide snippets' : 'Show snippets'}>
              {snippetsOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
            </button>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Editor</span>
            <div className="flex-1" />
            {/* Issues inline */}
            {issues.length > 0 && (
              <div className="flex items-center gap-2 text-xs">
                {issues.filter(e => e.severity === 'error').slice(0, 2).map((err, i) => (
                  <span key={i} className="text-red-600 dark:text-red-400 truncate max-w-xs">
                    L{err.line}: {err.message}
                  </span>
                ))}
              </div>
            )}
            {!rightOpen && (
              <button onClick={() => setRightOpen(true)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 transition-colors" title="Show output panel">
                <PanelRightOpen size={16} />
              </button>
            )}
          </div>

          {/* Editor body */}
          <div className="flex-1 min-h-0 p-2">
            <Editor
              ref={editorRef}
              value={gherkinContent}
              onChange={setGherkinContent}
              errors={issues}
              isDark={isDark}
            />
          </div>
        </div>

        {/* ── Right: Output / Examples ─────────────────────────────── */}
        <div className={`flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all duration-200 ${rightOpen ? 'w-[45%] max-w-[700px] min-w-[320px]' : 'w-0 overflow-hidden'}`}>
          {/* Right panel tabs */}
          <div className="flex items-center border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800">
            <button
              onClick={() => setRightPanel('output')}
              className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                rightPanel === 'output'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Code2 size={14} /> Output
              {xmlOutput && (
                <span className="ml-1 px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[10px]">
                  {xmlOutput.files.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setRightPanel('examples')}
              className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                rightPanel === 'examples'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Lightbulb size={14} /> Examples
            </button>
            <button
              onClick={() => setRightPanel('datapools')}
              className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                rightPanel === 'datapools'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Database size={14} /> Data Pools
            </button>
            <button
              onClick={() => setRightPanel('components')}
              className={`px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                rightPanel === 'components'
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <Puzzle size={14} /> Components
            </button>
            <div className="flex-1" />
            <button
              onClick={() => setRightOpen(false)}
              className="p-1.5 mr-1 rounded hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400 transition-colors"
              title="Hide panel — focus on Gherkin"
            >
              <PanelRightClose size={16} />
            </button>
          </div>

          {/* Right panel content */}
          <div className="flex-1 min-h-0">
            {rightPanel === 'output' ? (
              <OutputPanel
                xmlOutput={xmlOutput}
                errors={issues}
                isDark={isDark}
                onDownload={handleDownloadXML}
              />
            ) : rightPanel === 'datapools' ? (
              <DataPoolsPanel
                onInsertPoolStep={handleInsertPoolStep}
                isDark={isDark}
              />
            ) : rightPanel === 'components' ? (
              <ComponentsPanel isDark={isDark} requiredActors={requiredActors} />
            ) : (
              <ExamplesPanel
                examples={loadedExamples}
                selectedModel={selectedModel}
                onExampleSelect={handleExampleSelect}
              />
            )}
          </div>
        </div>
      </div>

      {/* ITB Settings Dialog */}
      {itbSettingsOpen && (
        <ITBSettingsDialog
          config={itbConfig}
          onSave={handleITBConfigSave}
          onClose={() => setITBSettingsOpen(false)}
        />
      )}

      {/* Deploy Report Panel */}
      {deployResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeployResult(null)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center gap-2 px-5 py-3 rounded-t-xl ${
              deployResult.success
                ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-200'
            }`}>
              {deployResult.success ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
              <h3 className="font-semibold text-base flex-1">
                {deployResult.success ? 'Deploy Successful' : 'Deploy Failed'}
              </h3>
              <button onClick={() => setDeployResult(null)} className="text-current opacity-50 hover:opacity-100 text-lg">&times;</button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 overflow-auto flex-1 space-y-3">
              {/* Status */}
              <p className="text-sm text-gray-700 dark:text-gray-300">{deployResult.message}</p>
              {deployResult.url && (
                <p className="text-xs text-gray-400 font-mono">POST {deployResult.url}</p>
              )}

              {/* Errors */}
              {deployResult.details?.errors?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1 uppercase tracking-wider">
                    Errors ({deployResult.details.errors.length})
                  </h4>
                  <div className="space-y-1">
                    {deployResult.details.errors.map((err: any, i: number) => (
                      <div key={i} className="px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-800 dark:text-red-300">
                        <span className="font-medium">{err.description}</span>
                        {err.location && <span className="ml-2 opacity-60">in {err.location}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {deployResult.details?.warnings?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1 uppercase tracking-wider">
                    Warnings ({deployResult.details.warnings.length})
                  </h4>
                  <div className="space-y-1">
                    {deployResult.details.warnings.map((warn: any, i: number) => (
                      <div key={i} className="px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-xs text-yellow-800 dark:text-yellow-300">
                        {warn.description}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw response (fallback if no structured errors/warnings) */}
              {deployResult.details && !deployResult.details.errors && !deployResult.details.warnings && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">Response</h4>
                  <pre className="text-xs bg-gray-50 dark:bg-slate-900 rounded p-3 overflow-auto max-h-48 text-gray-700 dark:text-gray-300 font-mono whitespace-pre-wrap break-all">
                    {typeof deployResult.details === 'string' ? deployResult.details : JSON.stringify(deployResult.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Test Results */}
            {testResults && (
              <div className="px-5 py-3 border-t border-gray-200 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                  Test Results
                </h4>
                <div className="space-y-1">
                  {testResults.map((tr, i) => (
                    <div key={i} className={`px-3 py-2 rounded text-xs ${
                      tr.result === 'SUCCESS'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                        : tr.result === 'FAILURE'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
                        : 'bg-gray-50 dark:bg-slate-900 text-gray-700 dark:text-gray-300'
                    }`}>
                      {tr.result && <span className="font-semibold mr-1">{tr.result}</span>}
                      {tr.message}
                      {tr.sessionId && <span className="ml-2 opacity-50">({tr.sessionId.substring(0, 8)}...)</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="px-5 py-3 border-t border-gray-200 dark:border-slate-700 flex items-center gap-2">
              {deployResult.success && (
                <>
                  <a
                    href={getITBAppUrl(itbConfig, resolvedIds)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    title={getITBAppUrl(itbConfig, resolvedIds)}
                  >
                    <ExternalLink size={14} /> Open in ITB
                  </a>
                  <button
                    onClick={handleRunTests}
                    disabled={runningTests}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                  >
                    {runningTests ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                    {runningTests ? 'Running...' : 'Run Tests'}
                  </button>
                </>
              )}
              <div className="flex-1" />
              <button
                onClick={() => { setDeployResult(null); setTestResults(null); setResolvedIds({}); }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
