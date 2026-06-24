import { useState } from "react";
import { Trash2, Check, Pencil, Package } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import type {
	DrugBag,
	DrugBagUpdateRequest,
	BotanicalDetermination,
	DrugBagContentType,
} from "../../../types/drugBags.types";

const CONTENT_TYPE_OPTIONS: { value: DrugBagContentType; label: string }[] = [
	{ value: "plant", label: "Plant" },
	{ value: "plant_material", label: "Plant Material" },
	{ value: "cutting", label: "Cutting" },
	{ value: "stalk", label: "Stalk" },
	{ value: "stem", label: "Stem" },
	{ value: "seed", label: "Seed" },
	{ value: "seed_material", label: "Seed Material" },
	{ value: "unknown_seed", label: "Unknown Seed" },
	{ value: "seedling", label: "Seedling" },
	{ value: "head", label: "Head" },
	{ value: "rootball", label: "Rootball" },
	{ value: "poppy", label: "Poppy" },
	{ value: "poppy_plant", label: "Poppy Plant" },
	{ value: "poppy_capsule", label: "Poppy Capsule" },
	{ value: "poppy_head", label: "Poppy Head" },
	{ value: "poppy_seed", label: "Poppy Seed" },
	{ value: "mushroom", label: "Mushroom" },
	{ value: "tablet", label: "Tablet" },
	{ value: "unknown", label: "Unknown" },
];

const DETERMINATION_OPTIONS: {
	value: BotanicalDetermination;
	label: string;
}[] = [
	{ value: "pending", label: "Pending Assessment" },
	{ value: "cannabis_sativa", label: "Cannabis sativa" },
	{ value: "cannabis_indica", label: "Cannabis indica" },
	{ value: "cannabis_hybrid", label: "Cannabis hybrid" },
	{ value: "mixed", label: "Mixed" },
	{ value: "papaver_somniferum", label: "Papaver somniferum" },
	{ value: "degraded", label: "Degraded" },
	{ value: "not_cannabis", label: "Not Cannabis" },
	{ value: "unidentifiable", label: "Unidentifiable" },
	{ value: "inconclusive", label: "Inconclusive" },
];

const TAG_PATTERN = /^[a-zA-Z0-9\s\-]*$/;

const getContentTypeLabel = (value: DrugBagContentType): string =>
	CONTENT_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;

const getDeterminationLabel = (value: string): string =>
	DETERMINATION_OPTIONS.find((o) => o.value === value)?.label ?? value;

interface BagCardProps {
	bag: DrugBag;
	allTags: string[];
	onUpdateBag: (bagId: number, data: DrugBagUpdateRequest) => void;
	onCreateAssessment: (
		bagId: number,
		determination: BotanicalDetermination
	) => void;
	onUpdateAssessment: (
		assessmentId: number,
		determination: BotanicalDetermination
	) => void;
	onDeleteBag: (bagId: number) => void;
	onConfirmUnsaved?: (data: {
		seal_tag_numbers: string;
		new_seal_tag_numbers: string;
		content_type: DrugBagContentType;
		determination: BotanicalDetermination;
	}) => void;
	isUnsaved?: boolean;
}

