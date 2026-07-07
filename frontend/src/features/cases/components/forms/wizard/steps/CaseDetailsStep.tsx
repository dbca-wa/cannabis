import Calendar22 from "@/shared/components/ui/calendar-22";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { ArrowRight, Info, Loader2 } from "lucide-react";
import { Link } from "react-router";
import { SectionCard } from "../SectionCard";
import { OcrCaseDetailsPanel } from "../../ocr/OcrCaseDetailsPanel";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import { useCaseNumberAvailability } from "../../../../hooks/useCaseNumberAvailability";

interface CaseDetailsStepProps {
	/** Server-authoritative case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Whether this step has been touched (controls validation error display) */
	isTouched: boolean;
	/** Callback to persist field changes via PATCH mutation (debounced by parent) */
	onFieldChange: (field: string, value: unknown) => void;
}

/**
 * Step 0 of the case creation wizard — base case details only.
 * Renders the police reference and received date. The security movement
 * envelope and drug bags now belong to a Priority 3 form and are captured when
 * a form is added, not here. When the entered reference already identifies a
 * case, a non-blocking notice offers to take the user to that case to add a
 * form (the shared base data already lives there), rather than showing an error.
 */
export const CaseDetailsStep = ({
	caseData,
	isTouched,
	onFieldChange,
}: CaseDetailsStepProps) => {
	// Derive field values from server data
	const caseNumber = (caseData?.case_number as string) ?? "";
	const received = (caseData?.received as string) ?? "";
	const approvedBotanist =
		(caseData?.approved_botanist_id as number | null) ?? null;
	const caseId = (caseData?.id as number | undefined) ?? null;

	// Debounced uniqueness check for the police reference number
	const { isChecking: isCheckingCaseNumber, matchedCase } =
		useCaseNumberAvailability(caseNumber, caseId);

	// Compute validation errors (only shown when isTouched)
	const errors = {
		case_number: !caseNumber.trim()
			? "Police reference number is required"
			: undefined,
		received: !received ? "Received date is required" : undefined,
		approved_botanist: !approvedBotanist
			? "Approved botanist is required"
			: undefined,
	};

	// The only hard error on this field is the required check; a match is not an
	// error but a redirect opportunity (shown as a notice below).
	const caseNumberError = isTouched ? errors.case_number : undefined;

	// Determine section completion state (base data only)
	const isCaseDetailsComplete =
		!!caseNumber.trim() && !!received && !!approvedBotanist;
	const isCaseDetailsInvalid =
		isTouched && (!caseNumber.trim() || !received || !approvedBotanist);

	return (
		<div className="space-y-6">
			{/* OCR upload + review (only when the OCR feature flag is enabled) */}
			<OcrCaseDetailsPanel />

			<SectionCard
				title="Case Details"
				isComplete={isCaseDetailsComplete}
				isInvalid={isCaseDetailsInvalid}
			>
				<div className="space-y-4">
					{/* Police Reference No. */}
					<div className="space-y-2">
						<Label htmlFor="case_number" className="required">
							Police Reference No.
						</Label>
						<div className="relative">
							<Input
								id="case_number"
								value={caseNumber}
								onChange={(e) => onFieldChange("case_number", e.target.value)}
								placeholder="Enter police reference number"
								aria-invalid={isTouched && !!errors.case_number}
								aria-describedby={
									caseNumberError ? "case_number-error" : undefined
								}
							/>
							{isCheckingCaseNumber && (
								<Loader2
									className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground"
									aria-label="Checking police reference number"
								/>
							)}
						</div>
						{caseNumberError && (
							<p
								id="case_number-error"
								className="text-sm text-red-600"
								role="alert"
								aria-live="polite"
							>
								{caseNumberError}
							</p>
						)}
						{matchedCase && (
							<div
								className="flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between"
								role="status"
								aria-live="polite"
							>
								<div className="flex items-start gap-2">
									<Info
										className="mt-0.5 h-4 w-4 shrink-0"
										aria-hidden="true"
									/>
									<span>
										A case with reference{" "}
										<span className="font-semibold">
											{matchedCase.case_number}
										</span>{" "}
										already exists. Add your Priority 3 form there — the shared
										details are already recorded, so nothing needs re-entering.
									</span>
								</div>
								<Button
									asChild
									variant="outline"
									size="sm"
									className="shrink-0 self-start sm:self-auto"
								>
									<Link to={`/cases/${matchedCase.id}`}>
										Add a form to this case
										<ArrowRight className="h-4 w-4" aria-hidden="true" />
									</Link>
								</Button>
							</div>
						)}
						<p className="text-xs text-muted-foreground">
							Police reference number for this case
						</p>
					</div>

					{/* Received Date */}
					<div className="space-y-2">
						<Label htmlFor="received" className="required">
							Received Date
						</Label>
						<Calendar22
							value={received}
							onChange={(date) => onFieldChange("received", date)}
							placeholder="Select received date"
							error={isTouched && !!errors.received}
							aria-invalid={isTouched && !!errors.received}
							aria-describedby={
								isTouched && errors.received ? "received-error" : undefined
							}
						/>
						{isTouched && errors.received && (
							<p
								id="received-error"
								className="text-sm text-red-600"
								role="alert"
							>
								{errors.received}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Date when the case was received (time defaults to 9:00 AM)
						</p>
					</div>

					{/* Approved Botanist */}
					<div className="space-y-2">
						<Label htmlFor="approved_botanist" className="required">
							Approved Botanist
						</Label>
						<UserSearchCombobox
							value={(caseData?.approved_botanist_id as number | null) ?? null}
							onValueChange={(id) => onFieldChange("approved_botanist_id", id)}
							placeholder="Select approved botanist..."
							roleFilter="botanist"
							lastUsedKey="botanist"
						/>
						{isTouched && errors.approved_botanist && (
							<p
								id="approved_botanist-error"
								className="text-sm text-red-600"
								role="alert"
							>
								{errors.approved_botanist}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							The botanist assigned to assess this case
						</p>
					</div>
				</div>
			</SectionCard>
		</div>
	);
};
