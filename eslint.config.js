import eslint from '@eslint/js';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			'simple-import-sort': simpleImportSort,
		},
		rules: {
			'simple-import-sort/imports': 'warn',
			'simple-import-sort/exports': 'warn',
			'@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
			'@typescript-eslint/no-unused-expressions': 'warn',
			curly: 'warn',
		},
	},
	{
		// Agent tools only read or draft (DESIGN.md §9.1): their services come through the read-only facades of the tool
		// context, so they never import the API's services, repositories or Prisma (types are fine).
		files: ['apps/api/src/agent/tools/**/*.ts'],
		ignores: ['apps/api/src/agent/tools/**/*.spec.ts'],
		rules: {
			'@typescript-eslint/no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: ['../../*', '**/generated/prisma/**', '**/*.repository*', '@prisma/*'],
							allowTypeImports: true,
							message:
								'Agent tools never write: reach data through context.services (read-only facades), never a service, repository or Prisma.',
						},
					],
				},
			],
		},
	},
	{
		// Node scripts (brand/build.mjs, …).
		files: ['**/*.mjs'],
		languageOptions: {
			globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly' },
		},
	},
	{ ignores: ['**/dist/', '**/node_modules/', '**/src/generated/', 'apps/frontend/', '.claude/'] },
);
