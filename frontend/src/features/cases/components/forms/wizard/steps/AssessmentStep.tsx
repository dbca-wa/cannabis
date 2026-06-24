import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Package, Plus, Layers, Save } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import { useDrugBagWranglerStore } from "@/app/providers/store.provider";
import { SectionCard } from "../SectionCard";
import { BagCard } from "../BagCard";
import { BulkAddBagsModal } from "../BulkAddBagsModal";
import { useDrugBags } from "../../../../hooks/useDrugBags";
import {
	createAssessment,
	updateAssessment,
} from "../../../../services/assessments.service";
import type {
	DrugBag,
	DrugBagContentType,
	DrugBagUpdateRequest,
	BotanicalDetermination,
} from "../../../../types/drugBags.types";

interface AssessmentStepProps {
	/** Case data from TanStack Query — contains bags array and text fields */
	caseData: Record<string, unknown> | null;
	/** Case ID for mutations */
	caseId: number;
	/** Whether the step has been touched (controls validation error display) */
	isTouched: boolean;
	/** Callback to persist field changes via mutation */
	onFieldChange: (field: string, value: unknown) => void;
}

/**
 * Assessment step — renders Approved Botanist selection, Drug Bags with
 * in-memory bag management (via DrugBagWranglerStore), and full-width notes section.
 */
