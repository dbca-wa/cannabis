import { Label } from "@/shared/components/ui/label";
import { InviteUserComboBox } from "./InviteUserComboBox";
import type { ExternalUser } from "@/shared/types/backend-api.types";

interface UserInviteSectionProps {
	selectedUserEmail: string | null;
	selectedUserData: ExternalUser | null;
	onUserChange: (email: string | null, userData: ExternalUser | null) => void;
	error?: string;
}

export const UserInviteSection = ({
	selectedUserEmail,
	selectedUserData,
	onUserChange,
	error,
}: UserInviteSectionProps) => {
	return (
		<div className="space-y-4">
			<div>
				<Label className="text-sm font-medium">
					Search External Users
				</Label>
				<InviteUserComboBox
					value={selectedUserEmail}
					onValueChange={onUserChange}
					placeholder="Search for a user to invite..."
					className="mt-1"
					error={!!error}
				/>
				{error && <p className="text-red-500 text-xs mt-1">{error}</p>}
			</div>

			{/* Show selected user info */}
			{selectedUserData && (
				<div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
					<h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
						Selected User Information
					</h4>
					<div className="space-y-1 text-sm">
						<div>
							<span className="font-medium">Name:</span>{" "}
							{selectedUserData.full_name}
						</div>
						<div>
							<span className="font-medium">Email:</span>{" "}
							{selectedUserData.email}
						</div>
						{selectedUserData.title && (
							<div>
								<span className="font-medium">Title:</span>{" "}
								{selectedUserData.title}
							</div>
						)}
						{selectedUserData.division && (
							<div>
								<span className="font-medium">Division:</span>{" "}
								{selectedUserData.division}
							</div>
						)}
						{selectedUserData.employee_id && (
							<div>
								<span className="font-medium">
									Employee ID:
								</span>{" "}
								{selectedUserData.employee_id}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
