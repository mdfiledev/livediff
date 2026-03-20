import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import './webview.css';

declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
};

type PaneSide = 'left' | 'right';

interface DecorationRange {
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  kind: 'insert' | 'delete' | 'modify';
}

interface WebviewPayload {
  editorWorkerUri: string;
}

interface DecorationsMessage {
  left: { lines: DecorationRange[]; inline: DecorationRange[] };
  right: { lines: DecorationRange[]; inline: DecorationRange[] };
}

const vscode = acquireVsCodeApi();
const bootstrapElement = document.getElementById('paste-diff-bootstrap');
const bootstrap = bootstrapElement
  ? (JSON.parse(bootstrapElement.textContent || '{}') as WebviewPayload)
  : { editorWorkerUri: '' };

const leftContainer = document.getElementById('left-editor');
const rightContainer = document.getElementById('right-editor');

if (!leftContainer || !rightContainer) {
  throw new Error('Live Diff editor containers are missing.');
}

self.MonacoEnvironment = {
  getWorker() {
    return new Worker(bootstrap.editorWorkerUri);
  }
};

let leftEditor: monaco.editor.IStandaloneCodeEditor;
let rightEditor: monaco.editor.IStandaloneCodeEditor;
let leftLineDecorations: monaco.editor.IEditorDecorationsCollection;
let leftInlineDecorations: monaco.editor.IEditorDecorationsCollection;
let rightLineDecorations: monaco.editor.IEditorDecorationsCollection;
let rightInlineDecorations: monaco.editor.IEditorDecorationsCollection;
let themeObserver: MutationObserver | undefined;

applyVsCodeTheme();
leftEditor = createEditor(leftContainer, 'Type or paste left content here');
rightEditor = createEditor(rightContainer, 'Type or paste right content here');

leftLineDecorations = leftEditor.createDecorationsCollection([]);
leftInlineDecorations = leftEditor.createDecorationsCollection([]);
rightLineDecorations = rightEditor.createDecorationsCollection([]);
rightInlineDecorations = rightEditor.createDecorationsCollection([]);

leftEditor.onDidChangeModelContent(() => {
  postContent('left', leftEditor.getValue());
});

rightEditor.onDidChangeModelContent(() => {
  postContent('right', rightEditor.getValue());
});

window.addEventListener('resize', layoutEditors);
observeThemeChanges();
layoutEditors();
vscode.postMessage({ type: 'ready' });

window.addEventListener('message', (event: MessageEvent) => {
  const message = event.data as
    | { type: 'init'; left?: string; right?: string }
    | { type: 'setDecorations'; decorations?: DecorationsMessage };

  if (message.type === 'init') {
    setEditorValue(leftEditor, message.left || '');
    setEditorValue(rightEditor, message.right || '');
    return;
  }

  if (message.type === 'setDecorations') {
    applyDecorations(
      message.decorations || {
        left: { lines: [], inline: [] },
        right: { lines: [], inline: [] }
      }
    );
  }
});

function postContent(side: PaneSide, value: string): void {
  vscode.postMessage({
    type: 'contentChanged',
    side,
    value
  });
}

function createEditor(
  container: HTMLElement,
  placeholder: string
): monaco.editor.IStandaloneCodeEditor {
  return monaco.editor.create(container, {
    value: '',
    language: 'plaintext',
    automaticLayout: false,
    fontSize: 13,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'off',
    lineNumbers: 'on',
    glyphMargin: true,
    overviewRulerLanes: 0,
    renderLineHighlight: 'none',
    theme: 'live-diff-theme',
    placeholder
  });
}

function setEditorValue(editor: monaco.editor.IStandaloneCodeEditor, value: string): void {
  if (editor.getValue() === value) {
    return;
  }

  editor.executeEdits('live-diff-init', [
    {
      range: editor.getModel()!.getFullModelRange(),
      text: value
    }
  ]);
  editor.pushUndoStop();
}

function applyDecorations(decorations: DecorationsMessage): void {
  leftLineDecorations.set(toLineDecorations(leftEditor, decorations.left.lines || []));
  leftInlineDecorations.set(toInlineDecorations(decorations.left.inline || []));
  rightLineDecorations.set(toLineDecorations(rightEditor, decorations.right.lines || []));
  rightInlineDecorations.set(toInlineDecorations(decorations.right.inline || []));
}