export const BagCard = ({
	bag,
	allTags,
	onUpdateBag,
	onCreateAssessment,
	onUpdateAssessment,
	onDeleteBag,
	onConfirmUnsaved,
	isUnsaved = false,
}: BagCardProps) => {
	// Unsaved bags always start open; server-persisted start closed
	const [isEditing, setIsEditing] = useState(isUnsaved);
	const [originalTag, setOriginalTag] = useState(bag.seal_tag_numbers);
	const [newTag, setNewTag] = useState(bag.new_seal_tag_numbers ?? "");
	const [contentType, setContentType] = useState<DrugBagContentType>(
		bag.content_type
	);
	const [determination, setDetermination] = useState<BotanicalDetermination>(
		(bag.assessment?.determination as BotanicalDetermination) ?? "pending"
	);
	const [tagError, setTagError] = useState<string | null>(null);
	const [newTagError, setNewTagError] = useState<string | null>(null);

	const validateTagFormat = (
		value: string,
		fieldName: string
	): string | null => {
		if (value && !TAG_PATTERN.test(value)) {
			return `${fieldName} can only contain letters, numbers, spaces, and hyphens`;
		}
		return null;
	};

	const validateTagUniqueness = (value: string): boolean => {
		const formatErr = validateTagFormat(value, "Original tag");
		if (formatErr) {
			setTagError(formatErr);
			return false;
		}
		const otherTags = allTags.filter((tag) => tag !== bag.seal_tag_numbers);
		if (value && otherTags.includes(value)) {
			setTagError("This tag number is already in use");
			return false;
		}
		setTagError(null);
		return true;
	};

	const handleOriginalTagChange = (value: string) => {
		setOriginalTag(value);
		const err = validateTagFormat(value, "Original tag");
		if (err) setTagError(err);
		else setTagError(null);
	};

	const handleNewTagChange = (value: string) => {
		setNewTag(value);
		const err = validateTagFormat(value, "New tag");
		if (err) {
			setNewTagError(err);
		} else if (value && allTags.includes(value)) {
			setNewTagError("This tag number is already in use");
		} else if (value && value === originalTag) {
			setNewTagError("New tag must differ from original tag");
		} else {
			setNewTagError(null);
		}
	};

	const handleOriginalTagBlur = () => {
		validateTagUniqueness(originalTag);
	};

	const handleConfirm = () => {
		if (!validateTagUniqueness(originalTag)) return;

		if (isUnsaved && onConfirmUnsaved) {
			onConfirmUnsaved({
				seal_tag_numbers: originalTag,
				new_seal_tag_numbers: newTag,
				content_type: contentType,
				determination: determination,
			});
			return;
		}

		// For server-persisted bags: update fields
		const updates: DrugBagUpdateRequest = {};
		if (originalTag !== bag.seal_tag_numbers)
			updates.seal_tag_numbers = originalTag;
		if (newTag !== (bag.new_seal_tag_numbers ?? ""))
			updates.new_seal_tag_numbers = newTag || null;
		if (contentType !== bag.content_type) updates.content_type = contentType;

		if (Object.keys(updates).length > 0) {
			onUpdateBag(bag.id, updates);
		}

		// Persist determination change
		const currentDetermination = bag.assessment?.determination ?? "pending";
		if (determination !== currentDetermination && determination !== "pending") {
			if (bag.assessment) {
				onUpdateAssessment(bag.assessment.id, determination);
			} else {
				onCreateAssessment(bag.id, determination);
			}
		}

		// Close back to summary view
		setIsEditing(false);
	};

	// Validation state
	const hasTagFormatErrors = !!tagError || !!newTagError;
	const isPendingDetermination = !determination || determination === "pending";
	const isFormComplete = !!(
		originalTag.trim() &&
		newTag.trim() &&
		contentType &&
		!isPendingDetermination &&
		!hasTagFormatErrors
	);

	const cardClassName = isUnsaved
		? "rounded-lg border-2 border-dashed border-amber-400 p-4 bg-card relative"
		: "rounded-lg border p-4 bg-card";

	const originalTagId = `original-tag-${bag.id}`;
	const originalTagErrorId = `original-tag-error-${bag.id}`;
	const newTagId = `new-tag-${bag.id}`;
	const contentTypeId = `content-type-${bag.id}`;
	const determinationId = `determination-${bag.id}`;

	// ============================================================================
	// CLOSED STATE — Summary view
	// ============================================================================
	if (!isEditing) {
		return (
			<div className={cardClassName}>
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3 min-w-0">
						<Package className="h-5 w-5 text-muted-foreground shrink-0" />
						<div className="min-w-0">
							<div className="flex items-center gap-2 flex-wrap">
								<span className="font-medium text-sm truncate">
									{bag.seal_tag_numbers || "[No tag]"}
								</span>
								<span className="text-muted-foreground text-xs">→</span>
								<span className="text-sm text-muted-foreground truncate">
									{bag.new_seal_tag_numbers || "[No new tag]"}
								</span>
							</div>
							<div className="flex items-center gap-2 mt-1 flex-wrap">
								<Badge variant="outline" className="text-xs">
									{bag.content_type_display ||
										getContentTypeLabel(bag.content_type)}
								</Badge>
								<Badge
									variant="outline"
									className={`text-xs ${bag.assessment?.determination && bag.assessment.determination !== "pending" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
								>
									{bag.assessment?.determination_display ||
										getDeterminationLabel(
											bag.assessment?.determination ?? "pending"
										)}
								</Badge>
							</div>
						</div>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setIsEditing(true)}
							aria-label="Edit bag"
							className="h-9"
						>
							<Pencil className="mr-1 h-3.5 w-3.5" />
							Edit
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							onClick={() => onDeleteBag(bag.id)}
							aria-label="Delete bag"
							className="h-9"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</div>
		);
	}

	// ============================================================================
	// OPEN STATE — Form view
	// ============================================================================
	return (
		<div className={`${cardClassName} space-y-3`}>
			{isUnsaved && (
				<span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-amber-400" />
			)}

			{/* Original Tag */}
			<div className="space-y-1">
				<label htmlFor={originalTagId} className="text-sm font-medium">
					Original Tag
				</label>
				<Input
					id={originalTagId}
					value={originalTag}
					onChange={(e) => handleOriginalTagChange(e.target.value)}
					onBlur={handleOriginalTagBlur}
					aria-invalid={!!tagError}
					aria-describedby={tagError ? originalTagErrorId : undefined}
				/>
				{tagError && (
					<p
						id={originalTagErrorId}
						className="text-sm text-red-600"
						role="alert"
					>
						{tagError}
					</p>
				)}
			</div>

			{/* New Tag */}
			<div className="space-y-1">
				<label htmlFor={newTagId} className="text-sm font-medium">
					New Tag
				</label>
				<Input
					id={newTagId}
					value={newTag}
					onChange={(e) => handleNewTagChange(e.target.value)}
					aria-invalid={!!newTagError}
					aria-describedby={newTagError ? `${newTagId}-error` : undefined}
				/>
				{newTagError && (
					<p
						id={`${newTagId}-error`}
						className="text-sm text-red-600"
						role="alert"
					>
						{newTagError}
					</p>
				)}
			</div>

			{/* Content Type */}
			<div className="space-y-1">
				<label htmlFor={contentTypeId} className="text-sm font-medium">
					Content Type
				</label>
				<Select
					value={contentType}
					onValueChange={(value) => setContentType(value as DrugBagContentType)}
				>
					<SelectTrigger id={contentTypeId}>
						<SelectValue placeholder="Select content type" />
					</SelectTrigger>
					<SelectContent>
						{CONTENT_TYPE_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* Determination */}
			<div className="space-y-1">
				<label htmlFor={determinationId} className="text-sm font-medium">
					Determination
				</label>
				<Select
					value={determination}
					onValueChange={(value) =>
						setDetermination(value as BotanicalDetermination)
					}
				>
					<SelectTrigger id={determinationId}>
						<SelectValue placeholder="Select determination" />
					</SelectTrigger>
					<SelectContent>
						{DETERMINATION_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				{isPendingDetermination && (
					<p className="text-sm text-amber-600" role="alert">
						Please select a valid determination — &quot;Pending Assessment&quot;
						is not allowed
					</p>
				)}
			</div>

			{/* Action Buttons */}
			<div className="flex justify-end items-center gap-2">
				{!isUnsaved && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => {
							// Reset to original values and close
							setOriginalTag(bag.seal_tag_numbers);
							setNewTag(bag.new_seal_tag_numbers ?? "");
							setContentType(bag.content_type);
							setDetermination(
								(bag.assessment?.determination as BotanicalDetermination) ??
									"pending"
							);
							setTagError(null);
							setNewTagError(null);
							setIsEditing(false);
						}}
						className="h-9"
					>
						Cancel
					</Button>
				)}
				<Button
					type="button"
					variant="default"
					size="sm"
					onClick={handleConfirm}
					disabled={!isFormComplete}
					aria-label={isUnsaved ? "Confirm bag" : "Update bag"}
					className="h-9"
				>
					<Check className="mr-1 h-4 w-4" />
					{isUnsaved ? "Confirm" : "Update"}
				</Button>
				<Button
					type="button"
					variant="destructive"
					size="sm"
					onClick={() => onDeleteBag(bag.id)}
					aria-label="Delete bag"
					className="h-9"
				>
					<Trash2 className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};
