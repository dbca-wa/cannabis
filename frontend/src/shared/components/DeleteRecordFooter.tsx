import { Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

interface DeleteRecordFooterProps {
	/** "officer", "station" or "defendant". */
	noun: string;
	onDelete: () => void;
	disabled?: boolean;
}

/**
 * Sits under an edit form and opens the delete dialog, which shows the cases
 * that use the record and asks for a replacement.
 */
export const DeleteRecordFooter = ({
	noun,
	onDelete,
	disabled = false,
}: DeleteRecordFooterProps) => (
	<div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
		<p className="text-sm text-muted-foreground">
			No longer needed? Deleting moves any cases that use this {noun} to another
			one first.
		</p>
		<Button
			type="button"
			variant="outline"
			className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
			onClick={onDelete}
			disabled={disabled}
		>
			<Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
			Delete {noun}
		</Button>
	</div>
);
