import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType({ description: 'Source of a clinic chart plugin (upstream `chartPlugin.source`).' })
export class ChartPluginSource {
	@Field()
	source: string;

	@Field()
	version: string;
}
