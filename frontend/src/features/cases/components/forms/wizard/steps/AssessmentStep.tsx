import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Package, Plus, Layers, Save, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";
import {
	getErrorMessage,
	isAxiosErrorResponse,
} from "@/shared/utils/error.utils";

import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import {
	useDrugBagWranglerStore,
	useCertificateGroupingStore,
} from "@/app/providers/store.provider";
import type { CertGroup } from "@/app/stores/derived/certificate-grouping.store";
import type { BagValidationError } from "@/app/stores/derived/drug-bag-wrangler.store";
import { SectionCard } from "../SectionCard";
import { BagCard } from "../BagCard";
import { CertificateGroupBlock } from "../CertificateGroupBlock";
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

const MAX_BAGS = 5;

/** Build certificate groups (bag ids + notes) from the grouping store, with a
 * fallback to auto-chunking by five before the store has been seeded. */
const buildGroups = (
	serverBags: DrugBag[],
	storeGroups: CertGroup[]
): CertGroup[] => {
	const ids = serverBags.map((b) => b.id);
	if (storeGroups.length > 0) {
		const known = new Set(ids);
		const groups: CertGroup[] = storeGroups
			.map((g) => ({
				bagIds: g.bagIds.filter((id) => known.has(id)),
				notes: g.notes,
			}))
			.filter((g) => g.bagIds.length > 0);
		const grouped = new Set(groups.flatMap((g) => g.bagIds));
		const leftovers = ids.filter((id) => !grouped.has(id));
		for (let i = 0; i < leftovers.length; i += MAX_BAGS) {
			groups.push({ bagIds: leftovers.slice(i, i + MAX_BAGS), notes: "" });
		}
		return groups;
	}
	const groups: CertGroup[] = [];
	for (let i = 0; i < ids.length; i += MAX_BAGS) {
		groups.push({ bagIds: ids.slice(i, i + MAX_BAGS), notes: "" });
	}
	return groups;
};

/**
 * Map a backend batch-create error of the shape
 * `{ bags: [{ seal_tag_numbers: ["..."], ... }, ...] }` to per-bag validation
 * errors, aligned by index with the bags that were submitted, so the matching
 * unsaved bag sections get highlighted.
 */
const mapBatchErrorsToBags = (
	error: unknown,
	bags: { tempId: string }[]
): BagValidationError[] => {
	if (!isAxiosErrorResponse(error)) return [];
	const data = error.response?.data as { bags?: unknown } | undefined;
	const bagErrors = data?.bags;
	if (!Array.isArray(bagErrors)) return [];

	const mapped: BagValidationError[] = [];
	bagErrors.forEach((entry, index) => {
		const bag = bags[index];
		if (!bag || !entry || typeof entry !== "object") return;
		for (const [field, messages] of Object.entries(
			entry as Record<string, unknown>
		)) {
			const list = Array.isArray(messages) ? messages : [messages];
			for (const message of list) {
				mapped.push({ tempId: bag.tempId, field, message: String(message) });
			}
		}
	});
	return mapped;
};

/**
 * Assessment step — Approved Botanist selection, drug bags organised into
 * certificate groups (max five bags each, drag-and-drop or "Move to" between
 * certificates), and the case notes.
 */
