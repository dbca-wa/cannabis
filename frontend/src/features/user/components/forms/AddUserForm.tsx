import { Button } from "@/shared/components/ui/button";
import { ResponsiveModalFooter } from "@/shared/components/layout/ResponsiveModal";
import { Input } from "@/shared/components/ui/input";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { type AddUserFormData, addUserSchema } from "./schemas/addUserSchema";
import { ModalSection } from "@/shared/components/layout/ModalSection";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { logger } from "@/shared/services/logger.service";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface AddUserFormProps {
	onCancel: () => void;
	onSubmit: (data: AddUserFormData) => void;
	isSubmitting?: boolean;
}

const AddUserForm = ({
	onCancel,
	onSubmit,
	isSubmitting = false,
}: AddUserFormProps) => {
	const { user } = useAuth();
	const [showPassword, setShowPassword] = useState(false);
	const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

	// React Hook Form setup
	const {
		register,
		handleSubmit,
		control,
		watch,
		formState: { errors, isValid, isDirty },
	} = useForm({
		resolver: zodResolver(addUserSchema),
		mode: "onChange", // Enable real-time validation
		defaultValues: {
			first_name: "",
			last_name: "",
			email: "",
			role: "none",
			password: "",
			password_confirm: "",
			is_staff: false,
			is_active: true,
			it_asset_id: null,
			employee_id: "",
		},
	});

	// Watch role to conditionally show role descriptions
	const selectedRole = watch("role");
	const watchedPassword = watch("password");

	const handleFormSubmit = (data: any) => {
		logger.debug("Form submitted with data:", {
			email: data.email,
			role: data.role,
			hasPassword: !!data.password,
		});
		onSubmit(data);
	};

	return (
		<form
			onSubmit={handleSubmit(handleFormSubmit)}
			className="flex flex-col"
		>
			{/* Base Details Group */}
			<ModalSection title="User Details" isFirst>
				<div className="grid grid-cols-2 gap-3">
					{/* First Name */}
					<div>
						<Input
							{...register("first_name")}
							type="text"
							placeholder="First Name"
							className={
								errors.first_name ? "border-red-500" : ""
							}
						/>
						{errors.first_name && (
							<p className="text-red-500 text-xs mt-1">
								{errors.first_name.message}
							</p>
						)}
					</div>

					{/* Last Name */}
					<div>
						<Input
							{...register("last_name")}
							type="text"
							placeholder="Last Name"
							className={errors.last_name ? "border-red-500" : ""}
						/>
						{errors.last_name && (
							<p className="text-red-500 text-xs mt-1">
								{errors.last_name.message}
							</p>
						)}
					</div>

					{/* Email */}
					<div>
						<Input
							{...register("email")}
							type="email"
							placeholder="Email"
							className={errors.email ? "border-red-500" : ""}
						/>
						{errors.email && (
							<p className="text-red-500 text-xs mt-1">
								{errors.email.message}
							</p>
						)}
					</div>

					{/* IT Asset ID */}
					<div>
						<Input
							{...register("it_asset_id", {
								valueAsNumber: true,
							})}
							type="number"
							placeholder="IT Asset ID"
							className={
								errors.it_asset_id ? "border-red-500" : ""
							}
						/>
						{errors.it_asset_id && (
							<p className="text-red-500 text-xs mt-1">
								{errors.it_asset_id.message}
							</p>
						)}
					</div>

					{/* Employee ID - spans both columns */}
					<div className="col-span-2">
						<Input
							{...register("employee_id")}
							type="text"
							placeholder="Employee ID"
							className={
								errors.employee_id ? "border-red-500" : ""
							}
						/>
						{errors.employee_id && (
							<p className="text-red-500 text-xs mt-1">
								{errors.employee_id.message}
							</p>
						)}
					</div>

					{/* Password */}
					<div>
						<div className="relative">
							<Input
								{...register("password")}
								type={showPassword ? "text" : "password"}
								placeholder="Password (min. 8 characters)"
								className={
									errors.password
										? "border-red-500 pr-10"
										: "pr-10"
								}
							/>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
								onClick={() => setShowPassword(!showPassword)}
							>
								{showPassword ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</Button>
						</div>
						{errors.password && (
							<p className="text-red-500 text-xs mt-1">
								{errors.password.message}
							</p>
						)}
						{watchedPassword && watchedPassword.length > 0 && (
							<div className="text-xs mt-1 space-y-1">
								<div
									className={
										watchedPassword.length >= 8
											? "text-green-600"
											: "text-gray-500"
									}
								>
									✓ At least 8 characters
								</div>
							</div>
						)}
					</div>

					{/* Password Confirmation */}
					<div>
						<div className="relative">
							<Input
								{...register("password_confirm")}
								type={showPasswordConfirm ? "text" : "password"}
								placeholder="Confirm Password"
								className={
									errors.password_confirm
										? "border-red-500 pr-10"
										: "pr-10"
								}
							/>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
								onClick={() =>
									setShowPasswordConfirm(!showPasswordConfirm)
								}
							>
								{showPasswordConfirm ? (
									<EyeOff className="h-4 w-4" />
								) : (
									<Eye className="h-4 w-4" />
								)}
							</Button>
						</div>
						{errors.password_confirm && (
							<p className="text-red-500 text-xs mt-1">
								{errors.password_confirm.message}
							</p>
						)}
					</div>
				</div>
			</ModalSection>

			<ModalSection title="Role & Permissions">
				{/* Role Selection */}
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
								>
									<SelectTrigger className="w-full mt-1">
										<SelectValue placeholder="Select a role" />
									</SelectTrigger>
									<SelectContent className="z-[1000]">
										<SelectGroup>
											<SelectLabel>
												Available Roles
											</SelectLabel>
											<SelectItem value="none">
												No Role
											</SelectItem>

											{(user?.is_superuser ||
												user?.role === "botanist") && (
												<SelectItem value="botanist">
													Approved Botanist
												</SelectItem>
											)}

											{user?.is_superuser && (
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
								{errors.role.message}
							</p>
						)}
					</div>

					{/* Role Description */}
					<div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
						{selectedRole === "none" && (
							<p className="text-sm text-gray-600 dark:text-gray-400">
								<strong>No Role:</strong> This user will have
								basic access but cannot perform specialized
								actions like botanical determinations or
								financial operations.
							</p>
						)}

						{selectedRole === "botanist" && (
							<p className="text-sm text-green-700 dark:text-green-400">
								<strong>Approved Botanist:</strong> This user
								can perform botanical determinations, review
								submissions, and access botanical features.
							</p>
						)}

						{selectedRole === "finance" && (
							<p className="text-sm text-purple-700 dark:text-purple-400">
								<strong>Finance Officer:</strong> This user can
								manage financial aspects, generate invoices, and
								access financial reporting features.
							</p>
						)}
					</div>

					{/* Additional Permissions */}
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
							Staff members have access to administrative features
							and can manage other users.
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
				</div>
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
					disabled={isSubmitting || !isValid || !isDirty}
				>
					{isSubmitting ? "Creating..." : "Create User"}
				</Button>
			</ResponsiveModalFooter>
		</form>
	);
};

export default AddUserForm;