export const AssessmentStep = observer(function AssessmentStep({
	caseData,
	caseId,
	isTouched,
	onFieldChange,
}: AssessmentStepProps) {
	const [bulkModalOpen, setBulkModalOpen] = useState(false);
	const wrangler = useDrugBagWranglerStore();

	const queryClient = useQueryClient();

	const { createDrugBag, updateDrugBag, deleteDrugBag, isCreating } =
		useDrugBags(caseId || null);

	// Assessment mutations (inline — no dedicated hook)
	const createAssessmentMutation = useMutation({
		mutationFn: ({
			drugBagId,
			determination,
		}: {
			drugBagId: number;
			determination: BotanicalDetermination;
		}) => createAssessment(drugBagId, { determination }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["cases"] });
			await queryClient.invalidateQueries({ queryKey: ["drugbags"] });
			toast.success("Drug bag created");
		},
		onError: () => {
			toast.error("Failed to create assessment");
		},
	});

	const updateAssessmentMutation = useMutation({
		mutationFn: ({
			assessmentId,
			determination,
		}: {
			assessmentId: number;
			determination: BotanicalDetermination;
		}) => updateAssessment(assessmentId, { determination }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["cases"] });
			await queryClient.invalidateQueries({ queryKey: ["drugbags"] });
			toast.success("Assessment updated");
		},
		onError: () => {
			toast.error("Failed to update assessment");
		},
	});

	// Derive data from caseData
	const serverBags: DrugBag[] = Array.isArray(caseData?.bags)
		? (caseData.bags as DrugBag[])
		: [];

	const approvedBotanistId =
		(caseData?.approved_botanist_id as number | null) ?? null;

	const additionalNotes =
		typeof caseData?.additional_notes === "string"
			? caseData.additional_notes
			: "None";
	const internalComments =
		typeof caseData?.internal_comments === "string"
			? caseData.internal_comments
			: "";

	// All existing tags (server + in-memory) for uniqueness validation
	const allTags = [
		...serverBags.map((b) => b.seal_tag_numbers),
		...wrangler.state.bags.map((b) => b.seal_tag_numbers),
	];

	// Add single in-memory bag (empty tag)
	const handleAddBag = () => {
		wrangler.addBag();
	};

	// Persist all in-memory bags to server (with validation)
	const handleCreateAll = async () => {
		if (!caseId) {
			toast.error("Cannot save bags — case not loaded yet");
			return;
		}
		const serverTags = serverBags.map((b) => b.seal_tag_numbers);
		const isValid = wrangler.validate(serverTags);
		if (!isValid) {
			toast.error("Fix validation errors before saving");
			return;
		}

		wrangler.setSaving(true);
		try {
			for (const bag of wrangler.state.bags) {
				await createDrugBag({
					case: caseId,
					seal_tag_numbers: bag.seal_tag_numbers,
					new_seal_tag_numbers: bag.new_seal_tag_numbers || null,
					content_type: bag.content_type,
				});
			}
			wrangler.clearBags();
		} catch {
			// Error toast handled by the mutation
		} finally {
			wrangler.setSaving(false);
		}
	};

	// Batch create handler for BulkAddBagsModal — adds to wrangler store
	const handleBulkAdd = (
		bags: Array<{
			seal_tag_numbers: string;
			content_type: DrugBagContentType;
			determination: BotanicalDetermination;
		}>
	) => {
		wrangler.addBags(
			bags.map((b) => ({
				seal_tag_numbers: b.seal_tag_numbers,
				new_seal_tag_numbers: "",
				content_type: b.content_type,
				determination: b.determination,
			}))
		);
	};

	// BagCard callbacks for server-persisted bags
	const handleUpdateBag = async (bagId: number, data: DrugBagUpdateRequest) => {
		await updateDrugBag({ id: bagId, data });
	};

	const handleDeleteBag = async (bagId: number) => {
		await deleteDrugBag({ id: bagId, submissionId: caseId });
	};

	const handleCreateAssessment = (
		bagId: number,
		determination: BotanicalDetermination
	) => {
		createAssessmentMutation.mutate({ drugBagId: bagId, determination });
	};

	const handleUpdateAssessment = (
		assessmentId: number,
		determination: BotanicalDetermination
	) => {
		updateAssessmentMutation.mutate({ assessmentId, determination });
	};

	// In-memory bag field updates (wrangler store)
	const handleInMemoryUpdate = (
		tempId: string,
		field: string,
		value: string
	) => {
		wrangler.updateBag(
			tempId,
			field as
				| "seal_tag_numbers"
				| "new_seal_tag_numbers"
				| "content_type"
				| "determination",
			value
		);
	};

	const handleInMemoryDelete = (tempId: string) => {
		wrangler.removeBag(tempId);
	};

	return (
		<div className="space-y-6">
			{/* Approved Botanist Section */}
			<SectionCard
				title="Approved Botanist"
				isComplete={!!approvedBotanistId}
				isInvalid={isTouched && !approvedBotanistId}
			>
				<div className="space-y-2">
					<Label htmlFor="approved_botanist">Approved Botanist</Label>
					<UserSearchCombobox
						value={approvedBotanistId}
						onValueChange={(id) => onFieldChange("approved_botanist_id", id)}
						placeholder="Select approved botanist..."
						roleFilter="botanist"
					/>
					<p className="text-xs text-muted-foreground">
						The botanist who performed the botanical assessment
					</p>
				</div>
			</SectionCard>

			{/* Drug Bags Section */}
			<SectionCard
				title="Drug Bags"
				isComplete={serverBags.length > 0}
				isInvalid={isTouched && serverBags.length === 0}
			>
				{serverBags.length === 0 && wrangler.state.bags.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
						<Package className="mb-4 h-12 w-12 text-muted-foreground" />
						<p className="mb-4 text-sm text-muted-foreground">
							No drug bags added yet. Add a bag to begin the assessment.
						</p>
					</div>
				) : (
					<div className="space-y-4">
						<p className="text-sm text-muted-foreground">
							{serverBags.length} saved bag
							{serverBags.length !== 1 ? "s" : ""}
							{wrangler.state.bags.length > 0 &&
								`, ${wrangler.state.bags.length} unsaved`}
						</p>

						{/* Server-persisted bags */}
						<div className="flex flex-col gap-3">
							{serverBags.map((bag) => (
								<BagCard
									key={bag.id}
									bag={bag}
									allTags={allTags}
									onUpdateBag={handleUpdateBag}
									onCreateAssessment={handleCreateAssessment}
									onUpdateAssessment={handleUpdateAssessment}
									onDeleteBag={handleDeleteBag}
								/>
							))}

							{/* In-memory unsaved bags */}
							{wrangler.state.bags.map((memBag) => (
								<BagCard
									key={memBag.tempId}
									bag={
										{
											id: memBag.tempId as unknown as number,
											case: caseId,
											content_type: memBag.content_type,
											content_type_display: memBag.content_type,
											seal_tag_numbers: memBag.seal_tag_numbers,
											new_seal_tag_numbers: memBag.new_seal_tag_numbers || null,
											property_reference: null,
											gross_weight: null,
											net_weight: null,
											security_movement_envelope: "",
											assessment:
												memBag.determination !== "pending"
													? {
															id: 0,
															determination: memBag.determination,
															determination_display: memBag.determination,
															is_cannabis: false,
															assessment_date: null,
															botanist_notes: null,
															created_at: "",
															updated_at: "",
														}
													: null,
											created_at: "",
											updated_at: "",
										} satisfies DrugBag
									}
									allTags={allTags}
									onUpdateBag={(_id, data) => {
										const updates = data as Record<string, unknown>;
										for (const [key, val] of Object.entries(updates)) {
											handleInMemoryUpdate(
												memBag.tempId,
												key,
												String(val ?? "")
											);
										}
									}}
									onCreateAssessment={(_id, determination) => {
										handleInMemoryUpdate(
											memBag.tempId,
											"determination",
											determination
										);
									}}
									onUpdateAssessment={(_id, determination) => {
										handleInMemoryUpdate(
											memBag.tempId,
											"determination",
											determination
										);
									}}
									onDeleteBag={() => handleInMemoryDelete(memBag.tempId)}
									onConfirmUnsaved={async (data) => {
										if (!caseId) {
											toast.error("Cannot save bag — case not loaded yet");
											return;
										}
										try {
											const newBag = await createDrugBag({
												case: caseId,
												seal_tag_numbers: data.seal_tag_numbers,
												new_seal_tag_numbers: data.new_seal_tag_numbers || null,
												content_type: data.content_type,
											});
											// Create assessment with determination if not pending
											if (
												data.determination &&
												data.determination !== "pending" &&
												newBag?.id
											) {
												try {
													await createAssessmentMutation.mutateAsync({
														drugBagId: newBag.id,
														determination: data.determination,
													});
												} catch (assessErr) {
													console.error(
														"Assessment creation failed:",
														assessErr
													);
													toast.error(
														"Bag created but assessment failed — please set determination manually"
													);
												}
											}
											wrangler.removeBag(memBag.tempId);
										} catch {
											// Bag creation error toast handled by mutation
										}
									}}
									isUnsaved
								/>
							))}
						</div>
					</div>
				)}

				{/* Action buttons row */}
				<div className="flex flex-wrap items-center gap-2 pt-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleAddBag}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Bag
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setBulkModalOpen(true)}
					>
						<Layers className="mr-2 h-4 w-4" />
						Add Multiple
					</Button>
					{wrangler.state.bags.length > 0 && (
						<Button
							type="button"
							variant="default"
							size="sm"
							onClick={handleCreateAll}
							disabled={isCreating}
						>
							<Save className="mr-2 h-4 w-4" />
							{isCreating ? "Saving..." : "Save Changes"}
						</Button>
					)}
				</div>
			</SectionCard>

			{/* Notes Section — full width, no grid */}
			<SectionCard
				title="Notes"
				isComplete={
					typeof additionalNotes === "string" &&
					additionalNotes.trim().length >= 4
				}
				isInvalid={
					isTouched &&
					(typeof additionalNotes !== "string" ||
						additionalNotes.trim().length < 4)
				}
			>
				<div className="space-y-4">
					{/* Section C Notes */}
					<div className="space-y-2">
						<Label htmlFor="additional_notes">
							Additional Notes (Section C)
						</Label>
						<Textarea
							id="additional_notes"
							value={additionalNotes}
							onChange={(e) =>
								onFieldChange("additional_notes", e.target.value)
							}
							placeholder="Enter additional notes for the certificate (Section C)..."
							className="min-h-[120px] resize-y"
							aria-describedby="additional-notes-hint"
							required
						/>
						<p
							id="additional-notes-hint"
							className="text-xs text-muted-foreground"
						>
							These notes appear in section (c) of the certificate. Defaults to
							&quot;None&quot; if left unchanged.
						</p>
					</div>

					{/* Internal Comments */}
					<div className="space-y-2">
						<Label htmlFor="internal_comments">Internal Comments</Label>
						<Textarea
							id="internal_comments"
							value={internalComments}
							onChange={(e) =>
								onFieldChange("internal_comments", e.target.value)
							}
							placeholder="Add internal comments..."
							className="min-h-[120px] resize-y"
							aria-describedby="internal-comments-hint"
						/>
						<p
							id="internal-comments-hint"
							className="text-xs text-muted-foreground"
						>
							Not shown on certificate
						</p>
					</div>
				</div>
			</SectionCard>

			{/* Bulk Add Modal */}
			<BulkAddBagsModal
				open={bulkModalOpen}
				onOpenChange={setBulkModalOpen}
				existingTags={allTags}
				onAddBags={handleBulkAdd}
			/>
		</div>
	);
});
