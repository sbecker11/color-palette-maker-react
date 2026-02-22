#!/usr/bin/env node
/**
 * Checks changed files since ref (default: HEAD) and suggests what to run.
 * Usage: node scripts/check-build-needed.js [git-ref]
 * Example: node scripts/check-build-needed.js  # vs last commit
 *          node scripts/check-build-needed.js HEAD~1  # vs previous commit
 */
const { execSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const prodMode = args.includes('--prod');
const ref = args.find((a) => !a.startsWith('--')) || 'HEAD';
const rootDir = path.join(__dirname, '..');

const clientPaths = ['client/'];
const serverPaths = ['server.js', 'metadata_handler.js', 'image_processor.js', 'scripts/detect_regions.py', 'scripts/run-with-venv.js'];
const configPaths = ['package.json', 'client/package.json', 'client/vite.config.js', '.env'];

function getChangedFiles() {
  try {
    const out = execSync(`git diff --name-only ${ref}`, { cwd: rootDir, encoding: 'utf8' });
    return out.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function matchesAny(file, patterns) {
  return patterns.some((p) => file === p || file.startsWith(p));
}

const changed = getChangedFiles();
if (changed.length === 0) {
  console.log('No uncommitted/diff changes detected.');
  process.exit(0);
}

const clientChanged = changed.some((f) => matchesAny(f, clientPaths));
const serverChanged = changed.some((f) => matchesAny(f, serverPaths));
const configChanged = changed.some((f) => matchesAny(f, configPaths));

const suggestions = [];

if (configChanged) {
  suggestions.push('Dependency/config changed: run `npm install` and restart dev servers.');
}

if (serverChanged && !configChanged) {
  suggestions.push('Server files changed: restart `npm run dev:server` (or `npm run dev`).');
}

if (clientChanged) {
  if (process.env.NODE_ENV === 'production' || prodMode) {
    suggestions.push('Client files changed: run `npm run build` for production.');
  } else {
    suggestions.push('Client files changed: Vite HMR will auto-update. Refresh browser if needed.');
  }
}

if (suggestions.length === 0) {
  console.log('Changed files:', changed.join(', '));
  console.log('No build/restart suggested for these paths.');
} else {
  console.log('Suggestions:');
  suggestions.forEach((s) => console.log('  •', s));
}
