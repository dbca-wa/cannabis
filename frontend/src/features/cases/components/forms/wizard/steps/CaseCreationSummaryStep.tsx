/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from "react";

import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import Calendar22 from "@/shared/components/ui/calendar-22";
import { DefendantSearchCombobox } from "@/shared/components/defendants";
import { CreateDefendantModal } from "@/shared/components/defendants";
import { OfficerSearchComboBox } from "@/shared/components/police";
import { StationSearchComboBox } from "@/shared/components/police";
import { useDefendantById } from "@/features/defendants/hooks/useDefendants";
import {
	formatDefendantDisplayName,
	getDefendantCasesBadgeColourClass,
	getDefendantCasesBadge,
} from "@/shared/utils/defendant-display.utils";
import { Plus, X } from "lucide-react";
import { SectionCard } from "../SectionCard";
import { CasePoliceFormUpload } from "../../ocr/CasePoliceFormUpload";
import type { DefendantTiny } from "@/shared/types/backend-api.types";

interface CaseCreationSummaryStepProps {
	/** Server-authoritative case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Whether this step has been touched (controls validation error display) */
	isTouched: boolean;
	/** Callback to persist field changes via PATCH mutation */
	onFieldChange: (field: string, value: unknown) => void;
}

/**
 * Step 0 of the case processing wizard (Process 2).
 * Editable summary of case details, defendants, and officers.
 * Pre-completed when all required data is valid; shows as invalid
 * when required fields become empty after editing.
 *
 * Uses SectionCard for each group in a condensed view.
 */
