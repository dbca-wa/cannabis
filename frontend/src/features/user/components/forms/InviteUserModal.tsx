import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import InviteUserForm from "./InviteUserForm";
import type { InviteUserFormData } from "./InviteUserForm";
import type { ExternalUser, User } from "@/shared/types/backend-api.types";
import { useUsers } from "../../hooks/useUsers";

interface InviteUserModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Optional callback when user is successfully invited */
	onCreate?: (user: User) => void;
	/** Optional locked role - when provided, role selection will be locked to this value */
	lockedRole?: "botanist" | "finance" | null;
}

export const InviteUserModal = ({
	open,
	onOpenChange,
	onCreate,
	lockedRole = null,
}: InviteUserModalProps) => {
	const { isInviting, inviteUser } = useUsers();

	const handleInviteSubmit = (
		data: InviteUserFormData & { external_user_data: ExternalUser }
	) => {
		inviteUser(data, {
			onSuccess: (newUser) => {
				// Call onCreate callback if provided
				if (onCreate) {
					onCreate(newUser);
				}
				onOpenChange(false);
			},
			onError: (error) => {
				console.error("Invite error:", error);
				// Error is already handled by the hook (toast)
			},
		});
	};

	const handleInviteCancel = () => {
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange} modal={true}>
			<DialogContent
				className="sm:max-w-[500px]"
				onInteractOutside={(e) => e.preventDefault()}
			>
				<DialogHeader>
					<DialogTitle>Invite User</DialogTitle>
					<DialogDescription>
						Search for and invite an external user to join the
						system
					</DialogDescription>
				</DialogHeader>
				<InviteUserForm
					onCancel={handleInviteCancel}
					onSubmit={handleInviteSubmit}
					isSubmitting={isInviting}
					lockedRole={lockedRole}
				/>
			</DialogContent>
		</Dialog>
	);
};
