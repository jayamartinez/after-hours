import { fileURLToPath } from 'node:url';

import { CharacterConfigSchema } from '@after-hours/contracts';
import { z } from 'zod';

/** Node-only (scripts and tests). Not exported from the package entry. */
export const SCHEMA_PATH = fileURLToPath(new URL('../character.schema.json', import.meta.url));

export function characterJsonSchemaText(): string {
  const schema = z.toJSONSchema(CharacterConfigSchema, { io: 'input' });
  return `${JSON.stringify({ title: 'After Hours character config', ...schema }, null, 2)}\n`;
}
