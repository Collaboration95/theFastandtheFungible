import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.playwright/**',
      'coverage/**',
      'dist/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'ui-overhaul/prototype/**',
    ],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-extra-boolean-cast': 'warn',
      'preserve-caught-error': 'warn',
    },
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx}'],
  })),
  {
    ...reactHooks.configs.flat.recommended,
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      ...reactHooks.configs.flat.recommended.rules,
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ...reactRefresh.configs.vite,
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      ...reactRefresh.configs.vite.rules,
      'react-refresh/only-export-components': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src/ui/setup.tsx'],
    rules: {
      // This module intentionally co-locates the setup component with its
      // local-storage contract so drafts share one versioned boundary.
      'react-refresh/only-export-components': 'off',
    },
  },
)
