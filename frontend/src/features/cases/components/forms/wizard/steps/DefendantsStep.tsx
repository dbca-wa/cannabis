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
import { Plus, X, UserX, Undo2 } from "lucide-react";
import { SectionCard } from "../SectionCard";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import type { DefendantTiny } from "@/shared/types/backend-api.types";

interface DefendantsStepProps {
	/** Server-authoritative case data from TanStack Query */
	caseData: Record<string, unknown> | null;
	/** Whether this step has been touched (controls validation error display) */
	isTouched: boolean;
	/** Callback to persist field changes via PATCH mutation */
	onFieldChange: (field: string, value: unknown) => void;
	/** Whether the user has acknowledged the case has no known defendant */
	defendantUnknown: boolean;
	/** Setter for the unknown-defendant acknowledgement */
	onDefendantUnknownChange: (acknowledged: boolean) => void;
}

/**
 * Step 1 of the case creation wizard (Process 1) — dedicated defendants management.
 * The user must either add at least one defendant or explicitly mark the
 * defendant as unknown (the certificate then renders "Unknown") before
 * progressing.
 */
export const DefendantsStep = ({
	caseData,
	isTouched,
	onFieldChange,
	defendantUnknown,
	onDefendantUnknownChange,
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
			// Adding a real defendant supersedes the "unknown" acknowledgement
			if (defendantUnknown) {
				onDefendantUnknownChange(false);
			}
		}
	}, [
		defendantToAdd,
		selectedDefendantId,
		defendantIds,
		onFieldChange,
		defendantUnknown,
		onDefendantUnknownChange,
	]);

	// Validation error (only displayed when isTouched). The step is satisfied by
	// either adding a defendant or acknowledging the defendant is unknown.
	const error =
		defendants.length === 0 && !defendantUnknown
			? "Add at least one defendant, or mark the defendant as unknown"
			: undefined;

	// Section states
	const isComplete = defendants.length > 0 || defendantUnknown;
	const isInvalid = isTouched && !!error;

	const handleDefendantCreated = (newDefendant: DefendantTiny) => {
		if (!defendantIds.includes(newDefendant.id)) {
			onFieldChange("add_defendant", newDefendant);
		}
		if (defendantUnknown) {
			onDefendantUnknownChange(false);
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
						<p className="text-xs text-muted-foreground">
							Search for an existing defendant, or click Add to create a new
							one.
						</p>
					</div>

					{/* Selected Defendants List */}
					<div className="space-y-2">
						<Label>Selected Defendants ({defendants.length || "None"})</Label>
						{defendants.length === 0 ? (
							defendantUnknown ? (
								<div className="p-4 border rounded-lg bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900">
									<div className="flex items-start gap-3">
										<UserX className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
										<div className="flex-1">
											<div className="text-sm font-medium">
												Defendant marked as unknown
											</div>
											<div className="text-xs text-muted-foreground mt-1">
												The certificate will record the defendant as
												&quot;Unknown&quot;. Add a defendant above if one
												becomes known.
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="mt-3"
												onClick={() => onDefendantUnknownChange(false)}
											>
												<Undo2 className="h-4 w-4 mr-2" />
												Undo
											</Button>
										</div>
									</div>
								</div>
							) : (
								<div className="p-4 border border-dashed rounded-lg text-center">
									<div className="text-sm font-medium text-muted-foreground">
										No defendants added
									</div>
									<div className="text-xs text-muted-foreground mt-1">
										Add a defendant above to continue, or mark the defendant as
										unknown if their identity isn&apos;t known.
									</div>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												type="button"
												variant="outline"
												size="sm"
												className="mt-3 border-amber-400 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-700 dark:text-amber-400 dark:bg-amber-900 dark:hover:bg-amber-950/30"
												onClick={() => onDefendantUnknownChange(true)}
											>
												<UserX className="h-4 w-4 mr-2" />
												Defendant is unknown
											</Button>
										</TooltipTrigger>
										<TooltipContent className="max-w-xs">
											<p>
												Use this when the defendant&apos;s identity isn&apos;t
												known. The certificate will record the defendant as
												&quot;Unknown&quot; and you can continue without adding
												one.
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
							)
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

					{/* Validation error — shown at the bottom so users see the "Defendant is unknown" button above */}
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
