import Calendar22 from "@/shared/components/ui/calendar-22";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/utils";
import { SectionCard } from "../SectionCard";
import { OcrCaseDetailsPanel } from "../../ocr/OcrCaseDetailsPanel";
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
 * Step 0 of the case creation wizard — case details only.
 * Renders case_number, received date, and security_movement_envelope.
 * Defendants have their own dedicated step (DefendantsStep).
 */
export const CaseDetailsStep = ({
	caseData,
	isTouched,
	onFieldChange,
}: CaseDetailsStepProps) => {
	// Derive field values from server data
	const caseNumber = (caseData?.case_number as string) ?? "";
	const received = (caseData?.received as string) ?? "";
	const securityEnvelope =
		(caseData?.security_movement_envelope as string) ?? "";
	const caseId = (caseData?.id as number | undefined) ?? null;

	// Debounced uniqueness check for the police reference number
	const { isChecking: isCheckingCaseNumber, alreadyExists: caseNumberTaken } =
		useCaseNumberAvailability(caseNumber, caseId);

	// Compute validation errors (only shown when isTouched)
	const errors = {
		case_number: !caseNumber.trim()
			? "Police reference number is required"
			: undefined,
		received: !received ? "Received date is required" : undefined,
	};

	// Duplicate error surfaces immediately (not gated behind touched)
	const caseNumberError =
		(isTouched && errors.case_number) ||
		(caseNumberTaken
			? "This police reference number already exists on another case"
			: undefined);

	// Determine section completion state
	const isCaseDetailsComplete =
		!!caseNumber.trim() && !!received && !!securityEnvelope.trim();
	const isCaseDetailsInvalid = isTouched && (!caseNumber.trim() || !received);

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
								className={cn(
									caseNumberTaken && "border-red-500 focus-visible:ring-red-500"
								)}
								aria-invalid={
									(isTouched && !!errors.case_number) || caseNumberTaken
								}
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

					{/* Security Movement Envelope */}
					<div className="space-y-2">
						<Label htmlFor="security_movement_envelope">
							Security Movement Envelope Number
						</Label>
						<Input
							id="security_movement_envelope"
							value={securityEnvelope}
							onChange={(e) =>
								onFieldChange("security_movement_envelope", e.target.value)
							}
							placeholder="Enter envelope number"
						/>
						<p className="text-xs text-muted-foreground">
							Security envelope tracking number
						</p>
					</div>
				</div>
			</SectionCard>
		</div>
	);
};
