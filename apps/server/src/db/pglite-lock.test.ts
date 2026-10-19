import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { acquirePgliteLock } from './pglite-lock';

const dirs: string[] = [];
const dataDir = () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'ah-lock-'));
  dirs.push(dir);
  return path.join(dir, 'pglite');
};
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe('acquirePgliteLock', () => {
  it('writes and releases a pid lock', () => {
    const dir = dataDir();
    const release = acquirePgliteLock(dir);
    expect(readFileSync(`${dir}.lock`, 'utf8')).toBe(String(process.pid));
    release();
    expect(existsSync(`${dir}.lock`)).toBe(false);
  });

  it('refuses a directory held by another live process', () => {
    const dir = dataDir();
    writeFileSync(`${dir}.lock`, String(process.ppid));
    expect(() => acquirePgliteLock(dir)).toThrow(/in use by process/);
  });

  it('takes over a lock left by a dead process', () => {
    const dir = dataDir();
    writeFileSync(`${dir}.lock`, '999999');
    acquirePgliteLock(dir)();
  });
});
