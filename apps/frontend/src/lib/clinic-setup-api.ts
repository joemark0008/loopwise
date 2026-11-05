import type {
	AddPractitionerLeaveInput,
	CityMunicipalitiesQuery,
	ClinicPractitionerFieldsFragment,
	ClinicSetupProfileFieldsFragment,
	DocumentSequenceSettingFieldsFragment,
	ExpiringCredentialsQuery,
	ManagedUserFieldsFragment,
	PractitionerScheduleInput,
	PractitionerUserOptionsQuery,
	SavePractitionerInput,
	SaveServiceItemInput,
	ServiceCatalogItemFieldsFragment,
	ServiceLinkOptionsQuery,
	SetClinicServicePriceInput,
	SetDocumentSequenceInput,
	SetPractitionerClinicInput,
	SetupBarangaysQuery,
	SetupPractitionerFieldsFragment,
	StaffRole,
	UpdateClinicProfileInput,
	UpdateOrganizationProfileInput,
} from '@/graphql/generated/graphql';

import {
	AddPractitionerLeaveDocument,
	CityMunicipalitiesDocument,
	ClinicPractitionerSetupDocument,
	ClinicProfileDocument,
	DocumentSequencesDocument,
	ExpiringCredentialsDocument,
	ManagedUsersDocument,
	PractitionerUserOptionsDocument,
	RemoveClinicServicePriceDocument,
	RemovePractitionerLeaveDocument,
	RemovePractitionerScheduleDocument,
	SavePractitionerDocument,
	SavePractitionerScheduleDocument,
	SaveServiceItemDocument,
	ServiceCatalogDocument,
	ServiceLinkOptionsDocument,
	SetClinicServicePriceDocument,
	SetDocumentSequenceDocument,
	SetPractitionerClinicDocument,
	SetupBarangaysDocument,
	SetUserStaffRolesDocument,
	UpdateClinicProfileDocument,
	UpdateOrganizationProfileDocument,
} from '@/graphql/generated/graphql';
import { mutation, query, runMutation, runQuery } from '@/lib/apollo-procedures';

export type ClinicSetupProfile = ClinicSetupProfileFieldsFragment;
export type ClinicPractitioner = ClinicPractitionerFieldsFragment;
export type SetupPractitioner = SetupPractitionerFieldsFragment;
export type ServiceCatalogItem = ServiceCatalogItemFieldsFragment;
export type DocumentSequenceSetting = DocumentSequenceSettingFieldsFragment;
export type ExpiringCredential = ExpiringCredentialsQuery['expiringCredentials'][number];
export type CityMunicipality = CityMunicipalitiesQuery['cityMunicipalities'][number];
export type ServiceLinkOptions = ServiceLinkOptionsQuery['serviceLinkOptions'];
export type PractitionerUserOption = PractitionerUserOptionsQuery['practitionerUserOptions'][number];

type Empty = Record<string, never>;

/**
 * Settings → Clinic (clinic setup, `apps/api/src/clinical/clinics`, `practitioners/setup`, `billing/service-items`):
 * the selected clinic's profile, numbering, practitioners, services and prices, and expiring licenses. Admins only.
 */
