import { CaseDetailsStep } from "./steps/CaseDetailsStep";
import { OfficersStep } from "./steps/OfficersStep";
import { AssessmentStep } from "./steps/AssessmentStep";

interface WizardFormPanelProps {
	/** Zero-indexed active step (0 = Case Details, 1 = Officers, 2 = Assessment) */
	currentStep: number;
	/** Case data from TanStack Query — passed down to each step component */
	caseData: Record<string, unknown> | null;
	/** Whether the current step has been touched (controls validation error display) */
	isTouched?: boolean;
	/** Callback to persist field changes via mutation */
	onFieldChange?: (field: string, value: unknown) => void;
}

/** No-op fallback when onFieldChange is not yet wired */
const noop = () => {};

/**
 * Step content router — renders the appropriate step form based on currentStep.
 * Each step receives the full case data object for rendering and mutation.
 */
export const WizardFormPanel = ({
	currentStep,
	caseData,
	isTouched = false,
	onFieldChange = noop,
}: WizardFormPanelProps) => {
	switch (currentStep) {
		case 0:
			return (
				<CaseDetailsStep
					caseData={caseData}
					isTouched={isTouched}
					onFieldChange={onFieldChange}
				/>
			);
		case 1:
			return (
				<OfficersStep
					caseData={caseData}
					isTouched={isTouched}
					onFieldChange={onFieldChange}
				/>
			);
		case 2:
			return (
				<AssessmentStep
					caseData={caseData}
					caseId={(caseData?.id as number) ?? 0}
					isTouched={isTouched}
					onFieldChange={onFieldChange}
				/>
			);
		default:
			return null;
	}
};
