const fs = require('fs');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const manifestPath = path.join(rootDir, 'package.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const extensionDirName = `${manifest.publisher}.${manifest.name}-${manifest.version}`;
const targetRoot = path.join(os.homedir(), '.vscode', 'extensions');
const targetDir = path.join(targetRoot, extensionDirName);
const legacyDirs = [
  path.join(targetRoot, `local.pastediff-${manifest.version}`)
];

const entriesToCopy = [
  'media',
  'node_modules/diff',
  'out',
  'package.json',
  'package-lock.json',
  'README.md',
  'LICENSE'
];

fs.mkdirSync(targetRoot, { recursive: true });
for (const legacyDir of legacyDirs) {
  fs.rmSync(legacyDir, { recursive: true, force: true });
}
fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

for (const entry of entriesToCopy) {
  const source = path.join(rootDir, entry);
  if (!fs.existsSync(source)) {
    continue;
  }

  const destination = path.join(targetDir, entry);
  fs.cpSync(source, destination, { recursive: true });
}

console.log(`Installed Live Diff to ${targetDir}`);
console.log('Restart VS Code to load the updated extension.');
