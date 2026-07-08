import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Loader2 } from "lucide-react";
import { useCaseCreationWizardStore } from "@/app/providers/store.provider";
import { Button } from "@/shared/components/ui/button";
import { CaseDetailsStep } from "./steps/CaseDetailsStep";
import { DefendantsStep } from "./steps/DefendantsStep";
import { OfficersStep } from "./steps/OfficersStep";
import { useCaseNumberAvailability } from "@/features/cases/hooks/useCaseNumberAvailability";

interface CaseCreationWizardContainerProps {
	/** Case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Callback to persist field changes via mutation */
	onFieldChange: (field: string, value: unknown) => void;
	/** Callback to finalise and submit the case */
	onSubmit: () => void;
	/** Callback to discard the draft case (kept for API compat) */
	onDiscard?: () => void;
}

/**
 * Single-page case creation form. Renders all sections (Case Details,
 * Defendants, Officers) in a scrollable layout with one "Create Case" action.
 */
export const CaseCreationWizardContainer = observer(
	({ caseData, onFieldChange, onSubmit }: CaseCreationWizardContainerProps) => {
		const store = useCaseCreationWizardStore();
		const [touched, setTouched] = useState(false);

		const { isChecking, matchedCase } = useCaseNumberAvailability(
			(caseData?.case_number as string) ?? "",
			(caseData?.id as number | undefined) ?? null
		);

		const matchedCaseId = matchedCase?.id ?? null;
		useEffect(() => {
			store.setMatchedExistingCaseId(matchedCaseId);
		}, [store, matchedCaseId]);

		// Validation — minimum required fields before submission
		const caseNumber = (caseData?.case_number as string) ?? "";
		const received = (caseData?.received as string) ?? "";
		const submittingOfficer = caseData?.submitting_officer_id;
		const approvedBotanist = caseData?.approved_botanist_id;
		const defendants = (caseData?.defendants as number[]) ?? [];
		const hasDefendants =
			defendants.length > 0 || store.state.defendantUnknownAcknowledged;
		const isValid =
			!!caseNumber.trim() &&
			!!received &&
			!!submittingOfficer &&
			!!approvedBotanist &&
			hasDefendants &&
			!store.hasMatchedExistingCase &&
			!isChecking;

		return (
			<div className="flex flex-col gap-6 h-full">
				<h1 className="text-2xl font-bold tracking-tight">Create Case</h1>

				<div className="flex-1 min-h-0 overflow-y-auto space-y-6">
					<CaseDetailsStep
						caseData={caseData}
						isTouched={touched}
						onFieldChange={onFieldChange}
					/>
					<DefendantsStep
						caseData={caseData}
						isTouched={touched}
						onFieldChange={onFieldChange}
						defendantUnknown={store.state.defendantUnknownAcknowledged}
						onDefendantUnknownChange={store.setDefendantUnknownAcknowledged}
					/>
					<OfficersStep
						caseData={caseData}
						isTouched={touched}
						onFieldChange={onFieldChange}
					/>
				</div>

				<div className="flex items-center justify-end gap-3">
					<Button
						onClick={() => {
							setTouched(true);
							if (isValid) onSubmit();
						}}
						disabled={store.state.isSubmitting}
						className="bg-cannabis-green-dark hover:bg-cannabis-green-dark/90"
					>
						{store.state.isSubmitting ? (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						) : null}
						{store.state.isSubmitting ? "Creating..." : "Create Case"}
					</Button>
				</div>
			</div>
		);
	}
);
