import { Button } from "@/shared/components/ui/button";
import { ResponsiveModalFooter } from "@/shared/components/layout/ResponsiveModal";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ModalSection } from "@/shared/components/layout/ModalSection";
import { logger } from "@/shared/services/logger.service";
import { useState } from "react";
import { UserInviteSection } from "./UserInviteSection";
import { RolePermissionsSection } from "./RolePermissionsSection";
import type { ExternalUser } from "@/shared/types/backend-api.types";
import { z } from "zod";

// Schema for invite form
const inviteUserSchema = z.object({
	external_user_email: z.string().email("Valid email is required"),
	role: z.enum(["botanist", "finance", "none"]),
	is_staff: z.boolean().default(false),
	is_active: z.boolean().default(true),
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
	const [selectedUserData, setSelectedUserData] =
		useState<ExternalUser | null>(null);

	// React Hook Form setup
	const {
		handleSubmit,
		control,
		watch,
		setValue,
		formState: { errors, isValid, isDirty },
	} = useForm({
		resolver: zodResolver(inviteUserSchema),
		mode: "onChange",
		defaultValues: {
			external_user_email: "",
			role: lockedRole || "none",
			is_staff: false,
			is_active: true,
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

	const canSubmit = isValid && isDirty && selectedUserData;

	return (
		<form
			onSubmit={handleSubmit(handleFormSubmit)}
			className="flex flex-col"
		>
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
				>
					{isSubmitting ? "Sending Invitation..." : "Send Invitation"}
				</Button>
			</ResponsiveModalFooter>
		</form>
	);
};

export default InviteUserForm;
