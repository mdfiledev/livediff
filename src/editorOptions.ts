export interface LiveDiffEditorOptions {
  value: string;
  language: 'plaintext';
  automaticLayout: false;
  fontSize: number;
  minimap: { enabled: false };
  scrollBeyondLastLine: false;
  wordWrap: 'on';
  lineNumbers: 'on';
  glyphMargin: true;
  overviewRulerLanes: 0;
  renderLineHighlight: 'none';
  theme: 'live-diff-theme';
  placeholder: string;
}

export function createEditorOptions(placeholder: string): LiveDiffEditorOptions {
  return {
    value: '',
    language: 'plaintext',
    automaticLayout: false,
    fontSize: 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    lineNumbers: 'on',
    glyphMargin: true,
    overviewRulerLanes: 0,
    renderLineHighlight: 'none',
    theme: 'live-diff-theme',
    placeholder
  };
}
