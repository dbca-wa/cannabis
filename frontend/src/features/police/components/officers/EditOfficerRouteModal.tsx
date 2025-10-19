import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import { EditOfficerForm } from "./EditOfficerForm";
import {
	useUpdatePoliceOfficer,
	usePoliceOfficer,
} from "../../hooks/usePoliceOfficers";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";

export const EditOfficerRouteModal = () => {
	const navigate = useNavigate();
	const { officerId } = useParams();
	const updateOfficerMutation = useUpdatePoliceOfficer();

	// Fetch officer data
	const {
		data: officer,
		isLoading,
		error,
	} = usePoliceOfficer(officerId ? parseInt(officerId) : 0);

	const handleClose = () => {
		navigate("/police/officers");
	};

	const handleSubmit = async (data: unknown) => {
		if (!officerId) return;

		try {
			// Transform form data to API format
			const transformedData = {
				badge_number: data.badge_number || undefined,
				first_name: data.first_name || undefined,
				last_name: data.last_name,
				rank: data.rank,
				station: data.station ? parseInt(data.station) : undefined,
			};
			await updateOfficerMutation.mutateAsync({
				id: parseInt(officerId),
				data: transformedData,
			});
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Update officer error:", error);
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
				title="Edit Police Officer"
				description="Update police officer information"
			>
				<EditOfficerForm
					officer={{
						...officer,
						station_name: officer.station_details?.name || null,
					}}
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isLoading={updateOfficerMutation.isPending}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
