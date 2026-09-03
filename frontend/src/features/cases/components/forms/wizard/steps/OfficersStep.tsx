import { useEffect } from "react";
import { Label } from "@/shared/components/ui/label";
import { Info } from "lucide-react";
import { OfficerSearchComboBox } from "@/shared/components/police";
import { StationSearchComboBox } from "@/shared/components/police";
import { useOfficerById } from "@/features/police/hooks";
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
	const requestingOfficerId =
		(caseData?.requesting_officer_id as number | null) ?? null;
	const submittingOfficerId =
		(caseData?.submitting_officer_id as number | null) ?? null;
	const station = (caseData?.station_id as number | null) ?? null;

	// Fetch requesting officer details to derive station
	const { data: requestingOfficerData } = useOfficerById(requestingOfficerId);

	// Derive station ONLY from requesting officer
	const derivedStationId = requestingOfficerData?.station || null;

	// Clear station when requesting officer is removed
	useEffect(() => {
		if (!requestingOfficerId && station) {
			onFieldChange("station_id", null);
		}
	}, [requestingOfficerId, station, onFieldChange]);

	// Auto-set station from requesting officer
	useEffect(() => {
		if (derivedStationId) {
			onFieldChange("station_id", derivedStationId);
		}
	}, [derivedStationId, onFieldChange]);

	// Station visibility: show once both officers are set
	const bothOfficersSet = !!submittingOfficerId && !!requestingOfficerId;
	const showStation = bothOfficersSet;
	// Manual station selection: both set but no station derived
	const needsManualStation = bothOfficersSet && !derivedStationId;

	// The same officer cannot be both conveying and requesting. This is a clear
	// mistake so we surface it immediately (not gated behind isTouched).
	const sameOfficerSelected =
		!!submittingOfficerId &&
		!!requestingOfficerId &&
		submittingOfficerId === requestingOfficerId;

	// Compute validation errors. "Required" errors only show once touched;
	// the same-officer clash shows as soon as it happens.
	const errors = {
		submitting_officer: !submittingOfficerId
			? "Conveying officer is required"
			: undefined,
		requesting_officer: !requestingOfficerId
			? "Requesting officer is required"
			: undefined,
	};

	// Section is complete when both officers are set and different
	const isComplete =
		!!submittingOfficerId &&
		!!requestingOfficerId &&
		submittingOfficerId !== requestingOfficerId;
	const isInvalid = (isTouched && !isComplete) || sameOfficerSelected;

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
							Submitting Officer (Conveying Officer)
						</Label>
						<OfficerSearchComboBox
							value={submittingOfficerId}
							onValueChange={handleSubmittingOfficerChange}
							placeholder="Search for conveying officer..."
							error={
								(isTouched && !!errors.submitting_officer) ||
								sameOfficerSelected
							}
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
							The unsworn officer who physically delivered the samples to the
							laboratory.
						</p>
					</div>

					{/* Requesting Officer (required) */}
					<div className="space-y-2">
						<Label htmlFor="requesting_officer" className="required">
							Requesting Officer (On Behalf Of)
						</Label>
						<OfficerSearchComboBox
							value={requestingOfficerId}
							onValueChange={handleRequestingOfficerChange}
							placeholder="Search for requesting officer..."
							error={
								(isTouched && !!errors.requesting_officer) ||
								sameOfficerSelected
							}
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
							The sworn officer who made the seizure or arrest and requested the
							identification.
						</p>
					</div>

					{/* Same-officer clash — shown immediately, not gated by touch */}
					{sameOfficerSelected && (
						<div
							role="alert"
							className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
						>
							<Info className="mt-0.5 h-4 w-4 shrink-0" />
							<span>
								The Conveying Officer and Requesting Officer must be two
								different people. Please select a different officer for one of
								the fields.
							</span>
						</div>
					)}

					{/* Police Station — hidden until submitting officer set */}
					{showStation && (
						<div className="space-y-2">
							<Label htmlFor="station">Police Station</Label>
							<StationSearchComboBox
								value={station}
								onValueChange={handleStationChange}
								placeholder="Search for police station..."
								showExternalAddButton={!derivedStationId}
								disabled={!!derivedStationId}
							/>
							{derivedStationId && (
								<p className="text-xs text-muted-foreground">
									Automatically set from officer&apos;s station.
								</p>
							)}
							{needsManualStation && (
								<p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
									<Info className="h-3 w-3" />
									Neither officer has a station assigned. Please select
									manually.
								</p>
							)}
						</div>
					)}
					{!showStation && (
						<p className="text-xs text-muted-foreground italic">
							Police station will appear once both officers are selected.
						</p>
					)}
				</div>
			</SectionCard>
		</div>
	);
};
