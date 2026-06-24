/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useMemo } from "react";

import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { DefendantSearchCombobox } from "@/shared/components/defendants";
import { CreateDefendantModal } from "@/shared/components/defendants";
import { useDefendantById } from "@/features/defendants/hooks/useDefendants";
import {
	formatDefendantDisplayName,
	getDefendantCasesBadgeColourClass,
	getDefendantCasesBadge,
} from "@/shared/utils/defendant-display.utils";
import { Plus, X } from "lucide-react";
import { SectionCard } from "../SectionCard";
import type { DefendantTiny } from "@/shared/types/backend-api.types";

interface DefendantsStepProps {
	/** Server-authoritative case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Whether this step has been touched (controls validation error display) */
	isTouched: boolean;
	/** Callback to persist field changes via PATCH mutation */
	onFieldChange: (field: string, value: unknown) => void;
}

/**
 * Step 1 of the case creation wizard (Process 1) — dedicated defendants management.
 * Allows adding, viewing, and removing defendants associated with the case.
 * Validates that at least one defendant is present before allowing progression.
 */
export const DefendantsStep = ({
	caseData,
	isTouched,
	onFieldChange,
}: DefendantsStepProps) => {
	const [selectedDefendantId, setSelectedDefendantId] = useState<number | null>(
		null
	);
	const [showCreateModal, setShowCreateModal] = useState(false);

	// Derive defendants from server data
	const defendants = (caseData?.defendants_details as DefendantTiny[]) ?? [];
	const defendantIds = useMemo(
		() => (caseData?.defendants as number[]) ?? [],
		[caseData?.defendants]
	);

	// Fetch the full defendant object when selected via combobox
	const { data: defendantToAdd } = useDefendantById(selectedDefendantId);

	// Automatically add defendant when data is loaded
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

	// Validation error (only displayed when isTouched)
	const error =
		defendants.length === 0 ? "At least one defendant is required" : undefined;

	// Section states
	const isComplete = defendants.length > 0;
	const isInvalid = isTouched && defendants.length === 0;

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
		<div className="space-y-6">
			<SectionCard
				title="Defendants"
				isComplete={isComplete}
				isInvalid={isInvalid}
			>
				<div className="space-y-4">
					{/* Add Defendant */}
					<div className="space-y-2">
						<Label htmlFor="defendant_search">Add Defendant</Label>
						<div className="flex items-center gap-2">
							<div className="flex-1">
								<DefendantSearchCombobox
									value={selectedDefendantId}
									onValueChange={setSelectedDefendantId}
									placeholder="Search for defendant..."
									exclude={defendantIds}
									error={isTouched && !!error}
								/>
							</div>
							<Button
								type="button"
								onClick={() => setShowCreateModal(true)}
								size="default"
								className="bg-green-600 hover:bg-green-700 text-white"
							>
								<Plus className="h-4 w-4 mr-2" />
								Add
							</Button>
						</div>
						{isTouched && error && (
							<p
								id="defendants-error"
								className="text-sm text-red-600"
								role="alert"
								aria-live="polite"
							>
								{error}
							</p>
						)}
						<p className="text-xs text-muted-foreground">
							Search for existing defendants or click Add to create a new one
						</p>
					</div>

					{/* Selected Defendants List */}
					<div className="space-y-2">
						<Label>Selected Defendants ({defendants.length || "None"})</Label>
						{defendants.length === 0 ? (
							<div className="p-4 border border-dashed rounded-lg text-center">
								<div className="text-sm font-medium text-muted-foreground">
									Unknown
								</div>
								<div className="text-xs text-muted-foreground mt-1">
									No defendants added. Defendant will default to
									&quot;Unknown&quot; in certificate.
								</div>
							</div>
						) : (
							<div className="space-y-2">
								{defendants.map((defendant) => (
									<div
										key={defendant.id}
										className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
									>
										<div className="flex items-center gap-3 flex-1 min-w-0">
											<div className="flex-1 min-w-0">
												<div className="font-medium truncate">
													{formatDefendantDisplayName(defendant)}
												</div>
												<div className="text-xs text-muted-foreground">
													ID: {defendant.id}
												</div>
											</div>
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
											className="ml-2"
											aria-label={`Remove ${formatDefendantDisplayName(defendant)}`}
										>
											<X className="h-4 w-4" />
										</Button>
									</div>
								))}
							</div>
						)}
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
