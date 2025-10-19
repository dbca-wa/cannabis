import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useUsers } from "@/features/user/hooks/useUsers";
import { useNavigate, useParams } from "react-router";

import EditUserForm from "@/features/user/components/forms/EditUserForm";
import type { EditUserFormData } from "../../types";

export const EditUserModal = () => {
	const navigate = useNavigate();
	const { userId } = useParams();
	const { updateUser, isUpdating } = useUsers();

	const handleClose = () => {
		navigate("/users");
	};

	const handleSubmit = async (transformedData: EditUserFormData) => {
		if (!userId) return;

		console.log("Transformed data from form:", transformedData);

		// Use the updateUser function with callbacks
		updateUser(
			{
				id: userId,
				data: transformedData,
			},
			{
				onSuccess: () => {
					console.log("User updated successfully, closing modal");
					handleClose();
				},
				onError: (error) => {
					console.error("Update error:", error);
					// Error is already handled by the hook (toast), just log here
				},
			}
		);
	};

	return (
		<ResponsiveModal
			open={true} // Always open when this component renders
			onOpenChange={(open: boolean) => {
				if (!open) handleClose(); // Navigate away when modal closes
			}}
		>
			<ResponsiveModalContent
				side={"bottom"}
				title="Edit User"
				description="Update user information and role settings"
			>
				<EditUserForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isUpdating}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
