import { Query, Resolver } from '@nestjs/graphql';

import { ProjectAdmin } from '../common/decorators/access.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { PublicConfig } from './models/public-config.model.js';
import { AppVersion, UpdateCheck } from './models/version.model.js';
import { SystemService } from './system.service.js';
import { VersionCheckService } from './version-check.service.js';

@Resolver()
export class SystemResolver {
	constructor(
		private readonly system: SystemService,
		private readonly versionCheck: VersionCheckService,
	) {}

	@Public()
	@Query(() => PublicConfig)
	publicConfig(): Promise<PublicConfig> {
		return this.system.getPublicConfig();
	}

	@ProjectAdmin()
	@Query(() => AppVersion)
	version(): AppVersion {
		return this.system.getVersion();
	}

	@ProjectAdmin()
	@Query(() => UpdateCheck)
	checkUpdate(): Promise<UpdateCheck> {
		return this.versionCheck.checkForUpdate();
	}
}
