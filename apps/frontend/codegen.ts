import type { CodegenConfig } from '@graphql-codegen/cli';

/**
 * Typed documents for Apollo Client, from the schema apps/api emits (`autoSchemaFile`).
 * Documents live next to their feature in `src/graphql/<feature>.graphql`.
 */
const config: CodegenConfig = {
	schema: '../api/schema.gql',
	documents: ['src/graphql/**/*.graphql'],
	ignoreNoDocuments: false,
	generates: {
		'src/graphql/generated/': {
			preset: 'client',
			presetConfig: { fragmentMasking: false },
			config: {
				useTypeImports: true,
				enumsAsTypes: true,
				scalars: { DateTime: 'string' },
			},
		},
	},
};

export default config;
