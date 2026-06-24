import { observer } from "mobx-react-lite";
import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useCaseCreationWizardStore } from "@/app/providers/store.provider";
import { CaseStoresProvider } from "@/features/cases/components/providers/CaseStoresProvider";
import { useCaseFormStore } from "@/features/cases/hooks/useCaseFormStore";
import { useCases } from "@/features/cases/hooks/useCases";
import { CaseCreationWizardContainer } from "@/features/cases/components/forms/wizard/CaseCreationWizardContainer";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import type { DefendantTiny } from "@/shared/types/backend-api.types";

/**
 * Bridges the existing CaseFormStore data into the Record<string, unknown>
 * shape that WizardContainer expects as caseData.
 */
const buildCaseData = (
	formStore: ReturnType<typeof useCaseFormStore>
): Record<string, unknown> => ({
	case_number: formStore.formData.case_number,
	received: formStore.formData.received,
	security_movement_envelope: formStore.formData.security_movement_envelope,
	requesting_officer: formStore.formData.requesting_officer_id,
	submitting_officer: formStore.formData.submitting_officer_id,
	station: formStore.formData.station_id,
	bags: formStore.formData.bags,
	defendants: formStore.formData.defendant_ids,
	defendants_details: formStore.selectedDefendants,
	requesting_officer_id: formStore.formData.requesting_officer_id ?? null,
	submitting_officer_id: formStore.formData.submitting_officer_id ?? null,
	station_id: formStore.formData.station_id ?? null,
	requesting_officer_name:
		formStore.selectedOfficers.requesting?.full_name ?? null,
	submitting_officer_name:
		formStore.selectedOfficers.submitting?.full_name ?? null,
	approved_botanist_name: formStore.selectedBotanist?.full_name ?? null,
	station_name: formStore.selectedStation?.name ?? null,
	other_matters: formStore.getAutoPopulatedAdditionalNotes() || null,
	certificate_number: null,
	certification_date: null,
});

const CreateCaseContent = observer(() => {
	const navigate = useNavigate();
	const formStore = useCaseFormStore();
	const wizardStore = useCaseCreationWizardStore();
	const { createCase, executeWorkflowAction } = useCases();

	useEffect(() => {
		formStore.resetForm();
		void formStore.loadDraft();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Reset the wizard store on unmount
	useEffect(() => {
		return () => {
			wizardStore.reset();
		};
	}, [wizardStore]);

	const caseData = buildCaseData(formStore);

	/**
	 * Field change handler — updates the CaseFormStore field.
	 * Maps field names from wizard components to the store's internal field names.
	 */
	const handleFieldChange = useCallback(
		(field: string, value: unknown) => {
			// Map wizard field names to store field names where they differ
			if (field === "defendants") {
				// CaseDetailsStep passes defendant IDs; sync both IDs and display list.
				// Filter selectedDefendants to match the new ID list (handles removals),
				// and for new additions the combobox selection triggers a separate path.
				const newIds = value as number[];
				const updatedDefendants = formStore.selectedDefendants.filter((d) =>
					newIds.includes(d.id)
				);
				formStore.setSelectedDefendants(updatedDefendants);
				return;
			}

			if (field === "add_defendant") {
				// Full defendant object provided (from create modal or combobox selection)
				const defendant = value as DefendantTiny;
				if (!formStore.formData.defendant_ids.includes(defendant.id)) {
					formStore.setSelectedDefendants([
						...formStore.selectedDefendants,
						defendant,
					]);
				}
				return;
			}

			formStore.updateField(
				field as keyof typeof formStore.formData,
				value as never
			);
		},
		[formStore]
	);

	/**
	 * Submit handler — creates the case via mutation, then navigates to process wizard.
	 * On network error after successful creation, shows a toast with a manual link.
	 */
	const handleSubmit = useCallback(() => {
		wizardStore.setSubmitting(true);
		const submissionData = formStore.getCaseCreateRequest();

		createCase(submissionData, {
			onSuccess: (newCase) => {
				wizardStore.setSubmitting(false);
				// Advance phase from case_creation to assessment immediately
				executeWorkflowAction({
					id: newCase.id,
					action: { action: "advance_phase" },
				});
				// Navigate first, then clean up — prevents brief red flash
				navigate(`/cases/${newCase.id}/process`);
				void formStore.clearDraft();
				formStore.resetForm();
			},
			onError: () => {
				wizardStore.setSubmitting(false);
			},
		});
	}, [formStore, wizardStore, createCase, executeWorkflowAction, navigate]);

	/**
	 * Discard handler — clears draft and navigates to cases list.
	 */
	const handleDiscard = useCallback(() => {
		void formStore.clearDraft();
		formStore.resetForm();
		navigate("/cases");
	}, [formStore, navigate]);

	return (
		<CaseCreationWizardContainer
			caseData={caseData}
			onFieldChange={handleFieldChange}
			onSubmit={handleSubmit}
			onDiscard={handleDiscard}
		/>
	);
});

export const CreateCase = () => {
	useDocumentTitle("New Case");

	return (
		<CaseStoresProvider>
			<CreateCaseContent />
		</CaseStoresProvider>
	);
};
