import 'reflect-metadata';

import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { type DynamicModule, type Type, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE, ModuleRef } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import request from 'supertest';

import { configureApp } from '../src/app.setup.js';
import { AuthModule } from '../src/auth/auth.module.js';
import { EncountersModule } from '../src/clinical/encounters/encounters.module.js';
import { PatientsModule } from '../src/clinical/patients/patients.module.js';
import { PractitionersModule } from '../src/clinical/practitioners/practitioners.module.js';
import { ReferenceModule } from '../src/clinical/reference/reference.module.js';
import { WiseProposalsModule } from '../src/clinical/wise-proposals/wise-proposals.module.js';
import { RequestLoaders } from '../src/common/dataloader/request-loaders.js';
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter.js';
import type { GraphQLContext } from '../src/common/graphql-context.js';
import { GuardsModule } from '../src/common/guards/guards.module.js';
import type { LoopwiseRequest } from '../src/common/request.js';
import { ConfigModule } from '../src/config/config.module.js';
import { PrismaModule } from '../src/prisma/prisma.module.js';

export { resetDatabase, useTestDatabase } from './test-db.js';

/** The clinical core: patients, practitioners, encounters and their record, ICD-10 / PSGC, Wise cards. */
export const CLINICAL_CORE_MODULES: Type[] = [
	ReferenceModule,
	PractitionersModule,
	PatientsModule,
	EncountersModule,
	WiseProposalsModule,
];

/**
 * A Nest app with GraphQL, sign-in and the guards, and only the given feature modules (default: the clinical core),
 * for e2e tests of one area that must not depend on every module of the app loading. The schema stays in memory
 * unless `schemaFile` is given.
 */
export async function createClinicalTestApp(
	modules: (Type | DynamicModule)[] = CLINICAL_CORE_MODULES,
	options: { schemaFile?: string } = {},
): Promise<NestExpressApplication> {
	const moduleRef = await Test.createTestingModule({
		imports: [
			ConfigModule,
			PrismaModule,
			GraphQLModule.forRootAsync<ApolloDriverConfig>({
				driver: ApolloDriver,
				inject: [ModuleRef],
				useFactory: (ref: ModuleRef) => ({
					autoSchemaFile: options.schemaFile ?? true,
					sortSchema: true,
					path: '/graphql',
					playground: false,
					context: ({ req, res }: { req: LoopwiseRequest; res: Response }): GraphQLContext => ({
						req,
						res,
						loaders: new RequestLoaders(ref),
					}),
				}),
			}),
			AuthModule,
			GuardsModule,
			...modules,
		],
		providers: [
			{ provide: APP_FILTER, useClass: AllExceptionsFilter },
			{ provide: APP_PIPE, useValue: new ValidationPipe({ transform: true, forbidUnknownValues: false }) },
		],
	}).compile();
	const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: ['error'] });
	configureApp(app);
	await app.init();
	return app;
}

/** Signs in through the real better-auth endpoint and returns the session cookie. */
export async function signIn(
	app: NestExpressApplication,
	{ email, password }: { email: string; password: string },
): Promise<string[]> {
	const res = await request(app.getHttpServer())
		.post('/api/auth/sign-in/email')
		.set('Origin', 'http://localhost:3000')
		.send({ email, password })
		.expect(200);
	return [res.headers['set-cookie']].flat().filter(Boolean) as string[];
}

/** A GraphQL call as the signed-in user of `cookie`. */
export function graphql(
	app: NestExpressApplication,
	cookie: string[],
	query: string,
	variables: Record<string, unknown> = {},
) {
	return request(app.getHttpServer()).post('/graphql').set('Cookie', cookie).send({ query, variables });
}
