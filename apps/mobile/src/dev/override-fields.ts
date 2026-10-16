import type { CharacterConfig } from '@after-hours/contracts';

type Json = Record<string, unknown>;

/** Core fields the dev editor exposes as inputs; everything else goes through the JSON box. */
export const CORE_FIELDS = [
  { key: 'name', path: ['name'], label: 'Name', kind: 'text' },
  { key: 'age', path: ['age'], label: 'Age', kind: 'number' },
  { key: 'tagline', path: ['tagline'], label: 'Tagline', kind: 'text' },
  { key: 'statusLine', path: ['statusLine'], label: 'Status line', kind: 'text' },
  { key: 'bio', path: ['bio'], label: 'Bio', kind: 'multiline' },
  {
    key: 'starters',
    path: ['examples', 'starters'],
    label: 'Starters (one per line)',
    kind: 'lines',
  },
  {
    key: 'instructions',
    path: ['personality', 'instructions'],
    label: 'Personality instructions (prompt)',
    kind: 'multiline',
  },
] as const;

export type CoreField = (typeof CORE_FIELDS)[number];
export type CoreValues = Record<CoreField['key'], string>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function getPath(source: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>((node, key) => (isObject(node) ? node[key] : undefined), source);
}

function setPath(target: Json, path: readonly string[], value: unknown) {
  const [head, ...rest] = path;
  if (head === undefined) return;
  if (rest.length === 0) {
    target[head] = value;
    return;
  }
  const child = isObject(target[head]) ? target[head] : {};
  target[head] = child;
  setPath(child, rest, value);
}

/** Removes the value at `path`, then prunes parents left empty. */
function unsetPath(target: Json, path: readonly string[]) {
  const [head, ...rest] = path;
  if (head === undefined || !(head in target)) return;
  const child = target[head];
  if (rest.length === 0) delete target[head];
  else if (isObject(child)) {
    unsetPath(child, rest);
    if (Object.keys(child).length === 0) delete target[head];
  }
}

function toInput(field: CoreField, value: unknown): string {
  if (field.kind === 'lines') return Array.isArray(value) ? value.join('\n') : '';
  return value === undefined ? '' : String(value);
}

function fromInput(field: CoreField, text: string): unknown {
  if (field.kind === 'number') return text.trim() === '' ? text : Number(text);
  if (field.kind === 'lines') {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return text;
}

export function coreValuesFrom(config: CharacterConfig): CoreValues {
  return Object.fromEntries(
    CORE_FIELDS.map((field) => [field.key, toInput(field, getPath(config, field.path))]),
  ) as CoreValues;
}

/**
 * Builds the override to save: the advanced JSON, with each core field set when it differs
 * from the preset and removed when it matches (so the override stays minimal).
 */
export function buildOverride(advanced: Json, values: CoreValues, preset: CharacterConfig): Json {
  const override: Json = structuredClone(advanced);
  for (const field of CORE_FIELDS) {
    const value = fromInput(field, values[field.key]);
    const presetValue = getPath(preset, field.path);
    if (JSON.stringify(value) === JSON.stringify(presetValue)) unsetPath(override, field.path);
    else setPath(override, field.path, value);
  }
  return override;
}

export function parseAdvanced(
  text: string,
): { ok: true; value: Json } | { ok: false; error: string } {
  try {
    const value: unknown = JSON.parse(text.trim() === '' ? '{}' : text);
    return isObject(value)
      ? { ok: true, value }
      : { ok: false, error: 'Advanced JSON must be an object.' };
  } catch (error) {
    return {
      ok: false,
      error: `Advanced JSON: ${error instanceof Error ? error.message : 'invalid'}`,
    };
  }
}
