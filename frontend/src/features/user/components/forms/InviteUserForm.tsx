/* eslint-disable react-hooks/incompatible-library */
import { Button } from "@/shared/components/ui/button";
import { ResponsiveModalFooter } from "@/shared/components/layout/ResponsiveModal";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { ModalSection } from "@/shared/components/layout/ModalSection";
import { logger } from "@/shared/services/logger.service";
import { useState } from "react";
import { UserInviteSection } from "./UserInviteSection";
import { RolePermissionsSection } from "./RolePermissionsSection";
import { useAuth } from "@/features/auth/hooks/useAuth";
import type { ExternalUser } from "@/shared/types/backend-api.types";
import { z } from "zod";

// Schema for invite form
const inviteUserSchema = z.object({
	external_user_email: z.string().email("Valid email is required"),
	role: z.enum(["botanist", "finance", "none"]),
	is_staff: z.boolean(),
});

export type InviteUserFormData = z.infer<typeof inviteUserSchema>;

interface InviteUserFormProps {
	onCancel: () => void;
	onSubmit: (
		data: InviteUserFormData & { external_user_data: ExternalUser }
	) => void;
	isSubmitting?: boolean;
	lockedRole?: "botanist" | "finance" | null;
}

const InviteUserForm = ({
	onCancel,
	onSubmit,
	isSubmitting = false,
	lockedRole = null,
}: InviteUserFormProps) => {
	const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(
		null
	);
	const [selectedUserData, setSelectedUserData] = useState<ExternalUser | null>(
		null
	);
	const { isAdmin } = useAuth();

	// React Hook Form setup

	const {
		handleSubmit,
		control,
		watch,
		setValue,
		formState: { errors, isValid /* isDirty */ },
	} = useForm<InviteUserFormData>({
		resolver: zodResolver(inviteUserSchema),
		mode: "onChange",
		defaultValues: {
			external_user_email: "",
			role: (lockedRole || "none") as "botanist" | "finance" | "none",
			is_staff: false,
		},
	});

	// Watch role to conditionally show role descriptions
	const selectedRole = watch("role");

	const handleUserChange = (
		email: string | null,
		userData: ExternalUser | null
	) => {
		setSelectedUserEmail(email);
		setSelectedUserData(userData);
		setValue("external_user_email", email || "", { shouldValidate: true });
	};

	const handleFormSubmit = (data: InviteUserFormData) => {
		if (!selectedUserData) {
			logger.error("No external user data available");
			return;
		}

		logger.debug("Invite form submitted with data:", {
			email: data.external_user_email,
			role: data.role,
			external_user: selectedUserData,
		});

		onSubmit({
			...data,
			external_user_data: selectedUserData,
		});
	};

	// Button should be enabled when external user is selected and role is chosen
	const canSubmit = isValid && selectedUserData && selectedRole;

	return (
		<form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col">
			{/* User Selection */}
			<ModalSection title="Select User to Invite" isFirst>
				<UserInviteSection
					selectedUserEmail={selectedUserEmail}
					selectedUserData={selectedUserData}
					onUserChange={handleUserChange}
					error={errors.external_user_email?.message}
				/>
			</ModalSection>

			{/* Role & Permissions */}
			<ModalSection title="Role & Permissions">
				<RolePermissionsSection
					control={control}
					errors={errors}
					selectedRole={selectedRole}
					lockedRole={lockedRole}
				/>
			</ModalSection>

			{/* Admin Access — only visible to admins */}
			{isAdmin && (
				<ModalSection title="Admin Access">
					<div className="space-y-3">
						<div className="flex items-start gap-3">
							<Controller
								name="is_staff"
								control={control}
								render={({ field }) => (
									<Checkbox
										id="is_staff"
										checked={field.value}
										onCheckedChange={field.onChange}
										className="mt-0.5"
									/>
								)}
							/>
							<div>
								<Label
									htmlFor="is_staff"
									className="text-sm font-medium cursor-pointer"
								>
									Invite as Administrator
								</Label>
								<p className="text-xs text-muted-foreground mt-0.5">
									This user will have full admin access including user
									management, system settings, and the ability to promote other
									users.
								</p>
							</div>
						</div>
					</div>
				</ModalSection>
			)}

			{/* Footer */}
			<ResponsiveModalFooter>
				<Button
					type="button"
					variant="outline"
					onClick={onCancel}
					disabled={isSubmitting}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					variant="default"
					disabled={isSubmitting || !canSubmit}
					className="min-w-[140px]"
				>
					{isSubmitting ? (
						<>
							<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
							Sending...
						</>
					) : (
						"Send Invitation"
					)}
				</Button>
			</ResponsiveModalFooter>
		</form>
	);
};

export default InviteUserForm;