export const AssessmentStep = observer(function AssessmentStep({
	caseData,
	caseId,
	isTouched,
	onFieldChange,
}: AssessmentStepProps) {
	const [bulkModalOpen, setBulkModalOpen] = useState(false);
	const wrangler = useDrugBagWranglerStore();
	const grouping = useCertificateGroupingStore();
	const queryClient = useQueryClient();

	const {
		createDrugBag,
		updateDrugBag,
		deleteDrugBag,
		batchCreateDrugBags,
		isBatchCreating,
	} = useDrugBags(caseId || null);

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
			await invalidateRelatedQueries(queryClient, "botanicalAssessments");
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
			await invalidateRelatedQueries(queryClient, "botanicalAssessments");
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
	const internalComments =
		typeof caseData?.internal_comments === "string"
			? caseData.internal_comments
			: "";

	const allTags = [
		...serverBags.map((b) => b.seal_tag_numbers),
		...wrangler.state.bags.map((b) => b.seal_tag_numbers),
	];

	// Certificate groups of saved bags
	const bagsById = new Map(serverBags.map((b) => [b.id, b]));
	const groups = buildGroups(serverBags, grouping.state.groups);
	const groupSizes = groups.map((g) => g.bagIds.length);

	const handleAddBag = () => wrangler.addBag();

	// Persist every prepared (in-memory) bag in one validated batch request.
	const handleAddAll = async () => {
		if (!caseId) {
			toast.error("Cannot save bags — case not loaded yet");
			return;
		}
		const serverTags = serverBags.map((b) => b.seal_tag_numbers);
		if (!wrangler.validate(serverTags)) {
			const affected = wrangler.errorsForBag.size;
			toast.error(
				`${affected} bag${affected !== 1 ? "s" : ""} need attention — see the highlighted issues below each unsaved bag.`
			);
			return;
		}
		try {
			await batchCreateDrugBags({
				caseId,
				data: {
					bags: wrangler.state.bags.map((b) => ({
						seal_tag_numbers: b.seal_tag_numbers,
						new_seal_tag_numbers: b.new_seal_tag_numbers || null,
						content_type: b.content_type,
						determination: b.determination,
					})),
				},
			});
			wrangler.clearBags();
		} catch (error) {
			// Surface backend tag conflicts against the matching bag sections.
			const mapped = mapBatchErrorsToBags(error, wrangler.state.bags);
			if (mapped.length > 0) {
				wrangler.setValidationErrors(mapped);
				const affected = new Set(mapped.map((m) => m.tempId)).size;
				toast.error(
					`${affected} bag${affected !== 1 ? "s" : ""} rejected — see the highlighted issues below each unsaved bag.`
				);
			} else {
				toast.error(`Failed to save bags: ${getErrorMessage(error)}`);
			}
		}
	};

	const handleBulkAdd = (
		bags: Array<{
			seal_tag_numbers: string;
			new_seal_tag_numbers: string;
			content_type: DrugBagContentType;
			determination: BotanicalDetermination;
		}>
	) => {
		wrangler.addBags(
			bags.map((b) => ({
				seal_tag_numbers: b.seal_tag_numbers,
				new_seal_tag_numbers: b.new_seal_tag_numbers,
				content_type: b.content_type,
				determination: b.determination,
			}))
		);
	};

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
	const handleMoveBag = (bagId: number, targetIndex: number) => {
		grouping.moveBag(bagId, targetIndex);
	};

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
	const handleInMemoryDelete = (tempId: string) => wrangler.removeBag(tempId);

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
						lastUsedKey="botanist"
					/>
					<p className="text-xs text-muted-foreground">
						The botanist who performed the botanical assessment
					</p>
				</div>
			</SectionCard>

			{/* Drug Bags Section */}
			<SectionCard
				title="Drug Bags & Certificates"
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
							{serverBags.length !== 1 ? "s" : ""} across {groups.length}{" "}
							certificate{groups.length !== 1 ? "s" : ""}
							{wrangler.state.bags.length > 0 &&
								`, ${wrangler.state.bags.length} unsaved`}
							. Each certificate holds up to {MAX_BAGS} bags — drag a bag or use
							its move control to regroup.
						</p>

						{/* Certificate group blocks (saved bags) */}
						{groups.map((group, index) => (
							<CertificateGroupBlock
								key={index}
								groupIndex={index}
								bags={
									group.bagIds
										.map((id) => bagsById.get(id))
										.filter(Boolean) as DrugBag[]
								}
								groupSizes={groupSizes}
								allTags={allTags}
								onMoveBag={handleMoveBag}
								onUpdateBag={handleUpdateBag}
								onCreateAssessment={handleCreateAssessment}
								onUpdateAssessment={handleUpdateAssessment}
								onDeleteBag={handleDeleteBag}
								isActive={index === grouping.state.activeIndex}
								onActivate={() => grouping.setActiveIndex(index)}
								notes={group.notes}
								onNotesChange={(v) => grouping.setNotes(index, v)}
							/>
						))}

						{/* Unsaved (in-memory) bags awaiting save */}
						{wrangler.state.bags.length > 0 && (
							<div className="space-y-3 rounded-xl border-2 border-dashed border-amber-300 p-4">
								<p className="text-sm font-medium text-amber-700 dark:text-amber-400">
									Unsaved bags — added to a certificate once saved
								</p>
								{wrangler.state.bags.map((memBag) => {
									const bagErrors =
										wrangler.errorsForBag.get(memBag.tempId) ?? [];
									return (
										<div key={memBag.tempId} className="space-y-1">
											<BagCard
												bag={
													{
														id: memBag.tempId as unknown as number,
														case: caseId,
														content_type: memBag.content_type,
														content_type_display: memBag.content_type,
														seal_tag_numbers: memBag.seal_tag_numbers,
														new_seal_tag_numbers:
															memBag.new_seal_tag_numbers || null,
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
												onCreateAssessment={(_id, determination) =>
													handleInMemoryUpdate(
														memBag.tempId,
														"determination",
														determination
													)
												}
												onUpdateAssessment={(_id, determination) =>
													handleInMemoryUpdate(
														memBag.tempId,
														"determination",
														determination
													)
												}
												onDeleteBag={() => handleInMemoryDelete(memBag.tempId)}
												onConfirmUnsaved={async (data) => {
													if (!caseId) {
														toast.error(
															"Cannot save bag — case not loaded yet"
														);
														return;
													}
													try {
														const newBag = await createDrugBag({
															case: caseId,
															seal_tag_numbers: data.seal_tag_numbers,
															new_seal_tag_numbers:
																data.new_seal_tag_numbers || null,
															content_type: data.content_type,
														});
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
															} catch {
																toast.error(
																	"Bag created but assessment failed — set determination manually"
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
											{bagErrors.length > 0 && (
												<ul className="ml-2 list-disc space-y-0.5 pl-4 text-xs text-red-600 dark:text-red-400">
													{bagErrors.map((err, i) => (
														<li key={i}>{err.message}</li>
													))}
												</ul>
											)}
										</div>
									);
								})}
							</div>
						)}
					</div>
				)}

				{/* Action buttons row */}
				<div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-5">
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
							onClick={handleAddAll}
							disabled={isBatchCreating}
						>
							<Save className="mr-2 h-4 w-4" />
							{isBatchCreating
								? "Saving..."
								: `Add All (${wrangler.state.bags.length})`}
						</Button>
					)}
					{wrangler.state.bags.length > 0 && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => wrangler.clearBags()}
							disabled={isBatchCreating}
							className="ml-auto text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Remove All Unsaved ({wrangler.state.bags.length})
						</Button>
					)}
				</div>
			</SectionCard>

			{/* Internal Comments — Section C notes are per certificate (above) */}
			<SectionCard
				title="Internal Comments"
				isComplete={true}
				isInvalid={false}
			>
				<div className="space-y-2">
					<Label htmlFor="internal_comments">Internal Comments</Label>
					<Textarea
						id="internal_comments"
						value={internalComments}
						onChange={(e) => onFieldChange("internal_comments", e.target.value)}
						placeholder="Add internal comments..."
						className="min-h-[120px] resize-y"
						aria-describedby="internal-comments-hint"
					/>
					<p
						id="internal-comments-hint"
						className="text-xs text-muted-foreground"
					>
						Not shown on the certificate. Section C notes are set per
						certificate above.
					</p>
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
