import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Loader2 } from "lucide-react";
import { useCaseCreationFormStore } from "@/app/providers/store.provider";
import { Button } from "@/shared/components/ui/button";
import { CaseDetailsStep } from "../wizard/steps/CaseDetailsStep";
import { DefendantsStep } from "../wizard/steps/DefendantsStep";
import { OfficersStep } from "../wizard/steps/OfficersStep";
import { useCaseNumberAvailability } from "@/features/cases/hooks/useCaseNumberAvailability";

interface CaseCreationFormProps {
	/** Case field values, bridged from the CaseFormStore */
	caseData: Record<string, unknown> | null;
	/** Callback to record a field change */
	onFieldChange: (field: string, value: unknown) => void;
	/** Callback to create the case */
	onSubmit: () => void;
	/** Callback to abandon the draft and leave */
	onDiscard: () => void;
}

/**
 * Single-page case creation form.
 *
 * Renders the case details, defendants and officers sections in one scrollable
 * layout with a single Create Case action. Creation captures base case data
 * only — the security movement envelope, drug bags and scanned image belong to
 * a Priority 3 form and are recorded once a form is added.
 */
export const CaseCreationForm = observer(
	({ caseData, onFieldChange, onSubmit, onDiscard }: CaseCreationFormProps) => {
		const store = useCaseCreationFormStore();
		const [touched, setTouched] = useState(false);

		const { isChecking, matchedCase } = useCaseNumberAvailability(
			(caseData?.case_number as string) ?? "",
			(caseData?.id as number | undefined) ?? null
		);

		const matchedCaseId = matchedCase?.id ?? null;
		useEffect(() => {
			store.setMatchedExistingCaseId(matchedCaseId);
		}, [store, matchedCaseId]);

		// Minimum required data before the case can be created. The requesting
		// officer is optional — only the conveying officer is required.
		const caseNumber = (caseData?.case_number as string) ?? "";
		const received = (caseData?.received as string) ?? "";
		const submittingOfficer = caseData?.submitting_officer_id;
		const requestingOfficer = caseData?.requesting_officer_id;
		const approvedBotanist = caseData?.approved_botanist_id;
		const defendants = (caseData?.defendants as number[]) ?? [];
		const hasDefendants =
			defendants.length > 0 || store.state.defendantUnknownAcknowledged;

		// A single officer must not fill both roles.
		const officersDistinct =
			!requestingOfficer || requestingOfficer !== submittingOfficer;

		const isValid =
			!!caseNumber.trim() &&
			!!received &&
			!!submittingOfficer &&
			officersDistinct &&
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
						variant="outline"
						onClick={onDiscard}
						disabled={store.state.isSubmitting}
					>
						Cancel
					</Button>
					<Button
						onClick={() => {
							setTouched(true);
							if (isValid) onSubmit();
						}}
						disabled={!isValid || store.state.isSubmitting}
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
