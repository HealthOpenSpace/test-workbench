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

    // Define dark theme
    monaco.editor.defineTheme('gherkin-theme-dark', {
      base: 'vs-dark',
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
      colors: {
        'editor.background': '#1f2937',
        'editor.foreground': '#d4d4d4',
        'editorLineNumber.foreground': '#6b7280',
        'editorLineNumber.activeForeground': '#9ca3af',
        'editor.lineHighlightBackground': '#374151',
        'editor.selectionBackground': '#4b5563',
        'editorGutter.background': '#111827',
        'editor.inactiveSelectionBackground': '#4b5563',
        'editorIndentGuide.background': '#374151',
        'editorIndentGuide.activeBackground': '#4b5563',
        'editorRuler.foreground': '#374151',
      },
    });

    // Define light theme
    monaco.editor.defineTheme('gherkin-theme-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword.feature', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'keyword.scenario', foreground: '0451a5', fontStyle: 'bold' },
        { token: 'keyword.step', foreground: 'af00db' },
        { token: 'tag', foreground: '008000' },
        { token: 'string', foreground: 'a31515' },
        { token: 'url', foreground: '0000ff', fontStyle: 'underline' },
        { token: 'type', foreground: '0451a5' },
        { token: 'comment', foreground: '008000' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.foreground': '#000000',
        'editorLineNumber.foreground': '#6b7280',
        'editorLineNumber.activeForeground': '#111827',
        'editorGutter.background': '#f9fafb',
      },
    });
  }, []);

  // Apply theme changes when isDark changes
  useEffect(() => {
    if (editorRef.current) {
      monaco.editor.setTheme(isDark ? 'gherkin-theme-dark' : 'gherkin-theme-light');
      
      // Force a layout refresh to ensure theme is applied
      setTimeout(() => {
        editorRef.current?.layout();
      }, 0);
    }
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
      theme: isDark ? 'gherkin-theme-dark' : 'gherkin-theme-light',
    });

    // Force initial theme application
    monaco.editor.setTheme(isDark ? 'gherkin-theme-dark' : 'gherkin-theme-light');
  };

  return (
    <div className="h-full border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      <MonacoEditor
        height="100%"
        language="gherkin"
        theme={isDark ? 'gherkin-theme-dark' : 'gherkin-theme-light'}
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