export const clinicSetupApi = {
	profile: query<Empty, ClinicSetupProfile>(
		['clinicSetup', 'profile'],
		async () => (await runQuery(ClinicProfileDocument, {})).clinicProfile,
	),
	updateOrganization: mutation<UpdateOrganizationProfileInput, ClinicSetupProfile>(
		['clinicSetup', 'updateOrganization'],
		async (input) => (await runMutation(UpdateOrganizationProfileDocument, { input })).updateOrganizationProfile,
	),
	updateClinic: mutation<UpdateClinicProfileInput, ClinicSetupProfile>(
		['clinicSetup', 'updateClinic'],
		async (input) => (await runMutation(UpdateClinicProfileDocument, { input })).updateClinicProfile,
	),
	cityMunicipalities: query<{ query: string }, CityMunicipality[]>(
		['clinicSetup', 'cityMunicipalities'],
		async (variables) => (await runQuery(CityMunicipalitiesDocument, variables)).cityMunicipalities,
	),
	barangays: query<{ cityMunicipalityCode: string }, SetupBarangaysQuery['barangays']>(
		['clinicSetup', 'barangays'],
		async (variables) => (await runQuery(SetupBarangaysDocument, variables)).barangays,
	),

	sequences: query<Empty, DocumentSequenceSetting[]>(
		['clinicSetup', 'sequences'],
		async () => (await runQuery(DocumentSequencesDocument, {})).documentSequences,
	),
	setSequence: mutation<SetDocumentSequenceInput, DocumentSequenceSetting>(
		['clinicSetup', 'setSequence'],
		async (input) => (await runMutation(SetDocumentSequenceDocument, { input })).setDocumentSequence,
	),

	practitioners: query<Empty, ClinicPractitioner[]>(
		['clinicSetup', 'practitioners'],
		async () => (await runQuery(ClinicPractitionerSetupDocument, {})).clinicPractitionerSetup,
	),
	practitionerUserOptions: query<Empty, PractitionerUserOption[]>(
		['clinicSetup', 'practitionerUserOptions'],
		async () => (await runQuery(PractitionerUserOptionsDocument, {})).practitionerUserOptions,
	),
	savePractitioner: mutation<SavePractitionerInput, SetupPractitioner>(
		['clinicSetup', 'savePractitioner'],
		async (input) => (await runMutation(SavePractitionerDocument, { input })).savePractitioner,
	),
	setPractitionerClinic: mutation<SetPractitionerClinicInput, ClinicPractitioner>(
		['clinicSetup', 'setPractitionerClinic'],
		async (input) => (await runMutation(SetPractitionerClinicDocument, { input })).setPractitionerClinic,
	),
	saveSchedule: mutation<PractitionerScheduleInput, { id: string }>(
		['clinicSetup', 'saveSchedule'],
		async (input) => (await runMutation(SavePractitionerScheduleDocument, { input })).savePractitionerSchedule,
	),
	removeSchedule: mutation<{ id: string }, boolean>(
		['clinicSetup', 'removeSchedule'],
		async (variables) =>
			(await runMutation(RemovePractitionerScheduleDocument, variables)).removePractitionerSchedule,
	),
	addLeave: mutation<AddPractitionerLeaveInput, { id: string }>(
		['clinicSetup', 'addLeave'],
		async (input) => (await runMutation(AddPractitionerLeaveDocument, { input })).addPractitionerLeave,
	),
	removeLeave: mutation<{ id: string }, boolean>(
		['clinicSetup', 'removeLeave'],
		async (variables) => (await runMutation(RemovePractitionerLeaveDocument, variables)).removePractitionerLeave,
	),

	services: query<{ includeInactive: boolean }, ServiceCatalogItem[]>(
		['clinicSetup', 'services'],
		async (variables) => (await runQuery(ServiceCatalogDocument, variables)).serviceCatalog,
	),
	serviceLinkOptions: query<Empty, ServiceLinkOptions>(
		['clinicSetup', 'serviceLinkOptions'],
		async () => (await runQuery(ServiceLinkOptionsDocument, {})).serviceLinkOptions,
	),
	saveService: mutation<SaveServiceItemInput, ServiceCatalogItem>(
		['clinicSetup', 'saveService'],
		async (input) => (await runMutation(SaveServiceItemDocument, { input })).saveServiceItem,
	),
	setClinicPrice: mutation<SetClinicServicePriceInput, ServiceCatalogItem>(
		['clinicSetup', 'setClinicPrice'],
		async (input) => (await runMutation(SetClinicServicePriceDocument, { input })).setClinicServicePrice,
	),
	removeClinicPrice: mutation<{ serviceItemId: string }, ServiceCatalogItem>(
		['clinicSetup', 'removeClinicPrice'],
		async (variables) => (await runMutation(RemoveClinicServicePriceDocument, variables)).removeClinicServicePrice,
	),

	/** The organization's users with their roles at the selected clinic (user management; organization admins). */
	staff: query<Empty, ManagedUserFieldsFragment[]>(
		['clinicSetup', 'staff'],
		async () => (await runQuery(ManagedUsersDocument, {})).managedUsers,
	),
	setStaffRoles: mutation<{ userId: string; staffRoles: StaffRole[] }, ManagedUserFieldsFragment>(
		['clinicSetup', 'setStaffRoles'],
		async (input) => (await runMutation(SetUserStaffRolesDocument, { input })).setUserStaffRoles,
	),

	expiries: query<{ withinDays: number }, ExpiringCredential[]>(
		['clinicSetup', 'expiries'],
		async (variables) => (await runQuery(ExpiringCredentialsDocument, variables)).expiringCredentials,
	),
};
