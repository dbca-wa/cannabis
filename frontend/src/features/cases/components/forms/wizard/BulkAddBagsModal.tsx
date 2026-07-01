/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useCallback, useId, useEffect, useMemo } from "react";
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
	{ value: "seed", label: "Seed" },
	{ value: "unknown", label: "Other" },
];

const DETERMINATION_OPTIONS: {
	value: BotanicalDetermination;
	label: string;
}[] = [
	{ value: "pending", label: "Pending Assessment" },
	{ value: "cannabis_sativa", label: "Cannabis sativa" },
	{ value: "degraded", label: "Degraded" },
	{ value: "inconclusive", label: "Inconclusive" },
	{ value: "not_cannabis", label: "Not Cannabis" },
];

// Defaults applied to every new bag entry — most cases are cannabis sativa, so
// pre-selecting these speeds up data entry (and is shown in the "set all"
// dropdowns when the modal opens).
const DEFAULT_CONTENT_TYPE: DrugBagContentType = "plant";
const DEFAULT_DETERMINATION: BotanicalDetermination = "cannabis_sativa";

interface BulkAddBagsModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	existingTags: string[];
	onAddBags: (
		bags: Array<{
			seal_tag_numbers: string;
			new_seal_tag_numbers: string;
			content_type: DrugBagContentType;
			determination: BotanicalDetermination;
		}>
	) => void;
}

interface BulkBagEntry {
	id: string;
	seal_tag_numbers: string;
	new_seal_tag_numbers: string;
	content_type: DrugBagContentType;
	determination: BotanicalDetermination;
}

const TAG_PATTERN = /^[a-zA-Z0-9\s-]*$/;

interface EntryError {
	tagError: string | null;
	newTagError: string | null;
}

/**
 * Validate every entry together. Each non-blank tag value (original or new)
 * shares one namespace: it must be unique across the existing case tags and all
 * other entry tags. A bag may repeat the same value for its original and new
 * tag (that is a single tag for that entry, not a duplicate). Returns an errors
 * array aligned by index with the entries.
 */
const computeEntryErrors = (
	entries: BulkBagEntry[],
	existingTags: string[]
): EntryError[] => {
	// Count how many times each non-blank value is claimed across existing tags
	// and every entry's original + new tag. A new tag equal to its own original
	// is the same physical tag for that entry, so it is not counted twice.
	const counts = new Map<string, number>();
	const bump = (value: string) => {
		const v = value.trim();
		if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
	};
	existingTags.forEach((t) => bump(t));
	for (const e of entries) {
		const orig = e.seal_tag_numbers.trim();
		const neu = e.new_seal_tag_numbers.trim();
		bump(orig);
		if (neu && neu !== orig) bump(neu);
	}

	return entries.map((e) => {
		const orig = e.seal_tag_numbers.trim();
		const neu = e.new_seal_tag_numbers.trim();
		let tagError: string | null = null;
		let newTagError: string | null = null;

		if (orig && !TAG_PATTERN.test(orig)) {
			tagError = "Only letters, numbers, spaces, and hyphens allowed";
		} else if (orig && (counts.get(orig) ?? 0) > 1) {
			tagError = "This tag number is already in use";
		}

		if (neu && !TAG_PATTERN.test(neu)) {
			newTagError = "Only letters, numbers, spaces, and hyphens allowed";
		} else if (neu && neu !== orig && (counts.get(neu) ?? 0) > 1) {
			newTagError = "This tag number is already in use";
		}

		return { tagError, newTagError };
	});
};

