(function () {
  const vscode = acquireVsCodeApi();
  const bootstrapElement = document.getElementById('paste-diff-bootstrap');
  const bootstrap = bootstrapElement ? JSON.parse(bootstrapElement.textContent || '{}') : {};

  const leftContainer = document.getElementById('left-editor');
  const rightContainer = document.getElementById('right-editor');

  let leftEditor;
  let rightEditor;
  let leftLineDecorations;
  let leftInlineDecorations;
  let rightLineDecorations;
  let rightInlineDecorations;
  let themeObserver;

  function postContent(side, value) {
    vscode.postMessage({
      type: 'contentChanged',
      side,
      value
    });
  }

  window.MonacoEnvironment = {
    getWorkerUrl: function () {
      const source = [
        "self.MonacoEnvironment = { baseUrl: '" + bootstrap.monacoBaseUri + "/' };",
        "importScripts('" + bootstrap.monacoBaseUri + "/base/worker/workerMain.js');"
      ].join('\n');
      return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(source);
    }
  };

  const loaderScript = document.createElement('script');
  loaderScript.src = bootstrap.monacoLoaderUri;
  loaderScript.setAttribute('nonce', document.querySelector('script[nonce]')?.nonce || '');
  loaderScript.onload = function () {
    require.config({
      paths: {
        vs: bootstrap.monacoBaseUri
      }
    });

    require(['vs/editor/editor.main'], function () {
      applyVsCodeTheme();
      leftEditor = createEditor(leftContainer, 'Type or paste left content here');
      rightEditor = createEditor(rightContainer, 'Type or paste right content here');

      leftLineDecorations = leftEditor.createDecorationsCollection([]);
      leftInlineDecorations = leftEditor.createDecorationsCollection([]);
      rightLineDecorations = rightEditor.createDecorationsCollection([]);
      rightInlineDecorations = rightEditor.createDecorationsCollection([]);

      leftEditor.onDidChangeModelContent(function () {
        postContent('left', leftEditor.getValue());
      });

      rightEditor.onDidChangeModelContent(function () {
        postContent('right', rightEditor.getValue());
      });

      window.addEventListener('resize', layoutEditors);
      observeThemeChanges();
      layoutEditors();

      vscode.postMessage({ type: 'ready' });
    });
  };
  loaderScript.onerror = function () {
    leftContainer.innerHTML = '<div style="padding:12px;color:var(--vscode-errorForeground);">Failed to load editor runtime.</div>';
    rightContainer.innerHTML = '<div style="padding:12px;color:var(--vscode-errorForeground);">Failed to load editor runtime.</div>';
  };

  document.body.appendChild(loaderScript);

  window.addEventListener('message', function (event) {
    const message = event.data;

    if (!leftEditor || !rightEditor) {
      return;
    }

    if (message.type === 'init') {
      setEditorValue(leftEditor, message.left || '');
      setEditorValue(rightEditor, message.right || '');
      return;
    }

    if (message.type === 'setDecorations') {
      applyDecorations(message.decorations || {
        left: { lines: [], inline: [] },
        right: { lines: [], inline: [] }
      });
    }
  });

  function createEditor(container, placeholder) {
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
      theme: 'paste-diff-theme',
      placeholder
    });
  }

  function setEditorValue(editor, value) {
    if (editor.getValue() === value) {
      return;
    }

    editor.executeEdits('paste-diff-init', [
      {
        range: editor.getModel().getFullModelRange(),
        text: value
      }
    ]);
    editor.pushUndoStop();
  }

  function applyDecorations(decorations) {
    leftLineDecorations.set(toLineDecorations(leftEditor, decorations.left.lines || []));
    leftInlineDecorations.set(toInlineDecorations(decorations.left.inline || []));
    rightLineDecorations.set(toLineDecorations(rightEditor, decorations.right.lines || []));
    rightInlineDecorations.set(toInlineDecorations(decorations.right.inline || []));
  }

  function toLineDecorations(editor, ranges) {
    const model = editor.getModel();
    return ranges.map(function (range) {
      const suffix = range.kind;
      const endColumn = model.getLineMaxColumn(range.endLine);
      return {
        range: new monaco.Range(range.startLine, 1, range.endLine, endColumn),
        options: {
          isWholeLine: true,
          className: 'paste-diff-line-' + suffix,
          glyphMarginClassName: 'paste-diff-margin-' + suffix,
          overviewRuler: {
            color: 'transparent',
            position: 0
          }
        }
      };
    });
  }

  function toInlineDecorations(ranges) {
    return ranges.map(function (range) {
      return {
        range: new monaco.Range(
          range.startLine,
          range.startColumn,
          range.endLine,
          range.endColumn
        ),
        options: {
          inlineClassName: 'paste-diff-inline-' + range.kind
        }
      };
    });
  }

  function layoutEditors() {
    if (leftEditor) {
      leftEditor.layout();
    }
    if (rightEditor) {
      rightEditor.layout();
    }
  }

  function observeThemeChanges() {
    if (themeObserver) {
      themeObserver.disconnect();
    }

    themeObserver = new MutationObserver(function () {
      applyVsCodeTheme();
    });

    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-vscode-theme-id']
    });
  }

  function applyVsCodeTheme() {
    if (typeof monaco === 'undefined' || !monaco.editor) {
      return;
    }

    const styles = getComputedStyle(document.body);
    const base = getBaseTheme();

    monaco.editor.defineTheme('paste-diff-theme', {
      base,
      inherit: true,
      rules: [],
      colors: {
        'editor.background': readThemeColor(styles, '--vscode-editor-background', '#1e1e1e'),
        'editor.foreground': readThemeColor(styles, '--vscode-editor-foreground', '#d4d4d4'),
        'editorLineNumber.foreground': readThemeColor(styles, '--vscode-editorLineNumber-foreground', '#858585'),
        'editorLineNumber.activeForeground': readThemeColor(styles, '--vscode-editorLineNumber-activeForeground', '#c6c6c6'),
        'editorCursor.foreground': readThemeColor(styles, '--vscode-editorCursor-foreground', '#aeafad'),
        'editor.selectionBackground': readThemeColor(styles, '--vscode-editor-selectionBackground', '#264f78'),
        'editor.inactiveSelectionBackground': readThemeColor(styles, '--vscode-editor-inactiveSelectionBackground', '#3a3d41'),
        'editor.selectionHighlightBackground': readThemeColor(styles, '--vscode-editor-selectionHighlightBackground', '#add6ff26'),
        'editor.lineHighlightBackground': readThemeColor(styles, '--vscode-editor-lineHighlightBackground', '#00000000'),
        'editorIndentGuide.background1': readThemeColor(styles, '--vscode-editorIndentGuide-background1', '#404040'),
        'editorIndentGuide.activeBackground1': readThemeColor(styles, '--vscode-editorIndentGuide-activeBackground1', '#707070'),
        'editorWhitespace.foreground': readThemeColor(styles, '--vscode-editorWhitespace-foreground', '#3b3b3b'),
        'scrollbarSlider.background': readThemeColor(styles, '--vscode-scrollbarSlider-background', '#79797966'),
        'scrollbarSlider.hoverBackground': readThemeColor(styles, '--vscode-scrollbarSlider-hoverBackground', '#646464b3'),
        'scrollbarSlider.activeBackground': readThemeColor(styles, '--vscode-scrollbarSlider-activeBackground', '#bfbfbf66')
      }
    });

    monaco.editor.setTheme('paste-diff-theme');
  }

  function getBaseTheme() {
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

  function readThemeColor(styles, variableName, fallback) {
    const value = styles.getPropertyValue(variableName).trim();
    return value || fallback;
  }
})();
