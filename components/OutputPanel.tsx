import React from 'react';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import { Download, Copy, CheckCircle, AlertCircle } from 'lucide-react';
import { XMLOutput, ParseError } from '../types';

interface OutputPanelProps {
  xmlOutput: XMLOutput | null;
  errors: ParseError[];
  isDark: boolean;
  onDownload: () => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({ 
  xmlOutput, 
  errors, 
  isDark, 
  onDownload 
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (xmlOutput?.xml) {
      await navigator.clipboard.writeText(xmlOutput.xml);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const hasErrors = errors.some(e => e.severity === 'error');
  const hasWarnings = errors.some(e => e.severity === 'warning');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Compiled XML Output
          </h3>
          {xmlOutput && (
            <div className="flex items-center gap-2">
              {hasErrors && (
                <div className="flex items-center gap-1 text-red-500">
                  <AlertCircle size={16} />
                  <span className="text-sm">{errors.filter(e => e.severity === 'error').length} errors</span>
                </div>
              )}
              {hasWarnings && (
                <div className="flex items-center gap-1 text-yellow-500">
                  <AlertCircle size={16} />
                  <span className="text-sm">{errors.filter(e => e.severity === 'warning').length} warnings</span>
                </div>
              )}
              {!hasErrors && !hasWarnings && (
                <div className="flex items-center gap-1 text-green-500">
                  <CheckCircle size={16} />
                  <span className="text-sm">Valid</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {xmlOutput && (
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="btn-secondary flex items-center gap-2"
              disabled={!xmlOutput.xml}
            >
              <Copy size={16} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={onDownload}
              className="btn-primary flex items-center gap-2"
              disabled={!xmlOutput.xml}
            >
              <Download size={16} />
              Download
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4">
        {!xmlOutput ? (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-4">📝</div>
              <p>Write your Gherkin scenario to see the compiled XML output</p>
            </div>
          </div>
        ) : (
          <div className="h-full">
            {/* Metadata */}
            <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Test Case Details</h4>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <div><span className="font-medium">Name:</span> {xmlOutput.testcaseName}</div>
                <div><span className="font-medium">Scriptlets:</span> {xmlOutput.scriptlets.length}</div>
                <div><span className="font-medium">Size:</span> {(xmlOutput.xml.length / 1024).toFixed(1)} KB</div>
              </div>
            </div>

            {/* XML Editor */}
            <div className="h-96 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              <MonacoEditor
                height="100%"
                language="xml"
                theme={isDark ? 'vs-dark' : 'vs'}
                value={xmlOutput.xml}
                options={{
                  readOnly: true,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  minimap: { enabled: false },
                  lineNumbers: 'on',
                  folding: true,
                  wordWrap: 'on',
                }}
              />
            </div>

            {/* Scriptlets Summary */}
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Generated Scriptlets</h4>
              <div className="space-y-2">
                {xmlOutput.scriptlets.map((scriptlet, index) => (
                  <div 
                    key={scriptlet.id}
                    className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {scriptlet.id}
                        </span>
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                          {scriptlet.type}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {scriptlet.name}
                    </p>
                    {Object.keys(scriptlet.parameters).length > 0 && (
                      <div className="mt-2 text-xs text-gray-500 dark:text-gray-500">
                        Parameters: {Object.keys(scriptlet.parameters).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};