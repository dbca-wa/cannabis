import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useUsers } from "@/features/user/hooks/useUsers";
import { useNavigate, useParams } from "react-router";
import EditUserForm from "@/features/user/components/forms/EditUserForm";
import type { EditUserFormData } from "../../types";

/**
 * Edits a staff member. People are never deleted in the app (it would strip
 * them from their cases); deactivate them in this form instead.
 */
export const EditUserModal = () => {
	const navigate = useNavigate();
	const { userId } = useParams();
	const { updateUser, isUpdating } = useUsers();

	const handleClose = () => {
		navigate("/staff");
	};

	const handleSubmit = async (transformedData: EditUserFormData) => {
		if (!userId) return;
		updateUser(
			{ id: userId, data: transformedData },
			{
				onSuccess: () => handleClose(),
				onError: (error) => console.error("Update error:", error),
			}
		);
	};

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
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
