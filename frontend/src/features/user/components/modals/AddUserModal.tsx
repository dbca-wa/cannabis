import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate } from "react-router";
import InviteUserForm from "@/features/user/components/forms/InviteUserForm";
import { useUsers } from "@/features/user/hooks/useUsers";
import type { InviteUserFormData } from "../forms/InviteUserForm";
import type { ExternalUser } from "@/shared/types/backend-api.types";

export const AddUserModal = () => {
	const navigate = useNavigate();
	const { isInviting, inviteUser } = useUsers();

	const handleClose = () => {
		navigate("/users");
	};

	const handleSubmit = (
		data: InviteUserFormData & { external_user_data: ExternalUser }
	) => {
		// Pass options object with onSuccess callback
		inviteUser(data, {
			onSuccess: () => {
				console.log("User invitation sent successfully, closing modal");
				handleClose();
			},
			onError: (error) => {
				console.error("Invite error:", error);
				// Error is already handled by the hook (toast), just log here
			},
		});
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
				title="Invite User"
				description="Search for and invite an external user to join the system"
			>
				<InviteUserForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isInviting}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
