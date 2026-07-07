import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useUsers } from "@/features/user/hooks/useUsers";
import { useNavigate, useParams } from "react-router";
import { useAuth } from "@/features/auth/hooks/useAuth";
import EditUserForm from "@/features/user/components/forms/EditUserForm";
import type { EditUserFormData } from "../../types";

export const EditUserModal = () => {
	const navigate = useNavigate();
	const { userId } = useParams();
	const { user: currentUser } = useAuth();
	const { updateUser, isUpdating, deleteUser } = useUsers();

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

	const handleDelete = () => {
		if (!userId) return;
		if (
			!window.confirm(
				"Are you sure you want to delete this user? This action cannot be undone."
			)
		)
			return;
		deleteUser(userId, { onSuccess: () => handleClose() });
	};

	const isAdmin = currentUser?.is_superuser || currentUser?.is_staff;

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
					onDelete={isAdmin ? handleDelete : undefined}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