function toLineDecorations(
  editor: monaco.editor.IStandaloneCodeEditor,
  ranges: DecorationRange[]
): monaco.editor.IModelDeltaDecoration[] {
  const model = editor.getModel()!;
  return ranges.map((range) => ({
    range: new monaco.Range(range.startLine, 1, range.endLine, model.getLineMaxColumn(range.endLine)),
    options: {
      isWholeLine: true,
      className: `paste-diff-line-${range.kind}`,
      glyphMarginClassName: `paste-diff-margin-${range.kind}`
    }
  }));
}

function toInlineDecorations(ranges: DecorationRange[]): monaco.editor.IModelDeltaDecoration[] {
  return ranges.map((range) => ({
    range: new monaco.Range(
      range.startLine,
      range.startColumn || 1,
      range.endLine,
      range.endColumn || 1
    ),
    options: {
      inlineClassName: `paste-diff-inline-${range.kind}`
    }
  }));
}

function layoutEditors(): void {
  leftEditor.layout();
  rightEditor.layout();
}

function observeThemeChanges(): void {
  themeObserver?.disconnect();
  themeObserver = new MutationObserver(() => {
    applyVsCodeTheme();
  });

  themeObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-vscode-theme-id']
  });
}

function applyVsCodeTheme(): void {
  const styles = getComputedStyle(document.body);
  monaco.editor.defineTheme('live-diff-theme', {
    base: getBaseTheme(),
    inherit: true,
    rules: [],
    colors: {
      'editor.background': readThemeColor(styles, '--vscode-editor-background', '#1e1e1e'),
      'editor.foreground': readThemeColor(styles, '--vscode-editor-foreground', '#d4d4d4'),
      'editorLineNumber.foreground': readThemeColor(styles, '--vscode-editorLineNumber-foreground', '#858585'),
      'editorLineNumber.activeForeground': readThemeColor(
        styles,
        '--vscode-editorLineNumber-activeForeground',
        '#c6c6c6'
      ),
      'editorCursor.foreground': readThemeColor(styles, '--vscode-editorCursor-foreground', '#aeafad'),
      'editor.selectionBackground': readThemeColor(
        styles,
        '--vscode-editor-selectionBackground',
        '#264f78'
      ),
      'editor.inactiveSelectionBackground': readThemeColor(
        styles,
        '--vscode-editor-inactiveSelectionBackground',
        '#3a3d41'
      ),
      'editor.selectionHighlightBackground': readThemeColor(
        styles,
        '--vscode-editor-selectionHighlightBackground',
        '#add6ff26'
      ),
      'editor.lineHighlightBackground': readThemeColor(
        styles,
        '--vscode-editor-lineHighlightBackground',
        '#00000000'
      ),
      'editorIndentGuide.background1': readThemeColor(
        styles,
        '--vscode-editorIndentGuide-background1',
        '#404040'
      ),
      'editorIndentGuide.activeBackground1': readThemeColor(
        styles,
        '--vscode-editorIndentGuide-activeBackground1',
        '#707070'
      ),
      'editorWhitespace.foreground': readThemeColor(styles, '--vscode-editorWhitespace-foreground', '#3b3b3b'),
      'scrollbarSlider.background': readThemeColor(
        styles,
        '--vscode-scrollbarSlider-background',
        '#79797966'
      ),
      'scrollbarSlider.hoverBackground': readThemeColor(
        styles,
        '--vscode-scrollbarSlider-hoverBackground',
        '#646464b3'
      ),
      'scrollbarSlider.activeBackground': readThemeColor(
        styles,
        '--vscode-scrollbarSlider-activeBackground',
        '#bfbfbf66'
      )
    }
  });

  monaco.editor.setTheme('live-diff-theme');
}

function getBaseTheme(): 'vs' | 'vs-dark' | 'hc-black' | 'hc-light' {
  if (document.body.classList.contains('vscode-high-contrast-light')) {
    return 'hc-light';
  }

  if (
    document.body.classList.contains('vscode-high-contrast') ||
    document.body.classList.contains('vscode-high-contrast-dark')
  ) {
    return 'hc-black';
  }

  if (document.body.classList.contains('vscode-light')) {
    return 'vs';
  }

  return 'vs-dark';
}

function readThemeColor(styles: CSSStyleDeclaration, variableName: string, fallback: string): string {
  return styles.getPropertyValue(variableName).trim() || fallback;
}
