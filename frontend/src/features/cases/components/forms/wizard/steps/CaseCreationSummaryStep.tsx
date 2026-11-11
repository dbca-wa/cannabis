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
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import { useDefendantById } from "@/features/defendants/hooks/useDefendants";
import {
	formatDefendantDisplayName,
	getDefendantCasesBadgeColourClass,
	getDefendantCasesBadge,
} from "@/shared/utils/defendant-display.utils";
import { Info, Plus, X } from "lucide-react";
import { readPrintOptions } from "@/features/cases/utils/certificateWording";
import { FINALISED_PHASES } from "@/features/cases/utils/caseSections";
import { SectionCard } from "../SectionCard";
import { OfficerPrintOptions } from "../OfficerPrintOptions";
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
	const approvedBotanistId =
		(caseData?.approved_botanist_id as number | null) ?? null;
	const printOptions = readPrintOptions(caseData);

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
	// The same officer cannot be both conveying and requesting. This is a clear
	// mistake, so it shows straight away, as it does on the new case form. A
	// case finalised before the rule existed is left alone.
	const isFinalised = FINALISED_PHASES.includes(
		(caseData?.phase as string) ?? ""
	);
	const sameOfficerSelected =
		!isFinalised &&
		!!submittingOfficer &&
		!!requestingOfficer &&
		submittingOfficer === requestingOfficer;
	const isOfficersComplete = !!submittingOfficer && !sameOfficerSelected;
	const isOfficersInvalid =
		(isTouched && !submittingOfficer) || sameOfficerSelected;

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

			{/*
			  Two columns of cards on large screens so the details fill the
			  available width instead of a single narrow column. Each card owns
			  its own internal field grid.
			*/}
			{/* Columns follow the space this section has, not the window, so the
			    cards stack when the practice or reference guide panel is open. */}
			<div className="@container">
				<div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4">
					{/* Case Details — full width row */}
					<SectionCard
						title="Case Details"
						isComplete={isCaseDetailsComplete}
						isInvalid={isCaseDetailsInvalid}
						className="@3xl:col-span-2"
					>
						<div className="grid grid-cols-1 @xl:grid-cols-2 gap-4">
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
									id="summary_received"
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
						</div>
					</SectionCard>

					{/* Approved Botanist — shares a row, and height, with Defendants */}
					<SectionCard
						title="Approved Botanist"
						isComplete={!!approvedBotanistId}
						isInvalid={isTouched && !approvedBotanistId}
						className="h-full"
					>
						<div className="space-y-2">
							<Label htmlFor="summary_approved_botanist" className="sr-only">
								Approved Botanist
							</Label>
							<UserSearchCombobox
								id="summary_approved_botanist"
								value={approvedBotanistId}
								onValueChange={(id) => onFieldChange("approved_botanist", id)}
								placeholder="Select approved botanist..."
								roleFilter="botanist"
								lastUsedKey="botanist"
							/>
							<p className="text-xs text-muted-foreground">
								The botanist assigned to this case
							</p>
						</div>
					</SectionCard>

					{/* Defendants — shares a row, and height, with Approved Botanist */}
					<SectionCard
						title="Defendants"
						isComplete={isDefendantsComplete}
						isInvalid={isDefendantsInvalid}
						optional
						className="h-full"
					>
						<div className="space-y-3">
							<Label htmlFor="summary_defendant_search" className="sr-only">
								Add defendant
							</Label>
							<div className="flex items-center gap-2">
								{/* min-w-0 lets the search shrink so the Add button stays
							    inside the card on narrow layouts. */}
								<div className="min-w-0 flex-1">
									<DefendantSearchCombobox
										id="summary_defendant_search"
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
									No defendants added — the certificate will record the
									defendant as UNKNOWN.
								</p>
							)}

							{defendants.length > 0 && (
								// Chips wrap so several defendants share a line rather than
								// one per row, keeping the card compact as more are added.
								<div className="flex flex-wrap gap-1.5">
									{defendants.map((defendant) => (
										<span
											key={defendant.id}
											className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 py-1 pl-3 pr-1 text-sm"
										>
											<span className="font-medium truncate max-w-[14rem]">
												{formatDefendantDisplayName(defendant)}
											</span>
											<Badge
												variant="secondary"
												className={getDefendantCasesBadgeColourClass(defendant)}
											>
												{getDefendantCasesBadge(defendant)}
											</Badge>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="h-5 w-5 rounded-full"
												onClick={() => handleRemoveDefendant(defendant.id)}
												aria-label={`Remove ${formatDefendantDisplayName(defendant)}`}
											>
												<X className="h-3.5 w-3.5" />
											</Button>
										</span>
									))}
								</div>
							)}
						</div>
					</SectionCard>

					{/* Officers — full width row */}
					<SectionCard
						title="Officers"
						isComplete={isOfficersComplete}
						isInvalid={isOfficersInvalid}
						className="@3xl:col-span-2"
					>
						<div className="grid grid-cols-1 @2xl:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label
									htmlFor="summary_submitting_officer"
									className="required"
								>
									Submitting Officer (Conveying Officer)
								</Label>
								<OfficerSearchComboBox
									id="summary_submitting_officer"
									value={submittingOfficer}
									onValueChange={(id) =>
										onFieldChange("submitting_officer_id", id)
									}
									placeholder="Search for conveying officer..."
									error={
										(isTouched && !!errors.submitting_officer) ||
										sameOfficerSelected
									}
									showExternalAddButton
									required
								/>
								{isTouched && errors.submitting_officer && (
									<p className="text-sm text-red-600" role="alert">
										{errors.submitting_officer}
									</p>
								)}
								<p className="text-xs text-muted-foreground">
									The unsworn officer who physically delivered the samples to
									the laboratory.
								</p>
								<OfficerPrintOptions
									role="conveying"
									officerId={submittingOfficer}
									idPrefix="summary-conveying"
									printStation={printOptions.printConveyingStation}
									onPrintStationChange={(checked) =>
										onFieldChange("print_conveying_station", checked)
									}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="summary_requesting_officer">
									Requesting Officer (On Behalf Of){" "}
									<span className="font-normal text-muted-foreground">
										— optional
									</span>
								</Label>
								<OfficerSearchComboBox
									id="summary_requesting_officer"
									value={requestingOfficer}
									onValueChange={(id) =>
										onFieldChange("requesting_officer_id", id)
									}
									placeholder="Search for requesting officer..."
									error={sameOfficerSelected}
									showExternalAddButton
								/>
								<p className="text-xs text-muted-foreground">
									The sworn officer who made the seizure or arrest and requested
									the identification. Leave blank when the conveying officer
									submitted the samples in their own right.
								</p>
								<OfficerPrintOptions
									role="requesting"
									officerId={requestingOfficer}
									idPrefix="summary-requesting"
									printStation={printOptions.printRequestingStation}
									onPrintStationChange={(checked) =>
										onFieldChange("print_requesting_station", checked)
									}
									printRank={printOptions.printRequestingRank}
									onPrintRankChange={(checked) =>
										onFieldChange("print_requesting_rank", checked)
									}
								/>
							</div>

							{sameOfficerSelected && (
								<div
									role="alert"
									className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 @2xl:col-span-2 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300"
								>
									<Info
										className="mt-0.5 h-4 w-4 shrink-0"
										aria-hidden="true"
									/>
									<span>
										The Conveying Officer and Requesting Officer must be two
										different people. Please select a different officer for one
										of the fields.
									</span>
								</div>
							)}

							<div className="space-y-2 @2xl:col-span-2">
								<Label htmlFor="summary_station">
									Police Station{" "}
									<span className="font-normal text-muted-foreground">
										— optional
									</span>
								</Label>
								<StationSearchComboBox
									id="summary_station"
									value={station}
									onValueChange={(id) => onFieldChange("station_id", id)}
									placeholder="Search for police station..."
									showExternalAddButton
								/>
							</div>
						</div>
					</SectionCard>
				</div>
			</div>

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
