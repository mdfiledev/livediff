const esbuild = require('esbuild');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

async function build() {
  await esbuild.build({
    entryPoints: [path.join(rootDir, 'src', 'webview.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: path.join(rootDir, 'media', 'main.js'),
    loader: {
      '.ttf': 'file'
    },
    assetNames: 'assets/[name]-[hash]',
    legalComments: 'none',
    minify: true,
    logLevel: 'info'
  });

  await esbuild.build({
    entryPoints: [path.join(rootDir, 'src', 'editor.worker.ts')],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outfile: path.join(rootDir, 'media', 'editor.worker.js'),
    legalComments: 'none',
    minify: true,
    logLevel: 'info'
  });
}

build().catch((error) => {
  console.error(error);
  process.exit(1);
});
