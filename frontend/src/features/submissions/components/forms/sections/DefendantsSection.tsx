import { DefendantSearchCombobox } from "@/features/defendants/components/DefendantSearchCombobox";
import { CreateDefendantModal } from "@/features/defendants/components/CreateDefendantModal";
import { useDefendantById } from "@/features/defendants/hooks/useDefendants";
import { DefendantsService } from "@/features/defendants/services/defendants.service";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Label } from "@/shared/components/ui/label";
import { Plus, X } from "lucide-react";
import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";
import { useSubmissionFormStore } from "@/features/submissions/hooks/useSubmissionFormStore";
import type { DefendantTiny } from "@/shared/types/backend-api.types";

export const DefendantsSection = observer(() => {
	const formStore = useSubmissionFormStore();
	const [selectedDefendantId, setSelectedDefendantId] = useState<
		number | null
	>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);

	// Fetch the selected defendant to add
	const { data: defendantToAdd } = useDefendantById(selectedDefendantId);

	// Automatically add defendant when selected and data is loaded (e.g., after creation)
	useEffect(() => {
		if (
			defendantToAdd &&
			selectedDefendantId &&
			!formStore.formData.defendant_ids.includes(defendantToAdd.id)
		) {
			const updatedDefendants = [
				...formStore.selectedDefendants,
				defendantToAdd,
			];
			formStore.setSelectedDefendants(updatedDefendants);
			setSelectedDefendantId(null);
		}
	}, [defendantToAdd, selectedDefendantId, formStore]);

	const handleOpenCreateModal = () => {
		setShowCreateModal(true);
	};

	const handleDefendantCreated = (newDefendant: DefendantTiny) => {
		// Add the newly created defendant to the selected list
		if (!formStore.formData.defendant_ids.includes(newDefendant.id)) {
			const updatedDefendants = [
				...formStore.selectedDefendants,
				newDefendant,
			];
			formStore.setSelectedDefendants(updatedDefendants);
		}
	};

	const handleRemoveDefendant = (defendantId: number) => {
		const updatedDefendants = formStore.selectedDefendants.filter(
			(d) => d.id !== defendantId
		);
		formStore.setSelectedDefendants(updatedDefendants);
	};

	const getFieldError = (field: string): string | undefined => {
		return formStore.validationErrors[field] as string | undefined;
	};

	// Get IDs of already selected defendants to exclude from search
	const excludedDefendantIds = formStore.formData.defendant_ids;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Defendants</CardTitle>
				<CardDescription>
					Add defendants associated with this submission
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Add Defendant Section */}
				<div className="space-y-2">
					<Label htmlFor="defendant_search">Add Defendant</Label>
					<div className="flex items-center gap-2">
						<div className="flex-1">
							<DefendantSearchCombobox
								value={selectedDefendantId}
								onValueChange={setSelectedDefendantId}
								placeholder="Search for defendant..."
								exclude={excludedDefendantIds}
								error={!!getFieldError("defendants")}
							/>
						</div>
						<Button
							type="button"
							onClick={handleOpenCreateModal}
							size="default"
							className="bg-green-600 hover:bg-green-700 text-white"
						>
							<Plus className="h-4 w-4 mr-2" />
							Add
						</Button>
					</div>
					{getFieldError("defendants") && (
						<p className="text-sm text-red-500">
							{getFieldError("defendants")}
						</p>
					)}
					<p className="text-xs text-muted-foreground">
						Search for existing defendants or click Add to create a
						new one
					</p>
				</div>

				{/* Selected Defendants List */}
				<div className="space-y-2">
					<Label>
						Selected Defendants (
						{formStore.selectedDefendants.length || "Unknown"})
					</Label>
					{formStore.selectedDefendants.length === 0 ? (
						<div className="p-4 border border-dashed rounded-lg text-center">
							<div className="text-sm font-medium text-muted-foreground">
								Unknown
							</div>
							<div className="text-xs text-muted-foreground mt-1">
								No defendants added. Defendant will default to
								"Unknown" in certificate.
							</div>
						</div>
					) : (
						<div className="space-y-2">
							{formStore.selectedDefendants.map((defendant) => (
								<div
									key={defendant.id}
									className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
								>
									<div className="flex items-center gap-3 flex-1 min-w-0">
										<div className="flex-1 min-w-0">
											<div className="font-medium truncate">
												{DefendantsService.formatDefendantDisplayName(
													defendant
												)}
											</div>
											<div className="text-xs text-muted-foreground">
												ID: {defendant.id}
											</div>
										</div>
										<Badge
											variant="secondary"
											className={DefendantsService.getDefendantCasesBadgeColorClass(
												defendant
											)}
										>
											{DefendantsService.getDefendantCasesBadge(
												defendant
											)}
										</Badge>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() =>
											handleRemoveDefendant(defendant.id)
										}
										className="ml-2"
									>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}
						</div>
					)}
				</div>
			</CardContent>

			{/* Create Defendant Modal */}
			<CreateDefendantModal
				open={showCreateModal}
				onOpenChange={setShowCreateModal}
				onCreate={handleDefendantCreated}
				isRouteModal={false}
			/>
		</Card>
	);
});

DefendantsSection.displayName = "DefendantsSection";
