import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate } from "react-router";
import { CreateOfficerForm } from "./CreateOfficerForm";
import { useCreatePoliceOfficer } from "../../hooks/usePoliceOfficers";
import type { PoliceOfficerCreateRequest } from "@/shared/types/backend-api.types";

export const CreateOfficerRouteModal = () => {
	const navigate = useNavigate();
	const createOfficerMutation = useCreatePoliceOfficer();

	const handleClose = () => {
		navigate("/officers");
	};

	const handleSubmit = async (data: unknown) => {
		// Errors reach the form, which shows each message beside its field;
		// the mutation also shows a toast and the modal stays open.
		await createOfficerMutation.mutateAsync(data as PoliceOfficerCreateRequest);
		handleClose();
	};

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title="Add Police Officer"
				description="Create a new police officer record"
			>
				<CreateOfficerForm
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isLoading={createOfficerMutation.isPending}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
