import { useNavigate, useParams } from "react-router";
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
import { useDefendantById, useDeleteDefendant } from "../hooks/useDefendants";
import { DefendantsService } from "../services/defendants.service";

export const DeleteDefendantRouteModal = () => {
	const navigate = useNavigate();
	const { defendantId } = useParams<{ defendantId: string }>();
	const deleteDefendant = useDeleteDefendant();

	const defendantIdNum = defendantId ? parseInt(defendantId, 10) : null;
	const { data: defendant, isLoading } = useDefendantById(defendantIdNum);

	const handleClose = () => {
		navigate("/defendants");
	};

	const handleDelete = async () => {
		if (!defendantIdNum) return;

		try {
			await deleteDefendant.mutateAsync(defendantIdNum);
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Failed to delete defendant:", error);
		}
	};

	if (isLoading) {
		return (
			<AlertDialog open={true} onOpenChange={handleClose}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Defendant</AlertDialogTitle>
						<AlertDialogDescription>
							Loading defendant information...
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleClose}>
							Cancel
						</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	if (!defendant) {
		return (
			<AlertDialog open={true} onOpenChange={handleClose}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Defendant Not Found</AlertDialogTitle>
						<AlertDialogDescription>
							The requested defendant could not be found.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleClose}>
							Close
						</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	const canDelete = DefendantsService.canDeleteDefendant(defendant);
	const warningMessage =
		DefendantsService.getDeletionWarningMessage(defendant);

	return (
		<AlertDialog open={true} onOpenChange={handleClose}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Defendant</AlertDialogTitle>
					<AlertDialogDescription>
						{canDelete ? (
							<>
								Are you sure you want to delete{" "}
								<strong>{defendant.full_name}</strong>? This
								action cannot be undone.
							</>
						) : (
							<>
								<strong className="text-destructive">
									Cannot delete defendant
								</strong>
								<br />
								{warningMessage}
							</>
						)}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel onClick={handleClose}>
						Cancel
					</AlertDialogCancel>
					{canDelete && (
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							disabled={deleteDefendant.isPending}
						>
							{deleteDefendant.isPending
								? "Deleting..."
								: "Delete"}
						</AlertDialogAction>
					)}
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
