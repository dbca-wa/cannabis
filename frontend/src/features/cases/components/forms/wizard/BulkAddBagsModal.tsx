import { useState, useCallback, useId, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/shared/components/ui/dialog";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import type {
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

interface BulkAddBagsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	existingTags: string[];
	onAddBags: (
		bags: Array<{
			seal_tag_numbers: string;
			content_type: DrugBagContentType;
			determination: BotanicalDetermination;
		}>
	) => void;
}

interface BulkBagEntry {
	id: string;
	seal_tag_numbers: string;
	content_type: DrugBagContentType;
	determination: BotanicalDetermination;
	tagError: string | null;
}

export const BulkAddBagsModal = ({
	open,
	onOpenChange,
	existingTags,
	onAddBags,
}: BulkAddBagsModalProps) => {
	const instanceId = useId();
	const [count, setCount] = useState(1);
	const [entries, setEntries] = useState<BulkBagEntry[]>([]);

	// Reset state every time the modal opens fresh
	useEffect(() => {
		if (open) {
			setCount(1);
			setEntries([
				{
					id: `${instanceId}-0`,
					seal_tag_numbers: "",
					content_type: "plant",
					determination: "pending",
					tagError: null,
				},
			]);
		}
	}, [open, instanceId]);

	const regenerateEntries = useCallback(
		(newCount: number) => {
			const newEntries: BulkBagEntry[] = [];
			for (let i = 0; i < newCount; i++) {
				newEntries.push({
					id: `${instanceId}-${i}`,
					seal_tag_numbers: "",
					content_type: "plant",
					determination: "pending",
					tagError: null,
				});
			}
			setEntries(newEntries);
		},
		[instanceId]
	);

	const handleCountChange = (value: string) => {
		const parsed = Math.min(50, Math.max(1, Number(value) || 1));
		setCount(parsed);
		regenerateEntries(parsed);
	};

	const handleSetAllDeterminations = (value: string) => {
		setEntries((prev) =>
			prev.map((entry) => ({
				...entry,
				determination: value as BotanicalDetermination,
			}))
		);
	};

	const TAG_PATTERN = /^[a-zA-Z0-9\s\-]*$/;

	const handleEntryTagChange = (entryId: string, newTag: string) => {
		setEntries((prev) =>
			prev.map((entry) => {
				if (entry.id !== entryId) return entry;
				const formatErr =
					newTag && !TAG_PATTERN.test(newTag)
						? "Only letters, numbers, spaces, and hyphens allowed"
						: null;
				return { ...entry, seal_tag_numbers: newTag, tagError: formatErr };
			})
		);
	};

	const handleEntryTagBlur = (entryId: string) => {
		setEntries((prev) => {
			const updated = [...prev];
			const idx = updated.findIndex((e) => e.id === entryId);
			if (idx === -1) return prev;

			// Skip uniqueness check if format error already present
			if (updated[idx].tagError) return prev;

			const tag = updated[idx].seal_tag_numbers;
			const otherEntryTags = updated
				.filter((_, i) => i !== idx)
				.map((e) => e.seal_tag_numbers);
			const allOtherTags = [...existingTags, ...otherEntryTags];

			if (tag && allOtherTags.includes(tag)) {
				updated[idx] = {
					...updated[idx],
					tagError: "This tag number is already in use",
				};
			} else {
				updated[idx] = { ...updated[idx], tagError: null };
			}
			return updated;
		});
	};

	const handleEntryContentTypeChange = (entryId: string, value: string) => {
		setEntries((prev) =>
			prev.map((entry) =>
				entry.id === entryId
					? { ...entry, content_type: value as DrugBagContentType }
					: entry
			)
		);
	};

	const handleEntryDeterminationChange = (entryId: string, value: string) => {
		setEntries((prev) =>
			prev.map((entry) =>
				entry.id === entryId
					? { ...entry, determination: value as BotanicalDetermination }
					: entry
			)
		);
	};

	const hasErrors = entries.some((e) => e.tagError !== null);

	const handleAddAll = () => {
		if (hasErrors) return;

		const bags = entries.map((entry) => ({
			seal_tag_numbers: entry.seal_tag_numbers,
			content_type: entry.content_type,
			determination: entry.determination,
		}));

		onAddBags(bags);
		onOpenChange(false);
	};

	const countInputId = `${instanceId}-count`;
	const setAllId = `${instanceId}-set-all`;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add Multiple Bags</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Count input */}
					<div className="space-y-1">
						<label htmlFor={countInputId} className="text-sm font-medium">
							Number of bags to add
						</label>
						<Input
							id={countInputId}
							type="number"
							min={1}
							max={50}
							value={count}
							onChange={(e) => handleCountChange(e.target.value)}
						/>
					</div>

					{/* Set all determinations */}
					<div className="space-y-1">
						<label htmlFor={setAllId} className="text-sm font-medium">
							Set all determinations to...
						</label>
						<Select onValueChange={handleSetAllDeterminations}>
							<SelectTrigger id={setAllId}>
								<SelectValue placeholder="Choose determination for all" />
							</SelectTrigger>
							<SelectContent>
								{DETERMINATION_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{/* Scrollable bag entries */}
					<div className="max-h-[400px] overflow-y-auto space-y-3 rounded-md border p-3">
						{entries.map((entry, index) => {
							const tagId = `${instanceId}-tag-${index}`;
							const tagErrorId = `${instanceId}-tag-error-${index}`;
							const contentId = `${instanceId}-content-${index}`;
							const detId = `${instanceId}-det-${index}`;

							return (
								<div
									key={entry.id}
									className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-3"
								>
									{/* Tag input */}
									<div className="space-y-1">
										<label htmlFor={tagId} className="text-xs font-medium">
											Tag
										</label>
										<Input
											id={tagId}
											value={entry.seal_tag_numbers}
											onChange={(e) =>
												handleEntryTagChange(entry.id, e.target.value)
											}
											onBlur={() => handleEntryTagBlur(entry.id)}
											aria-invalid={!!entry.tagError}
											aria-describedby={entry.tagError ? tagErrorId : undefined}
											className="text-sm"
										/>
										{entry.tagError && (
											<p
												id={tagErrorId}
												className="text-xs text-red-600"
												role="alert"
											>
												{entry.tagError}
											</p>
										)}
									</div>

									{/* Content type select */}
									<div className="space-y-1">
										<label htmlFor={contentId} className="text-xs font-medium">
											Content Type
										</label>
										<Select
											value={entry.content_type}
											onValueChange={(v) =>
												handleEntryContentTypeChange(entry.id, v)
											}
										>
											<SelectTrigger id={contentId} className="text-sm">
												<SelectValue placeholder="Content type" />
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

									{/* Determination select */}
									<div className="space-y-1">
										<label htmlFor={detId} className="text-xs font-medium">
											Determination
										</label>
										<Select
											value={entry.determination}
											onValueChange={(v) =>
												handleEntryDeterminationChange(entry.id, v)
											}
										>
											<SelectTrigger id={detId} className="text-sm">
												<SelectValue placeholder="Determination" />
											</SelectTrigger>
											<SelectContent>
												{DETERMINATION_OPTIONS.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				<DialogFooter>
					<Button
						type="button"
						variant="outline"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button type="button" onClick={handleAddAll} disabled={hasErrors}>
						Add All
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
