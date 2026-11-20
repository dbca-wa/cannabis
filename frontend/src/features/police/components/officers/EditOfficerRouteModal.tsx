import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import { EditOfficerForm } from "./EditOfficerForm";
import {
	useUpdatePoliceOfficer,
	usePoliceOfficer,
	useOfficerUsage,
} from "../../hooks/usePoliceOfficers";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { DeleteRecordFooter } from "@/shared/components/DeleteRecordFooter";
import type { PoliceOfficerUpdateRequest } from "@/shared/types/backend-api.types";
import { RelatedRecordLinks } from "@/shared/components/RelatedRecordLinks";

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
	// The cases that name this officer, for the "View cases" count.
	const usage = useOfficerUsage(officerId ? parseInt(officerId) : null);

	const handleClose = () => {
		navigate("/officers");
	};

	const handleSubmit = async (data: unknown) => {
		if (!officerId) return;

		await updateOfficerMutation.mutateAsync({
			id: parseInt(officerId),
			data: data as PoliceOfficerUpdateRequest,
		});
		handleClose();
	};

	if (isLoading) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Loading..." description="">
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
				<ResponsiveModalContent side="bottom" title="Error" description="">
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
						email: "",
					}}
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isLoading={updateOfficerMutation.isPending}
				/>
				<RelatedRecordLinks
					links={[
						{
							noun: "cases",
							count: usage.data?.cases.length,
							to: `/cases?officer=${officer.id}`,
						},
					]}
				/>
				<DeleteRecordFooter
					noun="officer"
					onDelete={() => navigate(`/officers/${officer.id}/delete`)}
					disabled={updateOfficerMutation.isPending}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
