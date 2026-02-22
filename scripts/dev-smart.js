#!/usr/bin/env node
/**
 * One-command dev: installs deps if package.json changed, then starts dev servers.
 * Use: npm run dev:x (or dev:smart)
 * - If package.json or client/package.json changed: runs npm install, then npm run dev
 * - Otherwise: runs npm run dev
 * Vite HMR and nodemon handle live updates; no manual rebuild needed.
 */
const { execSync, spawn } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const configPaths = ['package.json', 'client/package.json'];

function getChangedFiles() {
  try {
    const out = execSync('git diff --name-only HEAD', { cwd: rootDir, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function needsInstall() {
  const changed = getChangedFiles();
  return configPaths.some((p) => changed.includes(p));
}

function run(cmd, opts = {}) {
  execSync(cmd, { cwd: rootDir, stdio: 'inherit', ...opts });
}

if (needsInstall()) {
  console.log('[dev:x] package.json changed — installing dependencies...');
  run('npm install');
  run('cd client && npm install');
  console.log('[dev:x] Starting dev servers...\n');
} else {
  console.log('[dev:x] Starting dev servers...\n');
}

const proc = spawn('npm', ['run', 'dev'], { cwd: rootDir, stdio: 'inherit', shell: true });
proc.on('exit', (code) => process.exit(code ?? 0));
