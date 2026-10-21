import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/.expo/',
    '**/web-build/',
    '**/expo-env.d.ts',
    '.vercel/',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/server/**', 'apps/*/scripts/**', 'scripts/**', 'packages/**', '*.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/mobile/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
    rules: {
      // The app reaches AI only through apps/server (AGENTS.md boundaries).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@anthropic-ai/*', 'openai', '@fal-ai/*', 'replicate', 'elevenlabs*'],
              message: 'Provider SDKs belong in apps/server/src/providers.',
            },
          ],
        },
      ],
    },
  },
]);
