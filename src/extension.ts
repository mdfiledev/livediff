import * as vscode from 'vscode';
import { buildDecorations, PaneSide } from './diff';

interface SessionState {
  panel: vscode.WebviewPanel;
  left: string;
  right: string;
  debounceTimer?: NodeJS.Timeout;
}

interface WebviewMessage {
  type: 'ready' | 'contentChanged';
  side?: PaneSide;
  value?: string;
}

let sessionCounter = 0;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('livediff.open', () => {
      const sessionId = ++sessionCounter;
      const panel = vscode.window.createWebviewPanel(
        'livediff.session',
        `Live Diff ${sessionId}`,
        vscode.ViewColumn.Active,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
        }
      );

      const session: SessionState = {
        panel,
        left: '',
        right: ''
      };

      panel.webview.html = getWebviewHtml(panel.webview, context.extensionUri);

      const disposable = panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
        if (message.type === 'ready') {
          void panel.webview.postMessage({
            type: 'init',
            title: panel.title,
            left: session.left,
            right: session.right
          });
          return;
        }

        if (message.type === 'contentChanged' && message.side && typeof message.value === 'string') {
          session[message.side] = message.value;
          scheduleDiffUpdate(session);
        }
      });

      panel.onDidDispose(() => {
        disposable.dispose();
        if (session.debounceTimer) {
          clearTimeout(session.debounceTimer);
        }
      });
    })
  );
}

export function deactivate(): void {
  // No-op.
}

function scheduleDiffUpdate(session: SessionState): void {
  if (session.debounceTimer) {
    clearTimeout(session.debounceTimer);
  }

  session.debounceTimer = setTimeout(() => {
    const decorations = buildDecorations(session.left, session.right);
    void session.panel.webview.postMessage({
      type: 'setDecorations',
      decorations
    });
  }, 120);
}

function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = createNonce();
  const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.css'));
  const appScriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
  const editorWorkerUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'editor.worker.js')
  );

  const bootstrap = JSON.stringify({
    editorWorkerUri: editorWorkerUri.toString()
  });

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'none'; img-src ${webview.cspSource} data:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource}; font-src ${webview.cspSource} data:; worker-src blob: data: ${webview.cspSource};"
    />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Live Diff</title>
    <link nonce="${nonce}" rel="stylesheet" href="${stylesUri}" />
  </head>
  <body>
    <div class="app-shell">
      <header class="app-header">
        <div>
          <h1>Live Diff</h1>
          <p>Type or paste content into both panes to render a live side-by-side diff.</p>
        </div>
      </header>
      <main class="editor-grid">
        <section class="editor-column">
          <div class="editor-label">Left</div>
          <div id="left-editor" class="editor-surface"></div>
        </section>
        <section class="editor-column">
          <div class="editor-label">Right</div>
          <div id="right-editor" class="editor-surface"></div>
        </section>
      </main>
    </div>
    <script nonce="${nonce}" id="paste-diff-bootstrap" type="application/json">${bootstrap}</script>
    <script nonce="${nonce}" src="${appScriptUri}"></script>
  </body>
</html>`;
}

function createNonce(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let nonce = '';
  for (let index = 0; index < 32; index += 1) {
    nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
  }
  return nonce;
}
