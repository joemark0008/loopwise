import type { ApiInputs, ApiOutputs } from '@/lib/api-types';

import {
	CreateSkillDocument,
	DeleteSkillDocument,
	SkillCatalogDocument,
	SkillDetailDocument,
	SkillLoadErrorsDocument,
	SkillSaveStatusDocument,
	SkillsDocument,
	UpdateSkillDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

type Inputs = ApiInputs['skill'];
type Outputs = ApiOutputs['skill'];

/** Clinic skills moved to apps/api (`lib/apollo-procedures.ts`): call sites swap upstream tRPC's `skill` for this. */
export const skillApi = {
	skill: {
		list: query<void, Outputs['list']>(['skill', 'list'], async () => (await runQuery(SkillsDocument, {})).skills),
		catalog: query<void, Outputs['catalog']>(
			['skill', 'catalog'],
			async () => (await runQuery(SkillCatalogDocument, {})).skillCatalog,
		),
		listLoadErrors: query<void, Outputs['listLoadErrors']>(
			['skill', 'listLoadErrors'],
			async () => (await runQuery(SkillLoadErrorsDocument, {})).skillLoadErrors,
		),
		saveStatus: query<void, Outputs['saveStatus']>(
			['skill', 'saveStatus'],
			async () => (await runQuery(SkillSaveStatusDocument, {})).skillSaveStatus,
		),
		detail: query<Inputs['detail'], Outputs['detail']>(
			['skill', 'detail'],
			async (input) => (await runQuery(SkillDetailDocument, input)).skillDetail,
		),
		create: mutation<Inputs['create'], Outputs['create']>(
			['skill', 'create'],
			async (input) => (await runMutation(CreateSkillDocument, { input })).createSkill,
		),
		update: mutation<Inputs['update'], Outputs['update']>(
			['skill', 'update'],
			async (input) => (await runMutation(UpdateSkillDocument, { input })).updateSkill,
		),
		delete: mutation<Inputs['delete'], void>(['skill', 'delete'], async (input) => {
			await runMutation(DeleteSkillDocument, { input });
		}),
	},
};
