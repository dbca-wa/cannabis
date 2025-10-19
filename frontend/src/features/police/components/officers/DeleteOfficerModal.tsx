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
import { useDeletePoliceOfficer } from "../../hooks/usePoliceOfficers";
import type { PoliceOfficerTiny } from "@/shared/types/backend-api.types";

interface DeleteOfficerModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	officer: PoliceOfficerTiny;
}

export const DeleteOfficerModal = ({
	open,
	onOpenChange,
	officer,
}: DeleteOfficerModalProps) => {
	const deleteOfficerMutation = useDeletePoliceOfficer();

	const handleDelete = async () => {
		try {
			await deleteOfficerMutation.mutateAsync(officer.id);
			onOpenChange(false);
		} catch (error) {
			// Error handling is done in the mutation
			console.error("Failed to delete officer:", error);
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Officer</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete{" "}
						<span className="font-semibold">
							{officer.full_name}
						</span>
						{officer.badge_number && (
							<span> (Badge: {officer.badge_number})</span>
						)}
						? This action cannot be undone.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel
						disabled={deleteOfficerMutation.isPending}
					>
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						onClick={handleDelete}
						disabled={deleteOfficerMutation.isPending}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{deleteOfficerMutation.isPending
							? "Deleting..."
							: "Delete Officer"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
