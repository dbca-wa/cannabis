import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/components/ui/custom/ResponsiveModal";
import { useNavigate } from "react-router";
import { useUsers } from "@/hooks/tanstack/useUsers";
import { toast } from "sonner";
import { AddUserFormData } from "@/types";
import AddUserForm from "@/components/core/users/forms/AddUserForm";

export const AddUserModal = () => {
	const navigate = useNavigate();
	const { isCreating, createUser } = useUsers();

	const handleClose = () => {
		navigate("/users");
	};

	const handleSubmit = async (data: AddUserFormData) => {
		try {
			await createUser(data);
			toast.success("User created successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to create user");
			console.error("Create error:", error);
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
				title="Add User"
				description="Create a new user with role and profile settings"
			>
				<AddUserForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isCreating}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
