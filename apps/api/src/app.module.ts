import path from 'node:path';

import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE, ModuleRef } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import type { Response } from 'express';

import { AgentModule } from './agent/agent.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ChartsModule } from './charts/charts.module.js';
import { ChatsModule } from './chats/chats.module.js';
import { BillingModule } from './clinical/billing/billing.module.js';
import { CliniciansModule } from './clinical/clinicians/clinicians.module.js';
import { EncountersModule } from './clinical/encounters/encounters.module.js';
import { ClinicalEventsModule } from './clinical/events/clinical-events.module.js';
import { InsightsModule } from './clinical/insights/insights.module.js';
import { MedicalCertificatesModule } from './clinical/medical-certificates/medical-certificates.module.js';
import { OrdersModule } from './clinical/orders/orders.module.js';
import { PathwaysModule } from './clinical/pathways/pathways.module.js';
import { PatientsModule } from './clinical/patients/patients.module.js';
import { PrescriptionsModule } from './clinical/prescriptions/prescriptions.module.js';
import { ResultsModule } from './clinical/results/results.module.js';
import { ClinicalDbModule } from './clinical/rls/clinical-db.module.js';
import { WiseProposalsModule } from './clinical/wise-proposals/wise-proposals.module.js';
import { ClinicsModule } from './clinics/clinics.module.js';
import { RequestLoaders } from './common/dataloader/request-loaders.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import type { GraphQLContext } from './common/graphql-context.js';
import { GuardsModule } from './common/guards/guards.module.js';
import type { LoopwiseRequest } from './common/request.js';
import { ConfigModule } from './config/config.module.js';
import { ConfigService } from './config/config.service.js';
import { FacilityKeysModule } from './facility-keys/facility-keys.module.js';
import { HealthModule } from './health/health.module.js';
import { Hl7Module } from './hl7/hl7.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { MemoryModule } from './memory/memory.module.js';
import { ModelSettingsModule } from './model-settings/model-settings.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SetupModule } from './setup/setup.module.js';
import { SkillsModule } from './skills/skills.module.js';
import { SystemModule } from './system/system.module.js';
import { TranscribeModule } from './transcribe/transcribe.module.js';
import { UsageModule } from './usage/usage.module.js';
import { UserManagementModule } from './user-management/user-management.module.js';
import { UsersModule } from './users/users.module.js';
import { WiseToolsModule } from './wise-tools/wise-tools.module.js';

/** Emitted by the code-first schema; the frontend's GraphQL Code Generator reads it. */
export const SCHEMA_FILE = path.join(import.meta.dirname, '..', 'schema.gql');

@Module({
	imports: [
		ConfigModule,
		PrismaModule,
		GraphQLModule.forRootAsync<ApolloDriverConfig>({
			driver: ApolloDriver,
			inject: [ConfigService, ModuleRef],
			useFactory: (config: ConfigService, moduleRef: ModuleRef) => ({
				autoSchemaFile: SCHEMA_FILE,
				sortSchema: true,
				path: '/graphql',
				playground: false,
				graphiql: config.isDev,
				introspection: config.env.MODE !== 'prod',
				includeStacktraceInErrorResponses: config.isDev,
				context: ({ req, res }: { req: LoopwiseRequest; res: Response }): GraphQLContext => ({
					req,
					res,
					loaders: new RequestLoaders(moduleRef),
				}),
			}),
		}),
		AuthModule,
		GuardsModule,
		JobsModule,
		HealthModule,
		FacilityKeysModule,
		UsersModule,
		UsageModule,
		UserManagementModule,
		SystemModule,
		ClinicsModule,
		AgentModule,
		AttachmentsModule,
		ChatsModule,
		ChartsModule,
		ModelSettingsModule,
		TranscribeModule,
		ClinicalDbModule,
		PatientsModule,
		InsightsModule,
		EncountersModule,
		CliniciansModule,
		OrdersModule,
		PathwaysModule,
		ClinicalEventsModule,
		ResultsModule,
		Hl7Module,
		PrescriptionsModule,
		MedicalCertificatesModule,
		WiseProposalsModule,
		BillingModule,
		SkillsModule,
		MemoryModule,
		SetupModule,
		WiseToolsModule,
	],
	providers: [
		{ provide: APP_FILTER, useClass: AllExceptionsFilter },
		{ provide: APP_PIPE, useValue: new ValidationPipe({ transform: true, forbidUnknownValues: false }) },
	],
})
export class AppModule {}
