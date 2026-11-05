import { Module } from '@nestjs/common';

import { WiseToolsModule } from '../../wise-tools/wise-tools.module.js';
import { ClinicalDbModule } from '../rls/clinical-db.module.js';
import { WiseProposalRepository } from './wise-proposal.repository.js';
import { WiseProposalService } from './wise-proposal.service.js';
import { WiseProposalsResolver } from './wise-proposals.resolver.js';

/** Confirming and cancelling Wise proposal cards (DESIGN.md §7.1); the features' mutations call the service. */
@Module({
	imports: [ClinicalDbModule, WiseToolsModule],
	providers: [WiseProposalsResolver, WiseProposalService, WiseProposalRepository],
	exports: [WiseProposalService],
})
export class WiseProposalsModule {}
