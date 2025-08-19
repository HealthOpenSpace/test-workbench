import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Settings,
  Download,
  Upload,
  Sun,
  Moon,
  HelpCircle,
  Play,
  Lightbulb,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { Editor } from './components/Editor';
import { OutputPanel } from './components/OutputPanel';
import { ModelSelector } from './components/ModelSelector';
import { ExamplesPanel } from './components/ExamplesPanel';
import { GherkinParser } from './parser/gherkinParser';
import { XMLGenerator } from './parser/xmlGenerator';
import { dataModels, exampleScenarios } from './data/models';
import { validateTDL } from './validation/gitbValidator.ts';
import { DataModel, ExampleScenario, ParsedScenario, XMLOutput } from './types';

type TabType = 'editor' | 'output' | 'examples' | 'help';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('editor');
  const [selectedModel, setSelectedModel] = useState<DataModel>(dataModels[0]);
  const [gherkinContent, setGherkinContent] = useState<string>('');
  const [parsedScenario, setParsedScenario] = useState<ParsedScenario | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [isDark, setIsDark] = useState(() => {
    const saved = window.localStorage?.getItem('theme');
    return saved ? saved === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches || false;
  });

  /** Parser & Generator instances (memoized) */
  const parser = useMemo(() => new GherkinParser(selectedModel), [selectedModel]);
  const generator = useMemo(() => new XMLGenerator(parser), [parser]);

  /** Parse + expand to IR whenever content (or model) changes */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!gherkinContent.trim()) {
          setParsedScenario(null);
          setIssues([]);
          return;
        }
        const parsed = parser.parse(gherkinContent);           // your existing parse -> AST + basic checks
        await parser.expandScenarioToIR(parsed);               // loads lang/en.yml and maps steps -> IR
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

  /** Generate XML from IR */
  const xmlOutput: XMLOutput | null = useMemo(() => {
    if (!parsedScenario) return null;
    return generator.generate(parsedScenario);
  }, [parsedScenario, generator]);

  /** Optional: validate the generated XML (schema) and merge issues */
  useEffect(() => {
    (async () => {
      if (!xmlOutput || !parsedScenario) return;
      const schemaIssues = await validateTDL(xmlOutput.xml); // returns ParseIssue[]
      setIssues([...(parsedScenario.errors ?? []), ...schemaIssues]);
    })();
  }, [xmlOutput, parsedScenario]);

  /** Theme */
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      document.body.style.backgroundColor = '#1f2937';
      document.body.style.color = '#f9fafb';
    } else {
      root.classList.remove('dark');
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#111827';
    }
    window.localStorage?.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  /** Load default example for the selected model */
  useEffect(() => {
    if (!gherkinContent && exampleScenarios.length > 0) {
      const def = exampleScenarios.find(ex => ex.dataModel === selectedModel.id);
      if (def) setGherkinContent(def.content);
    }
  }, [selectedModel.id, gherkinContent]);

  const handleModelChange = (model: DataModel) => {
    setSelectedModel(model);
    if (!gherkinContent.trim()) {
      const ex = exampleScenarios.find(e => e.dataModel === model.id);
      if (ex) setGherkinContent(ex.content);
    }
  };

  const handleExampleSelect = (example: ExampleScenario) => {
    setGherkinContent(example.content);
    setActiveTab('editor');
  };

  const handleDownloadXML = () => {
    if (xmlOutput) {
      const blob = new Blob([xmlOutput.xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${xmlOutput.testcaseName.replace(/[^a-zA-Z0-9]/g, '_')}.xml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.feature')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setGherkinContent(content);
        setActiveTab('editor');
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  const handleDownloadFeature = () => {
    if (gherkinContent) {
      const blob = new Blob([gherkinContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scenario.feature';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleCompile = () => {
    if (parsedScenario && !issues.some(e => e.severity === 'error')) {
      setActiveTab('output');
    }
  };

  const tabs = [
    { id: 'editor' as TabType, label: 'Editor', icon: FileText },
    { id: 'output' as TabType, label: 'Output', icon: Play },
    { id: 'examples' as TabType, label: 'Examples', icon: Lightbulb },
    { id: 'help' as TabType, label: 'Help', icon: HelpCircle },
  ];

  return (
    <div className={`min-h-screen ${isDark ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Gherkin FHIR Compiler
              </h1>
              <div className="w-80">
                <ModelSelector
                  models={dataModels}
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* File Operations */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".feature"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="btn-secondary flex items-center gap-2 cursor-pointer"
                >
                  <Upload size={16} />
                  Import
                </label>

                <button
                  onClick={handleDownloadFeature}
                  className="btn-secondary flex items-center gap-2"
                  disabled={!gherkinContent.trim()}
                >
                  <Download size={16} />
                  Export .feature
                </button>
              </div>

              {/* Compile Button */}
              <button
                onClick={handleCompile}
                className="btn-primary flex items-center gap-2"
                disabled={!parsedScenario || issues.some(e => e.severity === 'error')}
              >
                <Play size={16} />
                Compile
              </button>

              {/* Theme Toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDark ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex min-h-0">
          {/* Tabs */}
          <div className="bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="flex flex-col">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 flex items-center gap-3 transition-colors text-sm font-medium whitespace-nowrap ${activeTab === tab.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-r-2 border-blue-500'
                        : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                  >
                    <Icon size={18} />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex min-h-0">
            {activeTab === 'editor' && (
              <div className="flex-1 flex min-h-0">
                {/* Editor */}
                <div className="flex-1 flex flex-col p-6 min-h-0">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Gherkin Scenario Editor
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      {parsedScenario && (
                        <>
                          <span>{parsedScenario.scenario.steps.length} steps</span>
                          {issues.length > 0 && (
                            <span className="text-red-500">• {issues.length} issues</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-h-0">
                    <Editor
                      value={gherkinContent}
                      onChange={setGherkinContent}
                      errors={issues}
                      isDark={isDark}
                    />
                  </div>
                </div>

                {/* Quick Preview / Issues */}
                <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col">
                  {issues.length > 0 ? (
                    <>
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/10">
                        <h3 className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2">
                          <AlertCircle size={18} />
                          Compilation Issues ({issues.length})
                        </h3>
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {issues.map((error, index) => (
                          <div
                            key={index}
                            className="p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                            onClick={() => {
                              const lines = gherkinContent.split('\n');
                              let position = 0;
                              const line = Math.max(1, error.line || 1);
                              for (let i = 0; i < line - 1; i++) position += lines[i]?.length + 1 || 1;
                              const textarea = document.querySelector('.monaco-editor textarea') as HTMLTextAreaElement;
                              if (textarea) {
                                textarea.focus();
                                textarea.setSelectionRange(position, position);
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`mt-0.5 ${error.severity === 'error' ? 'text-red-500' : 'text-yellow-500'}`}>
                                <AlertCircle size={16} />
                              </div>
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {error.line ? `Line ${error.line}: ` : ''}{error.message}
                                </div>
                                <div className="text-xs text-gray-5 00 dark:text-gray-400 mt-1">
                                  {error.severity === 'error' ? 'Error' : 'Warning'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                          <CheckCircle size={18} className="text-green-500" />
                          Quick Preview
                        </h3>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {parsedScenario?.scenario.steps.map((step, index) => {
                          const mapping = parser.getStepMapping(step.text);
                          return (
                            <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                  {step.type}
                                </span>
                                {mapping && (
                                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded">
                                    {mapping}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {step.text}
                              </p>
                            </div>
                          );
                        }) || (
                          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <FileText size={32} className="mx-auto mb-2 opacity-50" />
                            <p>Start writing your scenario</p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'output' && (
              <div className="flex-1 min-h-0">
                <OutputPanel
                  xmlOutput={xmlOutput}
                  errors={issues}
                  isDark={isDark}
                  onDownload={handleDownloadXML}
                />
              </div>
            )}

            {activeTab === 'examples' && (
              <div className="flex-1 min-h-0">
                <ExamplesPanel
                  examples={exampleScenarios}
                  selectedModel={selectedModel}
                  onExampleSelect={handleExampleSelect}
                />
              </div>
            )}

            {activeTab === 'help' && (
              <div className="flex-1 overflow-y-auto">
                <HelpPanel selectedModel={selectedModel} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Help Panel Component
const HelpPanel: React.FC<{ selectedModel: DataModel }> = ({ selectedModel }) => {
  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Gherkin FHIR Compiler Help
        </h2>

        <div className="space-y-8">
          {/* Overview */}
          <section>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Overview
            </h3>
            <div className="prose dark:prose-invert">
              <p className="text-gray-700 dark:text-gray-300">
                This tool allows you to write Gherkin scenarios with FHIR-style extensions and
                compile them into ITB XML test cases. The compiler supports multiple data models
                and provides real-time validation and syntax highlighting.
              </p>
            </div>
          </section>

          {/* Syntax Guide */}
          <section>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Gherkin Syntax
            </h3>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm">
              <div className="space-y-2">
                <div><span className="text-blue-600 dark:text-blue-400">Feature:</span> <span className="text-gray-700 dark:text-gray-300">Feature description</span></div>
                <div><span className="text-green-600 dark:text-green-400">Scenario:</span> <span className="text-gray-700 dark:text-gray-300">Scenario name</span></div>
                <div className="ml-4"><span className="text-purple-600 dark:text-purple-400">Given</span> <span className="text-gray-700 dark:text-gray-300">the user submits a Patient resource</span></div>
                <div className="ml-4"><span className="text-purple-600 dark:text-purple-400">When</span> <span className="text-gray-700 dark:text-gray-300">the resource is processed</span></div>
                <div className="ml-4"><span className="text-purple-600 dark:text-purple-400">Then</span> <span className="text-gray-700 dark:text-gray-300">validate against http://hl7.org/fhir/StructureDefinition/Patient</span></div>
              </div>
            </div>
          </section>

          {/* Current Model Extensions */}
          <section>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {selectedModel.name} Extensions
            </h3>
            <div className="grid gap-4">
              {Object.values(selectedModel.extensions).map((extension) => (
                <div key={extension.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                    {extension.id} - {extension.name}
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400 mb-3">
                    {extension.description}
                  </p>
                  <div className="space-y-2">
                    <h5 className="font-medium text-gray-800 dark:text-gray-200">Supported Patterns:</h5>
                    {Object.entries(extension.stepMappings).map(([pattern, mapping]) => (
                      <div key={pattern} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded text-sm">
                        <code className="text-blue-600 dark:text-blue-400">{pattern}</code>
                        <span className="text-green-600 dark:text-green-400">→ {mapping}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Best Practices */}
          <section>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Best Practices
            </h3>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Use Clear Resource Types</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Always specify the FHIR resource type (Patient, Observation, etc.) in your steps for better validation.
                </p>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Include StructureDefinition URLs</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Use full StructureDefinition URLs for validation steps to ensure proper profile validation.
                </p>
              </div>
              <div className="border-l-4 border-yellow-500 pl-4">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">Test Incrementally</h4>
                <p className="text-gray-700 dark:text-gray-300">
                  Start with simple scenarios and gradually add complexity. Use the real-time validation to catch issues early.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default App;
