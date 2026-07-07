import { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { Package, Plus, Layers, Save, Trash2, Loader2 } from "lucide-react";
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
import { useDrugBagWranglerStore } from "@/app/providers/store.provider";
import type { BagValidationError } from "@/app/stores/derived/drug-bag-wrangler.store";
import { SectionCard } from "../SectionCard";
import { BagCard } from "../BagCard";
import { BulkAddBagsModal } from "../BulkAddBagsModal";
import { useDrugBags } from "../../../../hooks/useDrugBags";
import { addBagsToForm } from "../../../../services/forms.service";
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
	/** Callback to add a new Priority 3 form when none exists */
	onAddForm?: () => void;
}

const MAX_BAGS = 5;

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
 * Assessment step — Approved Botanist selection, form-scoped drug bags (max
 * five per form producing one certificate), and internal comments.
 */
export const AssessmentStep = observer(function AssessmentStep({
	caseData,
	caseId,
	isTouched,
	onFieldChange,
	onAddForm,
}: AssessmentStepProps) {
	const [bulkModalOpen, setBulkModalOpen] = useState(false);
	const wrangler = useDrugBagWranglerStore();
	const queryClient = useQueryClient();

	const formId = caseData?.formId as number;

	const { updateDrugBag, deleteDrugBag } = useDrugBags(caseId || null);

	// Form-scoped batch creation mutation
	const batchCreateMutation = useMutation({
		mutationFn: (data: {
			bags: Array<{
				seal_tag_numbers: string;
				new_seal_tag_numbers: string | null;
				content_type: DrugBagContentType;
				determination: BotanicalDetermination;
			}>;
		}) => addBagsToForm(formId, data),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["cases", "forms", formId],
			});
			await invalidateRelatedQueries(queryClient, "drugBags");
			toast.success("Bags saved successfully");
		},
	});

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

	// Local state for textareas to avoid flicker during debounced PATCH
	const serverNotes = (caseData?.additional_notes as string) ?? "";
	const [localNotes, setLocalNotes] = useState(serverNotes);
	useEffect(() => {
		setLocalNotes(serverNotes);
	}, [serverNotes, formId]);

	const serverComments = (caseData?.internal_comments as string) ?? "";
	const [localComments, setLocalComments] = useState(serverComments);
	useEffect(() => {
		setLocalComments(serverComments);
	}, [serverComments]);

	// ALL hooks above this line — early return AFTER all hooks
	if (!formId) {
		return (
			<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
				<Package className="mb-4 h-12 w-12 text-muted-foreground" />
				<p className="mb-2 text-sm font-medium">
					Add a Priority 3 form to begin recording drug bags.
				</p>
				<p className="mb-4 text-xs text-muted-foreground">
					Each form holds up to 5 drug bags and produces one certificate.
				</p>
				{onAddForm && (
					<Button type="button" onClick={onAddForm}>
						<Plus className="mr-2 h-4 w-4" />
						Add Priority 3 Form
					</Button>
				)}
			</div>
		);
	}

	// Derive data from caseData
	const serverBags: DrugBag[] = Array.isArray(caseData?.bags)
		? (caseData.bags as DrugBag[])
		: [];

	const totalBags = serverBags.length + wrangler.state.bags.length;
	const capReached = totalBags >= MAX_BAGS;

	const handleAddBag = () => wrangler.addBag();

	// Persist every prepared (in-memory) bag in one validated batch request.
	const handleAddAll = async () => {
		if (!formId) {
			toast.error("Cannot save bags — form not loaded yet");
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
			await batchCreateMutation.mutateAsync({
				bags: wrangler.state.bags.map((b) => ({
					seal_tag_numbers: b.seal_tag_numbers,
					new_seal_tag_numbers: b.new_seal_tag_numbers || null,
					content_type: b.content_type,
					determination: b.determination,
				})),
			});
			wrangler.clearBags(formId);
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
		const remaining = MAX_BAGS - serverBags.length - wrangler.state.bags.length;
		const capped = bags.slice(0, Math.max(0, remaining));
		if (capped.length < bags.length) {
			toast.info(
				`Only ${capped.length} of ${bags.length} bags added — this form holds at most ${MAX_BAGS} bags.`
			);
		}
		if (capped.length === 0) return;
		wrangler.addBags(
			capped.map((b) => ({
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
			{/* Drug Bags Section */}
			<SectionCard
				title="Priorty 3 Drug Bags"
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
							This form holds up to {MAX_BAGS} drug bags. All bags produce a
							single certificate.
							{serverBags.length > 0 &&
								` ${serverBags.length} saved bag${serverBags.length !== 1 ? "s" : ""}`}
							{wrangler.state.bags.length > 0 &&
								`, ${wrangler.state.bags.length} unsaved`}
							.
						</p>

						{capReached && (
							<p className="text-sm font-medium text-amber-700 dark:text-amber-400">
								This form can hold at most {MAX_BAGS} bags. Add a new Priorty 3
								Form to add more.
							</p>
						)}

						{/* Saved bags — flat list */}
						{serverBags.length > 0 && (
							<div className="space-y-3">
								{serverBags.map((bag) => (
									<BagCard
										key={bag.id}
										bag={bag}
										onUpdateBag={handleUpdateBag}
										onCreateAssessment={handleCreateAssessment}
										onUpdateAssessment={handleUpdateAssessment}
										onDeleteBag={handleDeleteBag}
									/>
								))}
							</div>
						)}

						{/* Unsaved (in-memory) bags awaiting save */}
						{wrangler.state.bags.length > 0 && (
							<div className="space-y-3 rounded-xl border-2 border-dashed border-amber-300 p-4">
								<p className="text-sm font-medium text-amber-700 dark:text-amber-400">
									Unsaved bags — saved to this form once confirmed
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
													if (!formId) {
														toast.error(
															"Cannot save bag — form not loaded yet"
														);
														return;
													}
													try {
														await batchCreateMutation.mutateAsync({
															bags: [
																{
																	seal_tag_numbers: data.seal_tag_numbers,
																	new_seal_tag_numbers:
																		data.new_seal_tag_numbers || null,
																	content_type: data.content_type,
																	determination: data.determination,
																},
															],
														});
														wrangler.removeBag(memBag.tempId);
													} catch {
														// Error toast handled by mutation
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
						disabled={capReached}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add Bag
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => setBulkModalOpen(true)}
						disabled={capReached}
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
							disabled={batchCreateMutation.isPending}
						>
							<Save className="mr-2 h-4 w-4" />
							{batchCreateMutation.isPending
								? "Saving..."
								: `Add All (${wrangler.state.bags.length})`}
						</Button>
					)}
					{wrangler.state.bags.length > 0 && (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => wrangler.clearBags(formId)}
							disabled={batchCreateMutation.isPending}
							className="ml-auto text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
						>
							<Trash2 className="mr-2 h-4 w-4" />
							Remove All Unsaved ({wrangler.state.bags.length})
						</Button>
					)}
				</div>
			</SectionCard>

			{/* Section C Notes (other matters for the certificate) */}
			<SectionCard title="Section C Notes" isComplete={true} isInvalid={false}>
				<div className="space-y-2">
					<Label htmlFor="additional_notes">Other Matters (Section C)</Label>
					<Textarea
						id="additional_notes"
						value={localNotes}
						onChange={(e) => {
							setLocalNotes(e.target.value);
							onFieldChange("additional_notes", e.target.value);
						}}
						placeholder="Enter section C notes for the certificate (e.g. subsample details)..."
						className="min-h-[100px] resize-y"
						aria-describedby="additional-notes-hint"
					/>
					<div className="flex items-center gap-2">
						{Boolean(caseData?._isSavingNotes) && (
							<span className="flex items-center gap-1 text-xs text-amber-600">
								<Loader2 className="h-3 w-3 animate-spin" />
								Saving...
							</span>
						)}
						<p
							id="additional-notes-hint"
							className="text-xs text-muted-foreground"
						>
							Shown on the certificate under &quot;Other Matters&quot;. Defaults
							to &quot;None&quot; if left empty.
						</p>
					</div>
				</div>
			</SectionCard>

			{/* Internal Comments */}
			<SectionCard
				title="Case Internal Comments"
				isComplete={true}
				isInvalid={false}
			>
				<div className="space-y-2">
					<Label htmlFor="internal_comments">Internal Comments</Label>
					<Textarea
						id="internal_comments"
						value={localComments}
						onChange={(e) => {
							setLocalComments(e.target.value);
							onFieldChange("internal_comments", e.target.value);
						}}
						placeholder="Add internal comments..."
						className="min-h-[120px] resize-y"
						aria-describedby="internal-comments-hint"
					/>
					<p
						id="internal-comments-hint"
						className="text-xs text-muted-foreground"
					>
						Not shown on the certificate.
					</p>
				</div>
			</SectionCard>

			{/* Bulk Add Modal */}
			<BulkAddBagsModal
				open={bulkModalOpen}
				onOpenChange={setBulkModalOpen}
				existingTags={[]}
				existingBagsOnForm={totalBags}
				onAddBags={handleBulkAdd}
			/>
		</div>
	);
});