export const CaseCreationSummaryStep = ({
	caseData,
	isTouched,
	onFieldChange,
}: CaseCreationSummaryStepProps) => {
	const [selectedDefendantId, setSelectedDefendantId] = useState<number | null>(
		null
	);
	const [showCreateModal, setShowCreateModal] = useState(false);

	// Derive field values from server data
	const caseNumber = (caseData?.case_number as string) ?? "";
	const received = (caseData?.received as string) ?? "";
	const securityEnvelope =
		(caseData?.security_movement_envelope as string) ?? "";
	const defendants = (caseData?.defendants_details as DefendantTiny[]) ?? [];
	const defendantIds = useMemo(
		() => (caseData?.defendants as number[]) ?? [],
		[caseData?.defendants]
	);
	const requestingOfficer =
		(caseData?.requesting_officer_id as number | null) ?? null;
	const submittingOfficer =
		(caseData?.submitting_officer_id as number | null) ?? null;
	const station = (caseData?.station_id as number | null) ?? null;

	// Fetch defendant when selected via combobox
	const { data: defendantToAdd } = useDefendantById(selectedDefendantId);

	useEffect(() => {
		if (
			defendantToAdd &&
			selectedDefendantId &&
			!defendantIds.includes(defendantToAdd.id)
		) {
			onFieldChange("add_defendant", defendantToAdd);
			setSelectedDefendantId(null);
		}
	}, [defendantToAdd, selectedDefendantId, defendantIds, onFieldChange]);

	// Validation errors (defendants are optional — an empty list means the
	// defendant is unknown and the certificate records "Unknown")
	const errors = {
		case_number: !caseNumber.trim()
			? "Police reference number is required"
			: undefined,
		received: !received ? "Received date is required" : undefined,
		submitting_officer: !submittingOfficer
			? "Submitting officer is required"
			: undefined,
	};

	// Section completion states
	const isCaseDetailsComplete = !!caseNumber.trim() && !!received;
	const isCaseDetailsInvalid = isTouched && (!caseNumber.trim() || !received);
	const isDefendantsComplete = defendants.length > 0;
	const isDefendantsInvalid = false;
	const isOfficersComplete = !!submittingOfficer;
	const isOfficersInvalid = isTouched && !submittingOfficer;

	const handleDefendantCreated = (newDefendant: DefendantTiny) => {
		if (!defendantIds.includes(newDefendant.id)) {
			onFieldChange("add_defendant", newDefendant);
		}
	};

	const handleRemoveDefendant = (defendantId: number) => {
		const updatedIds = defendantIds.filter((id) => id !== defendantId);
		onFieldChange("defendants", updatedIds);
	};

	return (
		<div className="space-y-4">
			{/* Priority 3 form upload/replace (only when OCR is enabled) */}
			<CasePoliceFormUpload
				caseId={(caseData?.id as number) ?? 0}
				currentFormUrl={(caseData?.police_form_url as string | null) ?? null}
			/>

			{/* Case Details Section (condensed) */}
			<SectionCard
				title="Case Details"
				isComplete={isCaseDetailsComplete}
				isInvalid={isCaseDetailsInvalid}
			>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="summary_case_number" className="required">
							Police Reference No.
						</Label>
						<Input
							id="summary_case_number"
							value={caseNumber}
							onChange={(e) => onFieldChange("case_number", e.target.value)}
							placeholder="Enter police reference number"
							aria-invalid={isTouched && !!errors.case_number}
							aria-describedby={
								isTouched && errors.case_number
									? "summary-case-number-error"
									: undefined
							}
						/>
						{isTouched && errors.case_number && (
							<p
								id="summary-case-number-error"
								className="text-sm text-red-600"
								role="alert"
							>
								{errors.case_number}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="summary_received" className="required">
							Received Date
						</Label>
						<Calendar22
							value={received}
							onChange={(date) => onFieldChange("received", date)}
							placeholder="Select received date"
							error={isTouched && !!errors.received}
							aria-invalid={isTouched && !!errors.received}
							aria-describedby={
								isTouched && errors.received
									? "summary-received-error"
									: undefined
							}
						/>
						{isTouched && errors.received && (
							<p
								id="summary-received-error"
								className="text-sm text-red-600"
								role="alert"
							>
								{errors.received}
							</p>
						)}
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="summary_security_envelope">
							Security Movement Envelope
						</Label>
						<Input
							id="summary_security_envelope"
							value={securityEnvelope}
							onChange={(e) =>
								onFieldChange("security_movement_envelope", e.target.value)
							}
							placeholder="Enter envelope number"
						/>
					</div>
				</div>
			</SectionCard>

			{/* Defendants Section (condensed) */}
			<SectionCard
				title="Defendants"
				isComplete={isDefendantsComplete}
				isInvalid={isDefendantsInvalid}
			>
				<div className="space-y-3">
					<div className="flex items-center gap-2">
						<div className="flex-1">
							<DefendantSearchCombobox
								value={selectedDefendantId}
								onValueChange={setSelectedDefendantId}
								placeholder="Search for defendant..."
								exclude={defendantIds}
							/>
						</div>
						<Button
							type="button"
							onClick={() => setShowCreateModal(true)}
							size="sm"
							className="bg-green-600 hover:bg-green-700 text-white"
						>
							<Plus className="h-4 w-4 mr-1" />
							Add
						</Button>
					</div>
					{defendants.length === 0 && (
						<p className="text-xs text-muted-foreground">
							No defendants added — the certificate will record the defendant as
							&quot;Unknown&quot;.
						</p>
					)}

					{defendants.length > 0 && (
						<div className="space-y-1.5">
							{defendants.map((defendant) => (
								<div
									key={defendant.id}
									className="flex items-center justify-between p-2.5 border rounded-lg bg-muted/50"
								>
									<div className="flex items-center gap-2 flex-1 min-w-0">
										<span className="font-medium text-sm truncate">
											{formatDefendantDisplayName(defendant)}
										</span>
										<Badge
											variant="secondary"
											className={getDefendantCasesBadgeColourClass(defendant)}
										>
											{getDefendantCasesBadge(defendant)}
										</Badge>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => handleRemoveDefendant(defendant.id)}
										aria-label={`Remove ${formatDefendantDisplayName(defendant)}`}
									>
										<X className="h-3.5 w-3.5" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</SectionCard>

			{/* Officers Section (condensed) */}
			<SectionCard
				title="Officers"
				isComplete={isOfficersComplete}
				isInvalid={isOfficersInvalid}
			>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div className="space-y-2">
						<Label htmlFor="summary_submitting_officer" className="required">
							Submitting Officer
						</Label>
						<OfficerSearchComboBox
							value={submittingOfficer}
							onValueChange={(id) => onFieldChange("submitting_officer_id", id)}
							placeholder="Search officer..."
							error={isTouched && !!errors.submitting_officer}
							showExternalAddButton
						/>
						{isTouched && errors.submitting_officer && (
							<p className="text-sm text-red-600" role="alert">
								{errors.submitting_officer}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Officer who delivered/submitted the samples.
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="summary_requesting_officer">
							Requesting Officer (on behalf of)
						</Label>
						<OfficerSearchComboBox
							value={requestingOfficer}
							onValueChange={(id) => onFieldChange("requesting_officer_id", id)}
							placeholder="Search officer..."
							showExternalAddButton
						/>
						<p className="text-xs text-muted-foreground">
							Optional — who the samples were submitted on behalf of.
						</p>
					</div>

					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="summary_station">Police Station</Label>
						<StationSearchComboBox
							value={station}
							onValueChange={(id) => onFieldChange("station_id", id)}
							placeholder="Search station..."
							showExternalAddButton
						/>
					</div>
				</div>
			</SectionCard>

			{/* Create Defendant Modal */}
			<CreateDefendantModal
				open={showCreateModal}
				onOpenChange={setShowCreateModal}
				onCreate={handleDefendantCreated}
				isRouteModal={false}
			/>
		</div>
	);
};
