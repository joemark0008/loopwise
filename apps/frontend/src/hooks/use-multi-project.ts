export type ProjectSwitcherMode = 'switch' | 'static';

/** quarry lets self-hosted users create several projects (upstream only switches projects in cloud mode). */
export function useMultiProject(): ProjectSwitcherMode {
	return 'switch';
}
