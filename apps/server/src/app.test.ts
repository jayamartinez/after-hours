import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { CompanionsResponseSchema, HealthResponseSchema } from '@after-hours/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from './app';
import { testConfig } from './test-config';

let workDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  workDir = mkdtempSync(path.join(tmpdir(), 'ah-app-'));
  const config = testConfig(workDir);
  mkdirSync(path.join(config.privateAssetsDir, 'roy'), { recursive: true });
  writeFileSync(path.join(config.privateAssetsDir, 'roy', 'hero.jpg'), 'fake-jpeg');
  writeFileSync(path.join(workDir, 'secret.json'), '{"secret":true}');
  writeFileSync(config.manifestPath, JSON.stringify({ roy: { hero: { src: 'roy/hero.jpg' } } }));
  writeFileSync(
    config.companionsConfigPath,
    JSON.stringify({ roy: { name: 'Roy (test)', tagline: 'Overridden tagline' } }),
  );
  app = createApp(config, () => {});
});

afterAll(() => rmSync(workDir, { recursive: true, force: true }));

describe('server routes', () => {
  it('GET /health', async () => {
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(HealthResponseSchema.parse(await res.json()).status).toBe('ok');
  });

  it('GET /companions returns public characters with overrides and resolved images', async () => {
    const res = await app.request('http://api.test/companions');
    const body = CompanionsResponseSchema.parse(await res.json());
    expect(body.companions.map((c) => c.id)).toEqual(['roy', 'roya']);
    const [roy, roya] = body.companions;
    expect(roy?.name).toBe('Roy (test)');
    expect(roy?.tagline).toBe('Overridden tagline');
    expect(roy?.images.hero.uri).toBe('http://api.test/assets/private/roy/hero.jpg');
    expect(roya?.name).toBe('Roya');
    const json = JSON.stringify(body);
    for (const key of [
      '"instructions"',
      '"boundaries"',
      '"style"',
      '"voiceIdEnv"',
      '"proactive"',
    ]) {
      expect(json).not.toContain(key);
    }
  });

  it('dev editor routes do not exist when DEV_EDITOR is off', async () => {
    expect((await app.request('http://localhost/dev/companions/roy')).status).toBe(404);
  });

  it('serves a private asset with image headers', async () => {
    const res = await app.request('/assets/private/roy/hero.jpg');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toContain('max-age');
    expect(await res.text()).toBe('fake-jpeg');
  });

  it.each([
    '/assets/private/..%2Fsecret.json',
    '/assets/private/..%2F..%2Fpackage.json',
    '/assets/private/roy%2F..%2F..%2Fsecret.json',
    '/assets/private/%E0%A4%A',
    '/assets/private/..%5Csecret.json',
    '/assets/private/roy%5C..%5C..%5Csecret.json',
    '/assets/private/roy%5Chero.jpg',
    '/assets/private/C:%2Fsecret.json',
    '/assets/private/%2Fetc%2Fpasswd',
  ])('rejects traversal or malformed path %s', async (url) => {
    const res = await app.request(url);
    expect(res.status).toBe(400);
  });

  it('404s for a missing file or a non-image extension', async () => {
    expect((await app.request('/assets/private/roy/missing.jpg')).status).toBe(404);
    expect((await app.request('/assets/private/roy/hero.txt')).status).toBe(404);
  });

  it('allows the Expo web origin via CORS', async () => {
    const res = await app.request('/companions', { headers: { Origin: 'http://localhost:8081' } });
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
  });
});
