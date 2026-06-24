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

	// Compute validation errors (only displayed when isTouched)
	const errors = {
		requesting_officer: !requestingOfficer
			? "Requesting officer is required"
			: undefined,
		submitting_officer: !submittingOfficer
			? "Submitting officer is required"
			: undefined,
		station: !station ? "Police station is required" : undefined,
	};

	// Determine section completion and invalid state
	const isComplete = !!requestingOfficer && !!submittingOfficer && !!station;
	const isInvalid =
		isTouched && (!requestingOfficer || !submittingOfficer || !station);

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
					{/* Requesting Officer */}
					<div className="space-y-2">
						<Label htmlFor="requesting_officer" className="required">
							Requesting Officer
						</Label>
						<OfficerSearchComboBox
							value={requestingOfficer}
							onValueChange={handleRequestingOfficerChange}
							placeholder="Search for requesting officer..."
							error={isTouched && !!errors.requesting_officer}
							showExternalAddButton
						/>
						{isTouched && errors.requesting_officer && (
							<p
								id="requesting_officer-error"
								className="text-sm text-red-600"
								role="alert"
							>
								{errors.requesting_officer}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Officer who requested the botanical identification
						</p>
					</div>

					{/* Submitting Officer */}
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
							Officer who submitted the samples for identification
						</p>
					</div>

					{/* Police Station */}
					<div className="space-y-2">
						<Label htmlFor="station" className="required">
							Police Station
						</Label>
						<StationSearchComboBox
							value={station}
							onValueChange={handleStationChange}
							placeholder="Search for police station..."
							error={isTouched && !!errors.station}
							showExternalAddButton
						/>
						{isTouched && errors.station && (
							<p
								id="station-error"
								className="text-sm text-red-600"
								role="alert"
							>
								{errors.station}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Station where the samples originated
						</p>
					</div>
				</div>
			</SectionCard>
		</div>
	);
};
