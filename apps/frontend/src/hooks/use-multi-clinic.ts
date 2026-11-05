export type ClinicSwitcherMode = 'switch' | 'static';

/** loopwise lets self-hosted users create several clinics (upstream only switches clinics in cloud mode). */
export function useMultiClinic(): ClinicSwitcherMode {
	return 'switch';
}
