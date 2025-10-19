import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import { useDeleteStation, useStation } from "../../hooks/usePoliceStations";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle } from "lucide-react";

export const DeleteStationRouteModal = () => {
	const navigate = useNavigate();
	const { stationId } = useParams();
	const deleteStationMutation = useDeleteStation();

	// Fetch station data
	const {
		data: station,
		isLoading,
		error,
	} = useStation(stationId ? parseInt(stationId) : 0);

	const handleClose = () => {
		navigate("/police/stations");
	};

	const handleDelete = async () => {
		if (!stationId) return;

		try {
			await deleteStationMutation.mutateAsync(parseInt(stationId));
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Delete station error:", error);
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
					<PageLoading text="Loading station details..." />
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	if (error || !station) {
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
						error={error || "Station not found"}
						title="Failed to load station"
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
				title="Delete Police Station"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					<div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-red-600" />
						<div>
							<p className="font-medium text-red-900">
								Are you sure you want to delete this station?
							</p>
							<p className="text-sm text-red-700 mt-1">
								Station: {station.name}
								{station.officer_count > 0 && (
									<span className="block text-red-800 font-medium">
										Warning: This station has{" "}
										{station.officer_count} assigned
										officer(s)
									</span>
								)}
							</p>
						</div>
					</div>

					<div className="flex gap-3 justify-end">
						<Button
							variant="outline"
							onClick={handleClose}
							disabled={deleteStationMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							variant="destructive"
							onClick={handleDelete}
							disabled={deleteStationMutation.isPending}
						>
							{deleteStationMutation.isPending
								? "Deleting..."
								: "Delete Station"}
						</Button>
					</div>
				</div>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
