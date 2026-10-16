import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { CharacterConfig, DevCharacterResponse } from '@after-hours/contracts';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono, type Context } from 'hono';

import { isPlainObject, type PlainObject } from '../characters/deep-merge';
import { resolveCharacter } from '../characters/resolve';
import type { CharacterStore } from '../characters/store';
import { parseJson } from '../files/cached-file';

import type { PublicProjector } from './companions';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Remote address from the Node socket; `undefined` when unavailable. */
function nodeRemoteAddress(c: Context): string | undefined {
  try {
    return getConnInfo(c).remote.address;
  } catch {
    return undefined;
  }
}

export interface DevCompanionRoutesOptions {
  enabled: boolean;
  store: CharacterStore;
  toPublic: PublicProjector;
  /** Injected in tests; defaults to the Node socket's remote address. */
  remoteAddress?: (c: Context) => string | undefined;
}

/**
 * True only for a direct loopback connection addressed to a local hostname. The Host check
 * blocks DNS-rebinding pages; proxied requests are refused outright.
 */
function isLocalRequest(c: Context, remoteAddress: (c: Context) => string | undefined): boolean {
  if (c.req.header('x-forwarded-for') || c.req.header('forwarded')) return false;
  const address = remoteAddress(c);
  if (!address || !LOOPBACK_ADDRESSES.has(address)) return false;
  // The Node adapter builds the request URL from the Host header.
  return LOCAL_HOSTNAMES.has(new URL(c.req.url).hostname);
}

/** Reads the whole overrides file for rewriting; a missing file is an empty object. */
function readOverridesFile(filePath: string): { ok: true; data: PlainObject } | { ok: false } {
  if (!existsSync(filePath)) return { ok: true, data: {} };
  const json = parseJson(readFileSync(filePath, 'utf8'));
  return json.ok && isPlainObject(json.value) ? { ok: true, data: json.value } : { ok: false };
}

/** Write to a temp file, then rename over the target so readers never see a partial file. */
function writeAtomic(filePath: string, content: string) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temp, content);
  renameSync(temp, filePath);
}

/**
 * Local character editor API. Exists only when `DEV_EDITOR=true`, answers only loopback
 * requests, and writes only the overrides file (`COMPANIONS_CONFIG`), never the presets.
 */
export function devCompanionRoutes(options: DevCompanionRoutesOptions) {
  const { store, toPublic } = options;
  const remoteAddress = options.remoteAddress ?? nodeRemoteAddress;
  const findPreset = (id: string) => store.presets.find((preset) => preset.id === id);

  const respond = (
    c: Context,
    preset: CharacterConfig,
    override: PlainObject | null,
  ): DevCharacterResponse => {
    const result = resolveCharacter(preset, override);
    return {
      id: preset.id,
      preset,
      override,
      merged: result.character,
      valid: result.valid,
      issues: result.issues,
      public: toPublic(result.character, c.req.url),
    };
  };

  return new Hono()
    .use('/dev/*', async (c, next) => {
      if (!options.enabled) return c.json({ error: 'Not found' }, 404);
      if (!isLocalRequest(c, remoteAddress)) {
        return c.json({ error: 'The dev editor only accepts requests from localhost.' }, 403);
      }
      await next();
    })
    .get('/dev/companions/:id', (c) => {
      const preset = findPreset(c.req.param('id'));
      if (!preset) return c.json({ error: 'Unknown companion' }, 404);
      const override = store.overrides()?.[preset.id] ?? null;
      return c.json(respond(c, preset, override));
    })
    .put('/dev/companions/:id', async (c) => {
      const preset = findPreset(c.req.param('id'));
      if (!preset) return c.json({ error: 'Unknown companion' }, 404);

      const body = parseJson(await c.req.text());
      if (!body.ok || !isPlainObject(body.value)) {
        return c.json({ error: 'Body must be a JSON object (a partial character config).' }, 400);
      }
      const override = body.value;
      const response = respond(c, preset, override);
      if (!response.valid) return c.json(response, 422);

      const file = readOverridesFile(store.overridesPath);
      if (!file.ok) {
        return c.json(
          { error: `${store.overridesPath} is not a valid JSON object; fix or delete it first.` },
          409,
        );
      }
      const next: PlainObject = { ...file.data };
      if (Object.keys(override).length === 0) delete next[preset.id];
      else next[preset.id] = override;
      writeAtomic(store.overridesPath, `${JSON.stringify(next, null, 2)}\n`);
      return c.json(response);
    });
}
