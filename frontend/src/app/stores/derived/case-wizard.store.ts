/**
 * Backward-compatibility re-export.
 * The CaseWizardStore has been refactored into CaseProcessingWizardStore.
 * Import from case-processing-wizard.store.ts directly for new code.
 */
export {
	CaseProcessingWizardStore as CaseWizardStore,
	CASE_PROCESSING_STEPS as CASE_WIZARD_STEPS,
	TOTAL_STEPS,
	type StepState,
	type CaseProcessingWizardStoreState as CaseWizardStoreState,
	type CaseProcessingStep,
} from "./case-processing-wizard.store";
