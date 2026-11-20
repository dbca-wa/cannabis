import { useState } from "react";
import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import {
	useDeleteStation,
	useStation,
	useStationUsage,
} from "../../hooks/usePoliceStations";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { ReplaceAndDeleteDialog } from "@/shared/components/ReplaceAndDeleteDialog";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { StationSearchComboBox } from "./StationSearchComboBox";

export const DeleteStationRouteModal = () => {
	const navigate = useNavigate();
	const { stationId } = useParams();
	const id = stationId ? parseInt(stationId, 10) : 0;
	// Once deletion starts, stop refetching the record being deleted.
	const [deleting, setDeleting] = useState(false);
	const { isAdmin } = useAuth();
	const deleteStationMutation = useDeleteStation();
	const { data: station, isLoading, error } = useStation(id, !deleting);
	const usage = useStationUsage(id || null, !deleting);

	const handleClose = () => {
		navigate("/stations");
	};

	const handleDelete = async (replacementId: number | null) => {
		if (!id) return;
		setDeleting(true);
		try {
			await deleteStationMutation.mutateAsync({ id, replacementId });
			handleClose();
		} catch {
			setDeleting(false);
			// The mutation shows the error.
		}
	};

	if (isLoading) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Loading..." description="">
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
				<ResponsiveModalContent side="bottom" title="Error" description="">
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
		<ReplaceAndDeleteDialog
			title="Delete police station"
			name={station.name}
			noun="station"
			recordId={station.id}
			usage={usage.data}
			isLoadingUsage={usage.isLoading}
			usageError={usage.error}
			isAdmin={isAdmin}
			isDeleting={deleteStationMutation.isPending}
			renderPicker={(picker) => (
				<StationSearchComboBox
					id={picker.id}
					value={picker.value}
					onValueChange={picker.onValueChange}
					error={picker.error}
					placeholder="Search for a station..."
				/>
			)}
			onConfirm={handleDelete}
			onClose={handleClose}
		/>
	);
};
