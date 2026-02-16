#!/usr/bin/env node
/**
 * Copies the coverage HTML report to a timestamped filename.
 * Run after: vitest run --coverage
 */
import fs from 'fs';
import process from 'node:process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const coverageDir = path.join(__dirname, '..', 'coverage');
const sourceFile = path.join(coverageDir, 'index.html');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const destFile = path.join(__dirname, '..', `coverage-report-${timestamp}.html`);

if (fs.existsSync(sourceFile)) {
  fs.copyFileSync(sourceFile, destFile);
  console.log('Coverage report saved to:', path.basename(destFile));
} else {
  console.error('Coverage report not found at', sourceFile);
  process.exit(1);
}