export const BulkAddBagsModal = ({
	open,
	onOpenChange,
	existingTags,
	onAddBags,
}: BulkAddBagsModalProps) => {
	const instanceId = useId();
	const [count, setCount] = useState(1);
	const [entries, setEntries] = useState<BulkBagEntry[]>([]);
	// Controlled values for the two "set all" dropdowns, so they visibly reflect
	// the defaults when the modal opens.
	const [setAllContentType, setSetAllContentType] =
		useState<DrugBagContentType>(DEFAULT_CONTENT_TYPE);
	const [setAllDetermination, setSetAllDetermination] =
		useState<BotanicalDetermination>(DEFAULT_DETERMINATION);

	// Reset state every time the modal opens fresh
	useEffect(() => {
		if (open) {
			setCount(1);
			setSetAllContentType(DEFAULT_CONTENT_TYPE);
			setSetAllDetermination(DEFAULT_DETERMINATION);
			setEntries([
				{
					id: `${instanceId}-0`,
					seal_tag_numbers: "",
					new_seal_tag_numbers: "",
					content_type: DEFAULT_CONTENT_TYPE,
					determination: DEFAULT_DETERMINATION,
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
					new_seal_tag_numbers: "",
					content_type: setAllContentType,
					determination: setAllDetermination,
				});
			}
			setEntries(newEntries);
		},
		[instanceId, setAllContentType, setAllDetermination]
	);

	const handleCountChange = (value: string) => {
		const parsed = Math.min(50, Math.max(1, Number(value) || 1));
		setCount(parsed);
		regenerateEntries(parsed);
	};

	const handleSetAllContentTypes = (value: string) => {
		setSetAllContentType(value as DrugBagContentType);
		setEntries((prev) =>
			prev.map((entry) => ({
				...entry,
				content_type: value as DrugBagContentType,
			}))
		);
	};

	const handleSetAllDeterminations = (value: string) => {
		setSetAllDetermination(value as BotanicalDetermination);
		setEntries((prev) =>
			prev.map((entry) => ({
				...entry,
				determination: value as BotanicalDetermination,
			}))
		);
	};

	const handleEntryTagChange = (entryId: string, value: string) => {
		setEntries((prev) =>
			prev.map((entry) =>
				entry.id === entryId ? { ...entry, seal_tag_numbers: value } : entry
			)
		);
	};

	const handleEntryNewTagChange = (entryId: string, value: string) => {
		setEntries((prev) =>
			prev.map((entry) =>
				entry.id === entryId ? { ...entry, new_seal_tag_numbers: value } : entry
			)
		);
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

	// Holistic validation across all entries + existing case tags.
	const entryErrors = useMemo(
		() => computeEntryErrors(entries, existingTags),
		[entries, existingTags]
	);
	const hasErrors = entryErrors.some(
		(e) => e.tagError !== null || e.newTagError !== null
	);

	const handleAddAll = () => {
		if (hasErrors) return;

		const bags = entries.map((entry) => ({
			seal_tag_numbers: entry.seal_tag_numbers,
			new_seal_tag_numbers: entry.new_seal_tag_numbers,
			content_type: entry.content_type,
			determination: entry.determination,
		}));

		onAddBags(bags);
		onOpenChange(false);
	};

	const countInputId = `${instanceId}-count`;
	const setAllId = `${instanceId}-set-all`;
	const setAllContentId = `${instanceId}-set-all-content`;

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

					{/* Set all content types */}
					<div className="space-y-1">
						<label htmlFor={setAllContentId} className="text-sm font-medium">
							Set all content types to...
						</label>
						<Select
							value={setAllContentType}
							onValueChange={handleSetAllContentTypes}
						>
							<SelectTrigger id={setAllContentId}>
								<SelectValue placeholder="Choose content type for all" />
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

					{/* Set all determinations */}
					<div className="space-y-1">
						<label htmlFor={setAllId} className="text-sm font-medium">
							Set all determinations to...
						</label>
						<Select
							value={setAllDetermination}
							onValueChange={handleSetAllDeterminations}
						>
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
							const newTagId = `${instanceId}-new-tag-${index}`;
							const newTagErrorId = `${instanceId}-new-tag-error-${index}`;
							const contentId = `${instanceId}-content-${index}`;
							const detId = `${instanceId}-det-${index}`;
							const entryError = entryErrors[index] ?? {
								tagError: null,
								newTagError: null,
							};

							return (
								<div
									key={entry.id}
									className="grid grid-cols-1 gap-3 rounded-lg border-2 border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/50 sm:grid-cols-2"
								>
									<p className="col-span-full text-sm font-semibold text-foreground">
										Bag {index + 1}
									</p>
									{/* Original tag input */}
									<div className="space-y-1">
										<label htmlFor={tagId} className="text-sm font-semibold">
											Original Tag
										</label>
										<Input
											id={tagId}
											value={entry.seal_tag_numbers}
											onChange={(e) =>
												handleEntryTagChange(entry.id, e.target.value)
											}
											aria-invalid={!!entryError.tagError}
											aria-describedby={
												entryError.tagError ? tagErrorId : undefined
											}
											className="text-base"
										/>
										{entryError.tagError && (
											<p
												id={tagErrorId}
												className="text-sm text-red-600 dark:text-red-400"
												role="alert"
											>
												{entryError.tagError}
											</p>
										)}
									</div>

									{/* New tag input */}
									<div className="space-y-1">
										<label htmlFor={newTagId} className="text-sm font-semibold">
											New Tag
										</label>
										<Input
											id={newTagId}
											value={entry.new_seal_tag_numbers}
											onChange={(e) =>
												handleEntryNewTagChange(entry.id, e.target.value)
											}
											aria-invalid={!!entryError.newTagError}
											aria-describedby={
												entryError.newTagError ? newTagErrorId : undefined
											}
											className="text-base"
										/>
										{entryError.newTagError && (
											<p
												id={newTagErrorId}
												className="text-sm text-red-600 dark:text-red-400"
												role="alert"
											>
												{entryError.newTagError}
											</p>
										)}
									</div>

									{/* Content type select */}
									<div className="space-y-1">
										<label
											htmlFor={contentId}
											className="text-sm font-semibold"
										>
											Content Type
										</label>
										<Select
											value={entry.content_type}
											onValueChange={(v) =>
												handleEntryContentTypeChange(entry.id, v)
											}
										>
											<SelectTrigger id={contentId} className="text-base">
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
										<label htmlFor={detId} className="text-sm font-semibold">
											Determination
										</label>
										<Select
											value={entry.determination}
											onValueChange={(v) =>
												handleEntryDeterminationChange(entry.id, v)
											}
										>
											<SelectTrigger id={detId} className="text-base">
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
