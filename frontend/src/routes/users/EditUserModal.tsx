import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/components/ui/custom/ResponsiveModal";
import { useUsers } from "@/hooks/tanstack/useUsers";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { EditUserFormData } from "@/types";
import EditUserForm from "@/components/core/users/forms/EditUserForm";

export const EditUserModal = () => {
	const navigate = useNavigate();
	const { userId } = useParams();
	const { updateUser, isUpdating, refreshUser } = useUsers();

	const handleClose = () => {
		navigate("/users");
	};

	const handleSubmit = async (transformedData: EditUserFormData) => {
		if (!userId) return;

		console.log("Transformed data from form:", transformedData);

		try {
			// Perform the update
			await updateUser({
				id: userId,
				data: transformedData,
			});

			// Force refresh the user data to ensure we have the latest
			await refreshUser(userId);

			toast.success("User updated successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to update user");
			console.error("Update error:", error);
		}
	};

	return (
		<ResponsiveModal
			open={true} // Always open when this component renders
			onOpenChange={(open) => {
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
