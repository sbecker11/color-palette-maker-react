import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { readMetadata, appendMetadata, rewriteMetadata } = require(path.resolve(__dirname, '../../metadata_handler.js'));

describe('metadata_handler', () => {
  let tempDir;
  let tempFile;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'metadata-test-'));
    tempFile = path.join(tempDir, 'image_metadata.jsonl');
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  describe('readMetadata', () => {
    it('returns empty array when file does not exist', async () => {
      const result = await readMetadata(tempFile);
      expect(result).toEqual([]);
    });

    it('reads and parses JSONL records', async () => {
      const records = [
        { cachedFilePath: '/uploads/img-1.jpeg', paletteName: 'img-1' },
        { cachedFilePath: '/uploads/img-2.png', paletteName: 'img-2' },
      ];
      const content = records.map((r) => JSON.stringify(r)).join(os.EOL) + os.EOL;
      await fs.promises.writeFile(tempFile, content, 'utf8');

      const result = await readMetadata(tempFile);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(records[0]);
      expect(result[1]).toEqual(records[1]);
    });

    it('ignores empty lines', async () => {
      const record = { cachedFilePath: '/uploads/img-1.jpeg' };
      const content = JSON.stringify(record) + os.EOL + os.EOL + os.EOL;
      await fs.promises.writeFile(tempFile, content, 'utf8');

      const result = await readMetadata(tempFile);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(record);
    });
  });

  describe('appendMetadata', () => {
    it('appends a record to an empty file', async () => {
      const record = { cachedFilePath: '/uploads/img-1.jpeg', paletteName: 'img-1' };
      await appendMetadata(record, tempFile);

      const result = await readMetadata(tempFile);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(record);
    });

    it('appends multiple records', async () => {
      const r1 = { cachedFilePath: '/uploads/img-1.jpeg' };
      const r2 = { cachedFilePath: '/uploads/img-2.png' };
      await appendMetadata(r1, tempFile);
      await appendMetadata(r2, tempFile);

      const result = await readMetadata(tempFile);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(r1);
      expect(result[1]).toEqual(r2);
    });
  });

  describe('rewriteMetadata', () => {
    it('writes records to file', async () => {
      const records = [
        { cachedFilePath: '/uploads/img-1.jpeg' },
        { cachedFilePath: '/uploads/img-2.png' },
      ];
      await rewriteMetadata(records, tempFile);

      const result = await readMetadata(tempFile);
      expect(result).toHaveLength(2);
      expect(result).toEqual(records);
    });

    it('overwrites existing content', async () => {
      await appendMetadata({ cachedFilePath: '/old.jpeg' }, tempFile);
      const newRecords = [{ cachedFilePath: '/new.jpeg' }];
      await rewriteMetadata(newRecords, tempFile);

      const result = await readMetadata(tempFile);
      expect(result).toHaveLength(1);
      expect(result[0].cachedFilePath).toBe('/new.jpeg');
    });

    it('handles empty array', async () => {
      await rewriteMetadata([], tempFile);
      const result = await readMetadata(tempFile);
      expect(result).toEqual([]);
    });
  });
});
