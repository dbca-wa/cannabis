import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";
import InviteUserForm from "./InviteUserForm";
import type { InviteUserFormData } from "./InviteUserForm";
import type { ExternalUser } from "@/shared/types/backend-api.types";
import { useUsers } from "../../hooks/useUsers";

interface InviteUserModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Optional callback when invitation is successfully sent (Note: invitation ≠ user creation) */
	onCreate?: () => void;
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
			onSuccess: () => {
				// Note: inviteUser returns InviteRecord, not User
				// The actual User is only created when the invitation is activated
				// The invitation success toast is already shown by the mutation
				if (onCreate) {
					onCreate();
				}
				onOpenChange(false);
			},
			onError: (error) => {
				console.error("Invite error:", error);
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
