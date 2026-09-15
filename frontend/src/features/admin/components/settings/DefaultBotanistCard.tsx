import { useState } from "react";
import { Leaf } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";

interface DefaultBotanistCardProps {
	/** Currently saved default, or null when unset. */
	value: number | null;
	/** Name of the saved default, for the confirmation line. */
	valueName: string | null;
	isSaving: boolean;
	onSave: (botanistId: number | null) => void;
}

/**
 * Sets the botanist pre-selected on new cases.
 *
 * Only affects cases created after the change — existing cases keep whichever
 * botanist they were assigned.
 */
export const DefaultBotanistCard = ({
	value,
	valueName,
	isSaving,
	onSave,
}: DefaultBotanistCardProps) => {
	// Holds only an unsaved choice. `undefined` means the user has not picked
	// anything yet, so the saved value shows through — which also means a
	// successful save clears the pending state for free, with no effect syncing
	// the prop into state.
	const [pending, setPending] = useState<number | null | undefined>(undefined);

	const selected = pending === undefined ? value : pending;
	const hasChanged = pending !== undefined && pending !== value;

	return (
		<Card className="p-6">
			<div className="mb-5 flex items-start gap-3">
				<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
					<Leaf className="h-5 w-5" />
				</div>
				<div>
					<h3>Default Botanist</h3>
					<p className="text-[13px] text-muted-foreground">
						Pre-selected as the approved botanist when a new case is created.
						Leave blank to choose one on every case.
					</p>
				</div>
			</div>

			<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
				<div className="flex-1 max-w-md">
					<Label
						htmlFor="default_approved_botanist"
						className="mb-1.5 block text-sm"
					>
						Approved Botanist
					</Label>
					<UserSearchCombobox
						value={selected}
						onValueChange={setPending}
						placeholder="Select a default botanist..."
						roleFilter="botanist"
					/>
				</div>
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						onClick={() => onSave(selected)}
						disabled={isSaving || !hasChanged}
					>
						Save
					</Button>
					{value !== null && (
						<Button
							size="sm"
							variant="outline"
							onClick={() => onSave(null)}
							disabled={isSaving}
						>
							Clear
						</Button>
					)}
				</div>
			</div>

			<p className="mt-3 text-xs text-muted-foreground">
				{value === null
					? "No default set — the botanist field starts blank on new cases."
					: `New cases will start with ${valueName ?? "the selected botanist"} assigned.`}{" "}
				Changing this never alters existing cases.
			</p>
		</Card>
	);
};
