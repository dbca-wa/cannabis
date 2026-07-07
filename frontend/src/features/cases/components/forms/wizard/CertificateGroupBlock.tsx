import { useState } from "react";
import { motion } from "motion/react";
import { FileText, GripVertical, MoveRight } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { cn } from "@/shared/utils/style.utils";
import { BagCard } from "./BagCard";
import type {
	DrugBag,
	DrugBagUpdateRequest,
	BotanicalDetermination,
} from "../../../types/drugBags.types";

const MAX_BAGS = 5;

interface CertificateGroupBlockProps {
	groupIndex: number;
	/** Bags in this certificate group, resolved and ordered */
	bags: DrugBag[];
	/** Sizes of every group, used to gate move targets at the 5-bag cap */
	groupSizes: number[];
	onMoveBag: (bagId: number, targetIndex: number) => void;
	onUpdateBag: (
		bagId: number,
		data: DrugBagUpdateRequest
	) => void | Promise<void>;
	onCreateAssessment: (
		bagId: number,
		determination: BotanicalDetermination
	) => void;
	onUpdateAssessment: (
		assessmentId: number,
		determination: BotanicalDetermination
	) => void;
	onDeleteBag: (bagId: number) => void | Promise<void>;
	/** Whether this certificate is the one currently shown in the preview */
	isActive?: boolean;
	/** Focus this certificate (syncs the preview navigator) */
	onActivate?: () => void;
	/** Section C notes for this certificate */
	notes: string;
	onNotesChange: (notes: string) => void;
}

/**
 * A single certificate block on the Assessment step. Holds up to five drug bags
 * and is both a drag-drop target and the home of the per-bag "Move to" control,
 * so bags can be regrouped into other certificates (or a new one).
 */
export const CertificateGroupBlock = ({
	groupIndex,
	bags,
	groupSizes,
	onMoveBag,
	onUpdateBag,
	onCreateAssessment,
	onUpdateAssessment,
	onDeleteBag,
	isActive = false,
	onActivate,
	notes,
	onNotesChange,
}: CertificateGroupBlockProps) => {
	const [isDragOver, setIsDragOver] = useState(false);
	const isFull = bags.length >= MAX_BAGS;

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
		const raw = e.dataTransfer.getData("text/plain");
		const bagId = Number(raw);
		if (bagId) onMoveBag(bagId, groupIndex);
	};

	return (
		<div
			onDragOver={(e) => {
				e.preventDefault();
				setIsDragOver(true);
			}}
			onDragLeave={() => setIsDragOver(false)}
			onDrop={handleDrop}
			className={cn(
				"rounded-xl border-2 p-4 transition-colors",
				isDragOver
					? "border-blue-400 bg-blue-50/60 dark:bg-blue-950/30"
					: isActive
						? "border-blue-300 bg-blue-50/40 ring-1 ring-blue-300 dark:border-blue-700 dark:bg-blue-950/20 dark:ring-blue-700"
						: "border-border bg-muted/20"
			)}
		>
			<div className="mb-3 flex items-center justify-between">
				<button
					type="button"
					onClick={onActivate}
					aria-pressed={isActive}
					className="-mx-1 flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5"
					title="Show this certificate in the preview"
				>
					<FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
					<span className="text-sm font-semibold text-blue-600 no-underline hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
						Certificate {groupIndex + 1}
					</span>
					{isActive && (
						<span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">
							• previewing
						</span>
					)}
				</button>
				<Badge
					variant="outline"
					className={cn(
						"tabular-nums",
						isFull
							? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
							: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
					)}
				>
					{bags.length}/{MAX_BAGS} bags
				</Badge>
			</div>

			<div className="flex flex-col gap-3">
				{bags.map((bag) => (
					<motion.div
						key={bag.id}
						layout
						transition={{ type: "spring", stiffness: 500, damping: 40 }}
						data-bag-row
						className="flex items-start gap-2"
					>
						<div className="flex flex-col items-center gap-1 pt-3">
							<span
								draggable
								onDragStart={(e) => {
									e.dataTransfer.setData("text/plain", String(bag.id));
									e.dataTransfer.effectAllowed = "move";
									// Use the bag card itself as the drag image so the user
									// drags a clear copy of the card, not a tiny grip icon.
									const row = (e.currentTarget as HTMLElement).closest(
										"[data-bag-row]"
									);
									const card = row?.querySelector(
										"[data-bag-card]"
									) as HTMLElement | null;
									if (card) e.dataTransfer.setDragImage(card, 24, 24);
								}}
								className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
								aria-hidden="true"
								title="Drag to another certificate"
							>
								<GripVertical className="h-4 w-4" />
							</span>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										className="h-7 w-7 cursor-pointer"
										aria-label={`Move bag ${bag.seal_tag_numbers} to another certificate`}
									>
										<MoveRight className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start">
									<DropdownMenuLabel>Move to</DropdownMenuLabel>
									{groupSizes.map((size, targetIndex) => {
										if (targetIndex === groupIndex) return null;
										return (
											<DropdownMenuItem
												key={targetIndex}
												className="cursor-pointer"
												onClick={() => onMoveBag(bag.id, targetIndex)}
											>
												Certificate {targetIndex + 1} ({size}/{MAX_BAGS})
											</DropdownMenuItem>
										);
									})}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
						<div data-bag-card className="min-w-0 flex-1">
							<BagCard
								bag={bag}
								onUpdateBag={onUpdateBag}
								onCreateAssessment={onCreateAssessment}
								onUpdateAssessment={onUpdateAssessment}
								onDeleteBag={onDeleteBag}
							/>
						</div>
					</motion.div>
				))}
			</div>

			<div className="mt-3 space-y-1">
				<Label htmlFor={`cert-notes-${groupIndex}`} className="text-xs">
					Section C notes for this certificate
				</Label>
				<Textarea
					id={`cert-notes-${groupIndex}`}
					value={notes}
					onChange={(e) => onNotesChange(e.target.value)}
					placeholder="Additional notes for this certificate (Section C). Defaults to 'None'."
					className="min-h-[72px] resize-y text-sm"
				/>
			</div>
		</div>
	);
};
