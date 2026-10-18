import { readFileSync, rmSync, writeFileSync } from 'node:fs';

/**
 * PGlite is single-process: two processes opening one data directory can corrupt it.
 * A pid lock file next to the directory turns that into a clear error (e.g. running
 * `pnpm db:migrate` while `pnpm dev` is up). A lock left by a dead process is taken over.
 */
export function acquirePgliteLock(dataDir: string): () => void {
  const file = `${dataDir}.lock`;
  try {
    writeFileSync(file, String(process.pid), { flag: 'wx' });
  } catch {
    const holder = Number(readFileSync(file, 'utf8'));
    if (holder && holder !== process.pid && isAlive(holder)) {
      throw new Error(
        `The local database ${dataDir} is in use by process ${holder} (probably the dev server). Stop it first.`,
      );
    }
    writeFileSync(file, String(process.pid));
  }
  return () => rmSync(file, { force: true });
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
