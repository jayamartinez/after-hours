/**
 * Writes `character.schema.json` (editor autocomplete for presets) from the Zod schema.
 * Run with `pnpm companions:schema`; a test fails if the committed file is stale.
 */
import { writeFileSync } from 'node:fs';

import { characterJsonSchemaText, SCHEMA_PATH } from '../src/json-schema';

writeFileSync(SCHEMA_PATH, characterJsonSchemaText());
console.log(`[companions] wrote ${SCHEMA_PATH}`);
