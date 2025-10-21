import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { useAuth } from "@/features/auth/hooks/useAuth";

interface RolePermissionsSectionProps {
	control: Control<any>;
	errors: FieldErrors<any>;
	selectedRole: string;
	lockedRole?: "botanist" | "finance" | null;
}

export const RolePermissionsSection = ({
	control,
	errors,
	selectedRole,
	lockedRole = null,
}: RolePermissionsSectionProps) => {
	const { user } = useAuth();

	return (
		<div className="space-y-4">
			<div>
				<Label htmlFor="role" className="text-sm font-medium">
					User Role
				</Label>
				<Controller
					name="role"
					control={control}
					render={({ field }) => (
						<Select
							onValueChange={field.onChange}
							value={field.value}
							disabled={!!lockedRole}
						>
							<SelectTrigger className="w-full mt-1">
								<SelectValue placeholder="Select a role" />
							</SelectTrigger>
							<SelectContent className="z-[1000]">
								<SelectGroup>
									<SelectLabel>Available Roles</SelectLabel>
									{!lockedRole && (
										<SelectItem value="none">
											No Role
										</SelectItem>
									)}

									{(!lockedRole || lockedRole === "botanist") &&
										(user?.is_superuser ||
											user?.role === "botanist") && (
											<SelectItem value="botanist">
												Approved Botanist
											</SelectItem>
										)}

									{(!lockedRole || lockedRole === "finance") &&
										user?.is_superuser && (
											<SelectItem value="finance">
												Finance Officer
											</SelectItem>
										)}
								</SelectGroup>
							</SelectContent>
						</Select>
					)}
				/>
				{errors.role && (
					<p className="text-red-500 text-xs mt-1">
						{errors.role.message as string}
					</p>
				)}
			</div>

			{/* Role Description */}
			<div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
				{selectedRole === "none" && (
					<p className="text-sm text-gray-600 dark:text-gray-400">
						<strong>No Role:</strong> This user will have basic
						access but cannot perform specialized actions like
						botanical determinations or financial operations.
					</p>
				)}

				{selectedRole === "botanist" && (
					<p className="text-sm text-green-700 dark:text-green-400">
						<strong>Approved Botanist:</strong> This user can
						perform botanical determinations, review submissions,
						and access botanical features.
					</p>
				)}

				{selectedRole === "finance" && (
					<p className="text-sm text-purple-700 dark:text-purple-400">
						<strong>Finance Officer:</strong> This user can manage
						financial aspects, generate invoices, and access
						financial reporting features.
					</p>
				)}
			</div>

			{/* Additional Permissions - Only show for admin users */}
			{user?.is_superuser && (
				<div className="space-y-3">
					<div className="flex items-center space-x-2">
						<Controller
							name="is_staff"
							control={control}
							render={({ field }) => (
								<Checkbox
									id="is_staff"
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							)}
						/>
						<Label htmlFor="is_staff" className="text-sm">
							Staff Member
						</Label>
					</div>
					<p className="text-xs text-gray-500 ml-6">
						Staff members have access to administrative features and
						can manage other users.
					</p>

					<div className="flex items-center space-x-2">
						<Controller
							name="is_active"
							control={control}
							render={({ field }) => (
								<Checkbox
									id="is_active"
									checked={field.value}
									onCheckedChange={field.onChange}
								/>
							)}
						/>
						<Label htmlFor="is_active" className="text-sm">
							Active User
						</Label>
					</div>
					<p className="text-xs text-gray-500 ml-6">
						Inactive users cannot log in to the system.
					</p>
				</div>
			)}
		</div>
	);
};
