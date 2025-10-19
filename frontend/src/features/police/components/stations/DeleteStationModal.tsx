import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { useDeleteStation } from "../../hooks/usePoliceStations";
import type { PoliceStation } from "@/shared/types/backend-api.types";

interface DeleteStationModalProps {
	isOpen: boolean;
	onClose: () => void;
	station: PoliceStation;
}

export function DeleteStationModal({
	isOpen,
	onClose,
	station,
}: DeleteStationModalProps) {
	const [isDeleting, setIsDeleting] = useState(false);
	const deleteStationMutation = useDeleteStation();

	const handleDelete = async () => {
		setIsDeleting(true);
		try {
			await deleteStationMutation.mutateAsync(station.id);
			onClose();
		} catch (error) {
			// Error handling is done in the mutation hook
			console.error("Delete error:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	const hasOfficers = (station.officer_count || 0) > 0;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<AlertTriangle className="h-5 w-5 text-red-500" />
						Delete Police Station
					</DialogTitle>
					<DialogDescription className="space-y-2">
						<p>
							Are you sure you want to delete{" "}
							<strong>{station.name}</strong>?
						</p>
						{hasOfficers ? (
							<div className="p-3 bg-red-50 border border-red-200 rounded-md">
								<p className="text-sm text-red-800">
									<strong>Warning:</strong> This station has{" "}
									{station.officer_count} assigned officer
									{station.officer_count !== 1 ? "s" : ""}.
									You must reassign or remove all officers
									before deleting this station.
								</p>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">
								This action cannot be undone.
							</p>
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button
						variant="outline"
						onClick={onClose}
						disabled={isDeleting}
					>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={isDeleting || hasOfficers}
					>
						{isDeleting ? "Deleting..." : "Delete Station"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
