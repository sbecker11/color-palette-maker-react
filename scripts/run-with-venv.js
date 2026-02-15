#!/usr/bin/env node
/**
 * Prepends the project venv to PATH and sets VIRTUAL_ENV (simulating `source venv/bin/activate`)
 * so region detection (required) finds Python/OpenCV. Then runs the given command.
 * Usage: node scripts/run-with-venv.js <command> [args...]
 * Example: node scripts/run-with-venv.js node server.js
 */
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const venvBin = path.join(projectRoot, 'venv', isWin ? 'Scripts' : 'bin');
const venvDir = path.join(projectRoot, 'venv');
const pathSep = isWin ? ';' : ':';

const env = { ...process.env };
env.VIRTUAL_ENV = venvDir;
env.PATH = venvBin + pathSep + (env.PATH || '');

const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('Usage: node scripts/run-with-venv.js <command> [args...]');
  process.exit(1);
}

const proc = spawn(cmd, args, { stdio: 'inherit', env, shell: false });
proc.on('exit', (code) => process.exit(code ?? 0));
