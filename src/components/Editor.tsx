import React, { useEffect, useRef } from 'react';
import { Editor as MonacoEditor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ParseError } from '../types';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: ParseError[];
  isDark: boolean;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange, errors, isDark }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    // Register Gherkin language
    monaco.languages.register({ id: 'gherkin' });

    // Define Gherkin syntax highlighting
    monaco.languages.setMonarchTokensProvider('gherkin', {
      tokenizer: {
        root: [
          [/^Feature:.*/, 'keyword.feature'],
          [/^Scenario:.*/, 'keyword.scenario'],
          [/^(Given|When|Then|And|But)/, 'keyword.step'],
          [/^@.*/, 'tag'],
          [/".*?"/, 'string'],
          [/http[s]?:\/\/[^\s]+/, 'url'],
          [/\b(Patient|Observation|Practitioner|Organization|Encounter)\b/, 'type'],
          [/#.*/, 'comment'],
        ],
      },
    });

    // Define theme
    monaco.editor.defineTheme('gherkin-theme', {
      base: isDark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: 'keyword.feature', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'keyword.scenario', foreground: '4ec9b0', fontStyle: 'bold' },
        { token: 'keyword.step', foreground: 'c586c0' },
        { token: 'tag', foreground: '608b4e' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'url', foreground: '4fc1ff', fontStyle: 'underline' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'comment', foreground: '6a9955' },
      ],
      colors: {},
    });
  }, [isDark]);

  useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        // Clear previous markers
        monaco.editor.setModelMarkers(model, 'gherkin-parser', []);

        // Add error markers
        const markers = errors.map(error => ({
          startLineNumber: error.line,
          startColumn: error.column,
          endLineNumber: error.line,
          endColumn: error.column + 10,
          message: error.message,
          severity: error.severity === 'error' ? 
            monaco.MarkerSeverity.Error : 
            monaco.MarkerSeverity.Warning,
        }));

        monaco.editor.setModelMarkers(model, 'gherkin-parser', markers);
      }
    }
  }, [errors]);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;
    
    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      lineHeight: 21,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      folding: true,
      lineNumbers: 'on',
      glyphMargin: true,
    });
  };

  return (
    <div className="h-full border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      <MonacoEditor
        height="100%"
        language="gherkin"
        theme="gherkin-theme"
        value={value}
        onChange={(value) => onChange(value || '')}
        onMount={handleEditorDidMount}
        options={{
          automaticLayout: true,
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          lineNumbers: 'on',
          glyphMargin: true,
          folding: true,
          wordWrap: 'on',
        }}
      />
    </div>
  );
};