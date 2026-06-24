import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface DiscardWizardModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	/** Title for the modal. Defaults to "Discard case?" */
	title?: string;
	/** Description for the modal. */
	description?: string;
	/** Label for the confirm button. Defaults to "Discard" */
	confirmLabel?: string;
}

/**
 * Confirmation modal shown when the user clicks Discard/Delete in the wizard.
 * Supports customisable text for both discard (creation) and delete (processing) contexts.
 */
export const DiscardWizardModal = ({
	open,
	onOpenChange,
	onConfirm,
	title = "Discard case?",
	description = "All unsaved progress will be lost and the draft case will be discarded. This action cannot be undone.",
	confirmLabel = "Discard",
}: DiscardWizardModalProps) => {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="sm:max-w-md">
				<AlertDialogHeader>
					<div className="flex items-center gap-3">
						<div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
							<AlertTriangle className="h-5 w-5 text-destructive" />
						</div>
						<AlertDialogTitle>{title}</AlertDialogTitle>
					</div>
					<AlertDialogDescription className="pt-2">
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="gap-2">
					<AlertDialogCancel className="cursor-pointer">
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-destructive text-white hover:bg-destructive/90 cursor-pointer"
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
