import { Label } from "@/shared/components/ui/label";
import { OfficerSearchComboBox } from "@/shared/components/police";
import { StationSearchComboBox } from "@/shared/components/police";
import { SectionCard } from "../SectionCard";

interface OfficersStepProps {
	/** Server-authoritative case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Whether this step has been touched (controls validation error display) */
	isTouched: boolean;
	/** Callback to persist field changes via PATCH mutation (debounced by parent) */
	onFieldChange: (field: string, value: unknown) => void;
}

/**
 * Step 1 of the case creation wizard — officer and station selection.
 * Renders requesting_officer, submitting_officer, and station fields.
 */
export const OfficersStep = ({
	caseData,
	isTouched,
	onFieldChange,
}: OfficersStepProps) => {
	// Derive field values from server data
	const requestingOfficer =
		(caseData?.requesting_officer_id as number | null) ?? null;
	const submittingOfficer =
		(caseData?.submitting_officer_id as number | null) ?? null;
	const station = (caseData?.station_id as number | null) ?? null;

	// Compute validation errors (only displayed when isTouched). The submitting
	// officer is required; the requesting officer ("on behalf of") and the
	// police station are optional — Priority 3 forms only list a station when an
	// "on behalf of" officer is present.
	const errors = {
		submitting_officer: !submittingOfficer
			? "Submitting officer is required"
			: undefined,
	};

	// Determine section completion and invalid state (station is optional)
	const isComplete = !!submittingOfficer;
	const isInvalid = isTouched && !submittingOfficer;

	const handleRequestingOfficerChange = (officerId: number | null) => {
		onFieldChange("requesting_officer_id", officerId);
	};

	const handleSubmittingOfficerChange = (officerId: number | null) => {
		onFieldChange("submitting_officer_id", officerId);
	};

	const handleStationChange = (stationId: number | null) => {
		onFieldChange("station_id", stationId);
	};

	return (
		<div className="space-y-6">
			<SectionCard
				title="Officers and Station"
				isComplete={isComplete}
				isInvalid={isInvalid}
			>
				<div className="space-y-4">
					{/* Submitting Officer (required) */}
					<div className="space-y-2">
						<Label htmlFor="submitting_officer" className="required">
							Submitting Officer
						</Label>
						<OfficerSearchComboBox
							value={submittingOfficer}
							onValueChange={handleSubmittingOfficerChange}
							placeholder="Search for submitting officer..."
							error={isTouched && !!errors.submitting_officer}
							showExternalAddButton
						/>
						{isTouched && errors.submitting_officer && (
							<p
								id="submitting_officer-error"
								className="text-sm text-red-600"
								role="alert"
							>
								{errors.submitting_officer}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							The officer who delivered or submitted the samples to the
							laboratory.
						</p>
					</div>

					{/* Requesting Officer — "on behalf of" (optional) */}
					<div className="space-y-2">
						<Label htmlFor="requesting_officer">
							Requesting Officer (on behalf of)
						</Label>
						<OfficerSearchComboBox
							value={requestingOfficer}
							onValueChange={handleRequestingOfficerChange}
							placeholder="Search for requesting officer..."
							showExternalAddButton
						/>
						<p className="text-xs text-muted-foreground">
							Optional. If the submitting officer dropped the samples off for
							another officer, select who they submitted on behalf of. Leave
							blank if the submitting officer is also the requesting officer.
						</p>
					</div>

					{/* Police Station (optional) */}
					<div className="space-y-2">
						<Label htmlFor="station">Police Station</Label>
						<StationSearchComboBox
							value={station}
							onValueChange={handleStationChange}
							placeholder="Search for police station..."
							showExternalAddButton
						/>
						<p className="text-xs text-muted-foreground">
							Optional. Station where the samples originated — usually only
							recorded when an "on behalf of" officer is present.
						</p>
					</div>
				</div>
			</SectionCard>
		</div>
	);
};
