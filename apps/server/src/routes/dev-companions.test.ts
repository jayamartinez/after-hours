import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DevCharacterResponseSchema } from '@after-hours/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../app';
import { testConfig } from '../test-config';

const PRESET_DIR = fileURLToPath(
  new URL('../../../../packages/companions/presets/', import.meta.url),
);
const presetText = () => readFileSync(path.join(PRESET_DIR, 'roy.json'), 'utf8');

let workDir: string;
let overridesPath: string;

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-dev-'));
  overridesPath = path.join(workDir, 'config', 'companions.local.json');
});
afterEach(() => rmSync(workDir, { recursive: true, force: true }));

function makeApp(devEditor: boolean, remote = '127.0.0.1') {
  return createApp(
    testConfig(workDir, { devEditor, companionsConfigPath: overridesPath }),
    () => {},
    { remoteAddress: () => remote },
  );
}

const put = (body: unknown, host = 'http://localhost:8787') =>
  new Request(`${host}/dev/companions/roy`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('dev editor gate', () => {
  it('404s when DEV_EDITOR is off, even from localhost', async () => {
    const app = makeApp(false);
    expect((await app.request('http://localhost:8787/dev/companions/roy')).status).toBe(404);
    expect((await app.request(put({ name: 'x' }))).status).toBe(404);
    expect(existsSync(overridesPath)).toBe(false);
  });

  it('403s for a non-loopback client', async () => {
    const app = makeApp(true, '192.168.1.20');
    expect((await app.request('http://localhost:8787/dev/companions/roy')).status).toBe(403);
    expect((await app.request(put({ name: 'x' }))).status).toBe(403);
    expect(existsSync(overridesPath)).toBe(false);
  });

  it('403s for a non-local Host header (DNS rebinding) or a proxied request', async () => {
    const app = makeApp(true);
    expect((await app.request(put({ name: 'x' }, 'http://evil.example:8787'))).status).toBe(403);
    const proxied = await app.request('http://localhost:8787/dev/companions/roy', {
      headers: { 'x-forwarded-for': '203.0.113.9' },
    });
    expect(proxied.status).toBe(403);
  });
});

describe('dev editor API', () => {
  it('GET returns preset, override, merged config, and validation status', async () => {
    const app = makeApp(true);
    const res = await app.request('http://localhost:8787/dev/companions/roy');
    expect(res.status).toBe(200);
    const body = DevCharacterResponseSchema.parse(await res.json());
    expect(body).toMatchObject({ id: 'roy', override: null, valid: true, issues: [] });
    expect(body.merged).toEqual(body.preset);
  });

  it('PUT writes only the local override file and the change shows in /companions', async () => {
    const before = presetText();
    const app = makeApp(true);

    const res = await app.request(put({ name: 'Roy (test)', age: 30 }));
    expect(res.status).toBe(200);
    expect(DevCharacterResponseSchema.parse(await res.json()).merged.name).toBe('Roy (test)');

    expect(JSON.parse(readFileSync(overridesPath, 'utf8'))).toEqual({
      roy: { name: 'Roy (test)', age: 30 },
    });
    expect(presetText()).toBe(before);

    const list = (await (await app.request('http://localhost:8787/companions')).json()) as {
      companions: { name: string }[];
    };
    expect(list.companions[0]?.name).toBe('Roy (test)');
  });

  it('PUT keeps other companions’ overrides and an empty object resets one', async () => {
    const app = makeApp(true);
    await app.request(put({ age: 30 }));
    const roya = new Request('http://localhost:8787/dev/companions/roya', {
      method: 'PUT',
      body: JSON.stringify({ name: 'Roya (test)' }),
    });
    await app.request(roya);
    await app.request(put({}));
    expect(JSON.parse(readFileSync(overridesPath, 'utf8'))).toEqual({
      roya: { name: 'Roya (test)' },
    });
  });

  it('PUT rejects an invalid override with issues (422) and writes nothing', async () => {
    const app = makeApp(true);
    const res = await app.request(put({ age: 12, persona: { style: { casing: 'loud' } } }));
    expect(res.status).toBe(422);
    const body = DevCharacterResponseSchema.parse(await res.json());
    expect(body.valid).toBe(false);
    expect(body.issues.map((i) => i.path)).toEqual(
      expect.arrayContaining(['age', 'persona.style.casing']),
    );
    expect(existsSync(overridesPath)).toBe(false);
  });

  it('PUT rejects a non-object body (400)', async () => {
    const app = makeApp(true);
    expect((await app.request(put('[1,2]'))).status).toBe(400);
    expect((await app.request(put('{ nope'))).status).toBe(400);
  });
});
