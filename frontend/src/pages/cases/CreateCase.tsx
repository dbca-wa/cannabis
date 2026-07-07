import { observer } from "mobx-react-lite";
import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { useCaseCreationWizardStore } from "@/app/providers/store.provider";
import { CaseStoresProvider } from "@/features/cases/components/providers/CaseStoresProvider";
import { useCaseFormStore } from "@/features/cases/hooks/useCaseFormStore";
import { useCases } from "@/features/cases/hooks/useCases";
import { CaseCreationWizardContainer } from "@/features/cases/components/forms/wizard/CaseCreationWizardContainer";
import { ocrResultStore } from "@/features/cases/stores/ocrResult.store";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import type { DefendantTiny } from "@/shared/types/backend-api.types";

/**
 * Bridges the CaseFormStore base data into the Record<string, unknown> shape
 * the creation wizard expects as caseData. Creation captures base data only —
 * the security movement envelope, drug bags, and scanned image belong to a
 * Priority 3 form and are recorded when a form is added.
 */
const buildCaseData = (
	formStore: ReturnType<typeof useCaseFormStore>
): Record<string, unknown> => ({
	case_number: formStore.formData.case_number,
	received: formStore.formData.received,
	requesting_officer: formStore.formData.requesting_officer_id,
	submitting_officer: formStore.formData.submitting_officer_id,
	station: formStore.formData.station_id,
	defendants: formStore.formData.defendant_ids,
	defendants_details: formStore.selectedDefendants,
	requesting_officer_id: formStore.formData.requesting_officer_id ?? null,
	submitting_officer_id: formStore.formData.submitting_officer_id ?? null,
	station_id: formStore.formData.station_id ?? null,
	approved_botanist_id: formStore.formData.approved_botanist_id ?? null,
	requesting_officer_name:
		formStore.selectedOfficers.requesting?.full_name ?? null,
	submitting_officer_name:
		formStore.selectedOfficers.submitting?.full_name ?? null,
	approved_botanist_name: formStore.selectedBotanist?.full_name ?? null,
	station_name: formStore.selectedStation?.name ?? null,
});

const CreateCaseContent = observer(() => {
	const navigate = useNavigate();
	const formStore = useCaseFormStore();
	const wizardStore = useCaseCreationWizardStore();
	const { createCase } = useCases();

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
	 * Submit handler — creates the case (base data only) via mutation, then
	 * continues straight into the add-form flow so the operator records the
	 * first Priority 3 form, its bags, and its certificate on the new case.
	 */
	const handleSubmit = useCallback(() => {
		wizardStore.setSubmitting(true);
		const submissionData = formStore.getCaseCreateRequest();

		createCase(submissionData, {
			onSuccess: (newCase) => {
				wizardStore.setSubmitting(false);
				// Navigate first, then clean up — prevents a brief red flash.
				navigate(`/cases/${newCase.id}`);
				void formStore.clearDraft();
				formStore.resetForm();
				ocrResultStore.clearAll();
			},
			onError: () => {
				wizardStore.setSubmitting(false);
			},
		});
	}, [formStore, wizardStore, createCase, navigate]);

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
