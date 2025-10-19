import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import {
	useDeletePoliceOfficer,
	usePoliceOfficer,
} from "../../hooks/usePoliceOfficers";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle } from "lucide-react";

export const DeleteOfficerRouteModal = () => {
	const navigate = useNavigate();
	const { officerId } = useParams();
	const deleteOfficerMutation = useDeletePoliceOfficer();

	// Fetch officer data
	const {
		data: officer,
		isLoading,
		error,
	} = usePoliceOfficer(officerId ? parseInt(officerId) : 0);

	const handleClose = () => {
		navigate("/police/officers");
	};

	const handleDelete = async () => {
		if (!officerId) return;

		try {
			await deleteOfficerMutation.mutateAsync(parseInt(officerId));
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Delete officer error:", error);
		}
	};

	if (isLoading) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent
					side="bottom"
					title="Loading..."
					description=""
				>
					<PageLoading text="Loading officer details..." />
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	if (error || !officer) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent
					side="bottom"
					title="Error"
					description=""
				>
					<ErrorAlert
						error={error || "Officer not found"}
						title="Failed to load officer"
						onDismiss={handleClose}
					/>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title="Delete Police Officer"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					<div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-red-600" />
						<div>
							<p className="font-medium text-red-900">
								Are you sure you want to delete this officer?
							</p>
							<p className="text-sm text-red-700 mt-1">
								Officer: {officer.full_name}
								{officer.badge_number &&
									` (Badge: ${officer.badge_number})`}
							</p>
						</div>
					</div>

					<div className="flex gap-3 justify-end">
						<Button
							variant="outline"
							onClick={handleClose}
							disabled={deleteOfficerMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteOfficerMutation.isPending}
						>
							{deleteOfficerMutation.isPending
								? "Deleting..."
								: "Delete Officer"}
						</Button>
					</div>
				</div>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
