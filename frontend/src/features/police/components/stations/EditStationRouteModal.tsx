import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import { EditStationForm } from "./EditStationForm";
import { useStation } from "../../hooks/usePoliceStations";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
export const EditStationRouteModal = () => {
	const navigate = useNavigate();
	const { stationId } = useParams();

	// Fetch station data
	const {
		data: station,
		isLoading,
		error,
	} = useStation(stationId ? parseInt(stationId) : 0);

	const handleClose = () => {
		navigate("/police/stations");
	};

	// The form handles the submission internally

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
				title="Edit Police Station"
				description="Update police station information"
			>
				<EditStationForm
					station={station}
					onSuccess={handleClose}
					onCancel={handleClose}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
