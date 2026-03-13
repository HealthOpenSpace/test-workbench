import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Editor as MonacoEditor, type Monaco } from '@monaco-editor/react';
import type * as monacoNs from 'monaco-editor';
import { ParseError } from '../types';

export interface EditorHandle {
  insertText: (text: string) => void;
}

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  errors: ParseError[];
  isDark: boolean;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(({ value, onChange, errors, isDark }, ref) => {
  const editorRef = useRef<monacoNs.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  useImperativeHandle(ref, () => ({
    insertText(text: string) {
      const ed = editorRef.current;
      const m = monacoRef.current;
      if (!ed || !m) return;
      const pos = ed.getPosition();
      if (!pos) return;
      const range = new m.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column);
      ed.executeEdits('snippet', [{ range, text: text + '\n' }]);
      ed.focus();
    },
  }));

  // Apply theme changes when isDark changes
  useEffect(() => {
    const m = monacoRef.current;
    if (m && editorRef.current) {
      m.editor.setTheme(isDark ? 'gherkin-theme-dark' : 'gherkin-theme-light');
    }
  }, [isDark]);

  useEffect(() => {
    const m = monacoRef.current;
    if (m && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        m.editor.setModelMarkers(model, 'gherkin-parser', []);

        const markers = errors.map(error => ({
          startLineNumber: error.line,
          startColumn: error.column,
          endLineNumber: error.line,
          endColumn: error.column + 10,
          message: error.message,
          severity: error.severity === 'error'
            ? m.MarkerSeverity.Error
            : m.MarkerSeverity.Warning,
        }));

        m.editor.setModelMarkers(model, 'gherkin-parser', markers);
      }
    }
  }, [errors]);

  const handleBeforeMount = (monaco: Monaco) => {
    monacoRef.current = monaco;

    // Register Gherkin language
    monaco.languages.register({ id: 'gherkin' });

    // Monarch tokenizer for Gherkin syntax highlighting
    monaco.languages.setMonarchTokensProvider('gherkin', {
      tokenizer: {
        root: [
          // Comments (must be early to take priority)
          [/^\s*#.*$/, 'comment'],

          // Structural keywords
          [/^\s*Feature:.*$/, 'keyword.feature'],
          [/^\s*Background:/, 'keyword.background'],
          [/^\s*Scenario Outline:.*$/, 'keyword.scenario'],
          [/^\s*Scenario:.*$/, 'keyword.scenario'],

          // Tags
          [/^\s*@\S+/, 'tag'],

          // Doc strings (triple quotes)
          [/^\s*"""/, { token: 'string.docstring', next: '@docstring' }],

          // Table rows
          [/^\s*\|/, { token: 'delimiter.table', next: '@table' }],

          // Step keywords — match keyword then switch to step content state
          [/^\s*(Given|When|Then|And|But)\b/, { token: 'keyword.step', next: '@stepContent' }],

          // Strings in double quotes
          [/"[^"]*"/, 'string'],

          // Numbers
          [/\b[0-9]+\b/, 'number'],
        ],

        // Inside a step line — highlight actors, strings, URLs, types
        stepContent: [
          // End of line → back to root
          [/$/, '', '@pop'],

          // Strings in double quotes
          [/"[^"]*"/, 'string'],

          // URLs (before general word matching)
          [/https?:\/\/[^\s"]+/, 'url'],

          // FHIR resource types
          [/\b(Patient|Observation|Practitioner|Organization|Encounter|AllergyIntolerance|Bundle|OperationOutcome|Condition|Medication|Immunization|Questionnaire)\b/, 'type'],

          // Actor names: capitalized identifier followed by a verb
          [/[A-Z][A-Za-z0-9_]*(?=\s+(?:is|creates|submits|registers|validates))/, 'variable.actor'],

          // Numbers
          [/\b[0-9]+\b/, 'number'],

          // Everything else in the step line
          [/./, ''],
        ],

        // Doc string block
        docstring: [
          [/^\s*"""/, { token: 'string.docstring', next: '@pop' }],
          [/.*/, 'string.docstring'],
        ],

        // Table row
        table: [
          [/[^|\r\n]+/, 'string.table'],
          [/\|/, 'delimiter.table'],
          [/$/, '', '@pop'],
        ],
      },
    });

    // Dark theme
    monaco.editor.defineTheme('gherkin-theme-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword.feature', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'keyword.background', foreground: '569cd6', fontStyle: 'bold' },
        { token: 'keyword.scenario', foreground: '4ec9b0', fontStyle: 'bold' },
        { token: 'keyword.step', foreground: 'c586c0' },
        { token: 'tag', foreground: '608b4e' },
        { token: 'string', foreground: 'ce9178' },
        { token: 'string.docstring', foreground: 'ce9178', fontStyle: 'italic' },
        { token: 'string.table', foreground: 'dcdcaa' },
        { token: 'delimiter.table', foreground: '808080' },
        { token: 'url', foreground: '4fc1ff', fontStyle: 'underline' },
        { token: 'type', foreground: '4ec9b0' },
        { token: 'number', foreground: 'b5cea8' },
        { token: 'variable.actor', foreground: '9cdcfe', fontStyle: 'bold' },
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

    // Light theme
    monaco.editor.defineTheme('gherkin-theme-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword.feature', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'keyword.background', foreground: '0000ff', fontStyle: 'bold' },
        { token: 'keyword.scenario', foreground: '0451a5', fontStyle: 'bold' },
        { token: 'keyword.step', foreground: 'af00db' },
        { token: 'tag', foreground: '008000' },
        { token: 'string', foreground: 'a31515' },
        { token: 'string.docstring', foreground: 'a31515', fontStyle: 'italic' },
        { token: 'string.table', foreground: '795e26' },
        { token: 'delimiter.table', foreground: '808080' },
        { token: 'url', foreground: '0000ff', fontStyle: 'underline' },
        { token: 'type', foreground: '0451a5' },
        { token: 'number', foreground: '098658' },
        { token: 'variable.actor', foreground: '001080', fontStyle: 'bold' },
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
  };

  const handleEditorDidMount = (editor: monacoNs.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

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
        theme={isDark ? 'gherkin-theme-dark' : 'gherkin-theme-light'}
        value={value}
        onChange={(value) => onChange(value || '')}
        beforeMount={handleBeforeMount}
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
});
