import { Args, Mutation, Resolver } from '@nestjs/graphql';

import { Public } from '../common/decorators/public.decorator.js';
import { CompleteSetupInput } from './dto/complete-setup.input.js';
import { SetupService } from './setup.service.js';

@Resolver()
export class SetupResolver {
	constructor(private readonly setup: SetupService) {}

	@Public()
	@Mutation(() => Boolean, { description: 'Creates the first admin; needs the setup token from the server log.' })
	async completeSetup(@Args('input') input: CompleteSetupInput) {
		await this.setup.completeSetup(input);
		return true;
	}
}
