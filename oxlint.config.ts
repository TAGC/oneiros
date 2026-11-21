import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['eslint', 'typescript', 'import'],
  categories: { correctness: 'error', suspicious: 'warn' },
  env: { browser: true, es2024: true },
  ignorePatterns: ['dist', '.astro', '.claude', 'reference', 'node_modules'],
  rules: {
    'typescript/no-explicit-any': 'error',
    'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'import/no-duplicates': 'error',
    'prefer-const': 'error',
    'import/no-unassigned-import': 'off',
  },
});
