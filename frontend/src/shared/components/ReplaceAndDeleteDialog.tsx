import { useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import type { RecordUsage } from "@/shared/types/record-usage.types";
import { describeRoles } from "@/shared/utils/record-usage.utils";

/** Props handed to the replacement picker the caller renders. */
export interface ReplacementPickerProps {
	id: string;
	value: number | null;
	onValueChange: (id: number | null) => void;
	error: boolean;
}

interface ReplaceAndDeleteDialogProps {
	/** Dialog title, e.g. "Delete police officer". */
	title: string;
	/** How the record is named to the user, e.g. "Jane Smith". */
	name: string;
	/** "officer", "station" or "defendant". */
	noun: string;
	recordId: number;
	usage?: RecordUsage;
	isLoadingUsage: boolean;
	usageError?: unknown;
	/** Administrators may also move complete cases. */
	isAdmin: boolean;
	isDeleting: boolean;
	renderPicker: (props: ReplacementPickerProps) => ReactNode;
	onConfirm: (replacementId: number | null) => void;
	onClose: () => void;
}

const plural = (count: number, word: string) =>
	`${count} ${word}${count === 1 ? "" : "s"}`;

/** "an officer", "a station". */
const withArticle = (word: string) =>
	`${/^[aeiou]/i.test(word) ? "an" : "a"} ${word}`;

/**
 * Confirms deleting an officer, station or defendant. When cases (or, for a
 * station, officers) still use the record, it lists them and asks for a
 * replacement, so deleting never leaves a case with missing details.
 */
export const ReplaceAndDeleteDialog = ({
	title,
	name,
	noun,
	recordId,
	usage,
	isLoadingUsage,
	usageError,
	isAdmin,
	isDeleting,
	renderPicker,
	onConfirm,
	onClose,
}: ReplaceAndDeleteDialogProps) => {
	const [replacementId, setReplacementId] = useState<number | null>(null);

	const cases = usage?.cases ?? [];
	const officers = usage?.officers ?? [];
	const inUse = cases.length > 0 || officers.length > 0;
	const sameRecord = replacementId === recordId;
	const blockedByComplete = !isAdmin && cases.some((c) => c.is_complete);
	const canConfirm =
		!!usage &&
		!isDeleting &&
		!blockedByComplete &&
		(!inUse || (replacementId !== null && !sameRecord));

	const usedBy = [
		cases.length > 0 ? plural(cases.length, "case") : null,
		officers.length > 0 ? plural(officers.length, "officer") : null,
	]
		.filter(Boolean)
		.join(" and ");

	const pickerId = `replacement-${noun}`;
	const pickerErrorId = `${pickerId}-error`;

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open && !isDeleting) onClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title={title}
				description="Deleting cannot be undone"
			>
				<div className="space-y-4">
					{/* Visible heading; the dialog's accessible title is set above. */}
					<div aria-hidden="true" className="pr-8">
						<p className="text-lg font-semibold">{title}</p>
						<p className="text-sm text-muted-foreground">
							Deleting cannot be undone
						</p>
					</div>
					{isLoadingUsage && (
						<p
							className="flex items-center gap-2 text-sm text-muted-foreground"
							role="status"
						>
							<Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
							Checking which cases use this {noun}...
						</p>
					)}

					{!isLoadingUsage && usageError != null && (
						<ErrorAlert
							error={usageError}
							title={`Could not check where this ${noun} is used`}
						/>
					)}

					{usage && !inUse && (
						<div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
							<AlertTriangle
								className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400"
								aria-hidden="true"
							/>
							<p className="text-sm text-red-900 dark:text-red-100">
								No cases use <strong>{name}</strong>, so nothing else changes.
								Are you sure you want to delete this {noun}?
							</p>
						</div>
					)}

					{usage && inUse && (
						<>
							<div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
								<AlertTriangle
									className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
									aria-hidden="true"
								/>
								<p className="text-sm text-amber-900 dark:text-amber-100">
									<strong>{name}</strong> is used by {usedBy}. Choose another{" "}
									{noun} to move them to. They are moved first, then {name} is
									deleted, so no case is left without {withArticle(noun)}.
								</p>
							</div>

							{cases.length > 0 && (
								<section aria-labelledby={`${pickerId}-cases`}>
									<h3
										id={`${pickerId}-cases`}
										className="mb-2 text-sm font-medium"
									>
										Cases that will change
									</h3>
									<ul className="max-h-48 divide-y overflow-y-auto rounded-md border text-sm">
										{cases.map((c) => (
											<li
												key={c.id}
												className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2"
											>
												<Link
													to={`/cases/${c.id}`}
													target="_blank"
													rel="noopener noreferrer"
													className="font-medium text-primary underline-offset-4 hover:underline focus-visible:underline"
												>
													{c.case_number || `Case #${c.id}`}
													<span className="sr-only"> (opens in a new tab)</span>
												</Link>
												<span className="text-muted-foreground">
													{describeRoles(c.roles)} · {c.status_display}
												</span>
											</li>
										))}
									</ul>
								</section>
							)}

							{officers.length > 0 && (
								<section aria-labelledby={`${pickerId}-officers`}>
									<h3
										id={`${pickerId}-officers`}
										className="mb-2 text-sm font-medium"
									>
										Officers based here, who will move to the new station
									</h3>
									<ul className="max-h-32 divide-y overflow-y-auto rounded-md border text-sm">
										{officers.map((o) => (
											<li key={o.id} className="px-3 py-2">
												{o.full_name}
											</li>
										))}
									</ul>
								</section>
							)}

							{blockedByComplete ? (
								<p
									className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
									role="alert"
								>
									Some of these cases are complete, so only an administrator can
									move them and delete this {noun}.
								</p>
							) : (
								<div className="space-y-2">
									<Label htmlFor={pickerId}>Replace with</Label>
									{renderPicker({
										id: pickerId,
										value: replacementId,
										onValueChange: setReplacementId,
										error: sameRecord,
									})}
									{sameRecord && (
										<p
											id={pickerErrorId}
											className="text-sm text-destructive"
											role="alert"
										>
											Choose a different {noun} from the one being deleted.
										</p>
									)}
									{cases.length > 0 && (
										<p className="text-sm text-muted-foreground">
											Certificates already generated for these cases still show{" "}
											{name}. Regenerate them, or re-package their batch, if
											they need to show the change.
										</p>
									)}
								</div>
							)}
						</>
					)}

					<div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
						<Button variant="outline" onClick={onClose} disabled={isDeleting}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={() => onConfirm(inUse ? replacementId : null)}
							disabled={!canConfirm}
						>
							{isDeleting && (
								<Loader2
									className="mr-2 h-4 w-4 animate-spin"
									aria-hidden="true"
								/>
							)}
							{isDeleting
								? "Deleting..."
								: inUse
									? `Move ${usedBy} and delete`
									: `Delete ${noun}`}
						</Button>
					</div>
				</div>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
