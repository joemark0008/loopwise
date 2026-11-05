import { Module } from '@nestjs/common';

import { ClinicsCoreModule } from '../clinics/clinics-core.module.js';
import { SkillService } from './skill.service.js';
import { SkillAuthoringService } from './skill-authoring.service.js';
import { SkillsResolver } from './skills.resolver.js';

/** Clinic skills (upstream `skill`): the list API and the service the agent loads skills with. */
@Module({
	imports: [ClinicsCoreModule],
	providers: [SkillService, SkillAuthoringService, SkillsResolver],
	exports: [SkillService],
})
export class SkillsModule {}
