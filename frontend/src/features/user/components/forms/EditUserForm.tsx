/* eslint-disable react-hooks/incompatible-library */
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
import { Badge } from "@/shared/components/ui/badge";
import { useUserById } from "@/features/user/hooks/useUserById";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useParams } from "react-router";
import {
	editUserSchema,
	type EditUserFormData as EditUserSchemaData,
} from "./schemas/editUserSchema";
import { ModalSection } from "@/shared/components/layout/ModalSection";
import type { EditUserFormData, Role } from "@/features/user/types/users.types";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { useSendResetEmail } from "@/features/user/hooks/useUsers";
import { determineUserRole } from "@/features/user/utils/userDisplay.utils";
import { formatDate } from "@/shared/utils/date.utils";
import { Spinner } from "@/shared/components/feedback/Spinner";
import { logger } from "@/shared/services/logger.service";
import {
	AlertCircle,
	User,
	Calendar,
	Loader2,
	Mail,
	ShieldCheck,
	ShieldOff,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateAdminStatus } from "@/features/user/services/users.service";
import { toast } from "sonner";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";

interface EditUserFormProps {
	onCancel: () => void;
	onSubmit: (data: EditUserFormData) => void;
	isSubmitting?: boolean;
	onDelete?: () => void;
}

const EditUserForm = ({
	onCancel,
	onSubmit,
	isSubmitting = false,
	onDelete,
}: EditUserFormProps) => {
	const { userId } = useParams<{ userId: string }>();
	const {
		data: user,
		isLoading,
		error,
		refetch,
	} = useUserById(Number(userId!));
	const { user: currentUser } = useAuth();
	const sendResetEmail = useSendResetEmail();
	const [formInitialised, setFormInitialised] = useState(false);
	const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
	const queryClient = useQueryClient();

	// Admin promote/demote mutation
	const adminStatusMutation = useMutation({
		mutationFn: ({
			userId,
			action,
		}: {
			userId: number;
			action: "promote" | "demote";
		}) => updateAdminStatus(userId, action),
		onSuccess: async (response) => {
			toast.success(response.message);
			await invalidateRelatedQueries(queryClient, "users");
			setShowPromoteConfirm(false);
			// Reset form to reflect new is_staff value
			setFormInitialised(false);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Failed to update admin status");
			setShowPromoteConfirm(false);
		},
	});

	// React Hook Form setup

	const {
		register,
		handleSubmit,
		control,
		reset,
		watch,
		formState: { errors, isValid, isDirty },
	} = useForm({
		resolver: zodResolver(editUserSchema),
		mode: "onChange", // Enable real-time validation
		defaultValues: {
			email: "",
			given_names: "",
			last_name: "",
			role: "none" as Role,
			is_staff: false,
			is_active: true,
			it_asset_id: null,
			employee_id: "",
		},
	});

	// Watch role to conditionally show role descriptions
	const selectedRole = watch("role");
	const watchedIsActive = watch("is_active");

	useEffect(() => {
		if (user && !isLoading && !formInitialised) {
			logger.debug("Populating form with user data", {
				userId: user.id,
			});

			// Determine the correct role with type safety
			const userRole = determineUserRole(user);

			const formData: EditUserFormData = {
				email: user.email,
				given_names: user.given_names || "",
				last_name: user.last_name || "",
				role: userRole,
				is_staff: user.is_staff,
				is_active: user.is_active,
				it_asset_id: user.it_asset_id,
				employee_id: user.employee_id,
			};

			logger.debug("Resetting form with data", { formData });
			reset(formData);
			setFormInitialised(true);
		}
	}, [user, isLoading, reset, formInitialised]);

	if (!user || isLoading || !formInitialised) {
		return (
			<div className="flex justify-center py-8">
				<Spinner />
			</div>
		);
	}

	if (error) {
		return (
			<div className="text-center py-8">
				<p className="text-red-600">Error loading user data</p>
				<Button onClick={() => refetch()} variant="outline" className="mt-4">
					Retry
				</Button>
			</div>
		);
	}

	const handleFormSubmit = (data: EditUserSchemaData) => {
		logger.debug("Form submitted", { formData: data });

		// Transform the data to match backend expectations
		const transformedData: EditUserFormData = {
			email: data.email ?? "",
			given_names: data.given_names ?? "",
			last_name: data.last_name ?? "",
			role: data.role ?? "none",
			is_staff: data.is_staff,
			is_active: data.is_active,
			it_asset_id: data.it_asset_id,
			employee_id: data.employee_id,
		};

		logger.debug("Submitting transformed data", { transformedData });
		onSubmit(transformedData);
	};

	return (
		<form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col">
			{/* User Information Overview */}
			<ModalSection title="User Information" isFirst>
				{/* Current user status */}
				<div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
					<div className="flex items-start gap-3">
						<User className="h-5 w-5 text-gray-500 mt-0.5" />
						<div className="flex-1">
							<div className="flex items-center gap-2 mb-2">
								<h4 className="font-medium text-gray-900 dark:text-gray-100">
									{user?.full_name}
								</h4>
								<div className="flex gap-1">
									{user?.is_superuser && (
										<Badge variant="destructive" className="text-xs">
											Super Admin
										</Badge>
									)}
									{user?.is_staff && (
										<Badge variant="secondary" className="text-xs">
											Staff
										</Badge>
									)}
									{!user?.is_active && (
										<Badge variant="outline" className="text-xs">
											Inactive
										</Badge>
									)}
								</div>
							</div>
							<div className="grid grid-cols-2 gap-4 text-sm text-gray-600 dark:text-gray-400">
								<div>
									<span className="font-medium">User ID:</span> {user?.id}
								</div>
								<div>
									<span className="font-medium">Current Email:</span>{" "}
									{user?.email}
								</div>
								{user?.employee_id && (
									<div>
										<span className="font-medium">Employee ID:</span>{" "}
										{user.employee_id}
									</div>
								)}
								{user?.it_asset_id && (
									<div>
										<span className="font-medium">IT Asset ID:</span>{" "}
										{user.it_asset_id}
									</div>
								)}
								<div className="flex items-center gap-1">
									<Calendar className="h-3 w-3" />
									<span className="font-medium">Joined:</span>{" "}
									{user?.date_joined ? formatDate(user.date_joined) : "N/A"}
								</div>
								{user?.last_login && (
									<div className="flex items-center gap-1">
										<span className="font-medium">Last Login:</span>{" "}
										{formatDate(user.last_login)}
									</div>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Editable fields */}
				<div className="space-y-4">
					<div className="grid grid-cols-2 gap-3">
						{/* Given Names */}
						<div>
							<Label htmlFor="given_names" className="text-sm font-medium">
								Given Names
							</Label>
							<Input
								{...register("given_names")}
								type="text"
								placeholder="Given Names"
								className={errors.given_names ? "border-red-500 mt-1" : "mt-1"}
							/>
							{errors.given_names && (
								<p className="text-red-500 text-xs mt-1">
									{errors.given_names.message}
								</p>
							)}
						</div>

						{/* Last Name */}
						<div>
							<Label htmlFor="last_name" className="text-sm font-medium">
								Last Name
							</Label>
							<Input
								{...register("last_name")}
								type="text"
								placeholder="Last Name"
								className={errors.last_name ? "border-red-500 mt-1" : "mt-1"}
							/>
							{errors.last_name && (
								<p className="text-red-500 text-xs mt-1">
									{errors.last_name.message}
								</p>
							)}
						</div>
					</div>

					{/* Email */}
					<div>
						<Label htmlFor="email" className="text-sm font-medium">
							Email Address
						</Label>
						<Input
							{...register("email")}
							type="email"
							placeholder="Email"
							className={errors.email ? "border-red-500 mt-1" : "mt-1"}
						/>
						{errors.email && (
							<p className="text-red-500 text-xs mt-1">
								{errors.email.message}
							</p>
						)}
					</div>

					{/* IT Asset ID and Employee ID */}
					<div className="grid grid-cols-2 gap-3">
						<div>
							<Label htmlFor="it_asset_id" className="text-sm font-medium">
								IT Asset ID
							</Label>
							<Input
								{...register("it_asset_id", {
									valueAsNumber: true,
								})}
								type="number"
								placeholder="IT Asset ID"
								className={errors.it_asset_id ? "border-red-500 mt-1" : "mt-1"}
							/>
							{errors.it_asset_id && (
								<p className="text-red-500 text-xs mt-1">
									{errors.it_asset_id.message}
								</p>
							)}
						</div>

						<div>
							<Label htmlFor="employee_id" className="text-sm font-medium">
								Employee ID
							</Label>
							<Input
								{...register("employee_id")}
								type="text"
								placeholder="Employee ID"
								className={errors.employee_id ? "border-red-500 mt-1" : "mt-1"}
							/>
							{errors.employee_id && (
								<p className="text-red-500 text-xs mt-1">
									{errors.employee_id.message}
								</p>
							)}
						</div>
					</div>
				</div>
			</ModalSection>

			<ModalSection title="Role & Permissions">
				<div className="space-y-4">
					{/* Role Selection */}
					<div>
						<Label htmlFor="role" className="text-sm font-medium">
							User Role
						</Label>
						<Controller
							name="role"
							control={control}
							render={({ field }) => (
								<Select
									onValueChange={(value) => {
										logger.debug("Role changing", {
											from: field.value,
											to: value,
										});
										field.onChange(value as Role);
									}}
									value={field.value}
								>
									<SelectTrigger className="w-full mt-1">
										<SelectValue placeholder="Select a role" />
									</SelectTrigger>
									<SelectContent className="z-[1000]">
										<SelectGroup>
											<SelectLabel>Available Roles</SelectLabel>
											<SelectItem value="none">No Role</SelectItem>

											{(currentUser?.is_superuser ||
												currentUser?.role === "botanist") && (
												<SelectItem value="botanist">
													Approved Botanist
												</SelectItem>
											)}

											{currentUser?.is_superuser && (
												<SelectItem value="finance">Finance Officer</SelectItem>
											)}
										</SelectGroup>
									</SelectContent>
								</Select>
							)}
						/>
						{errors.role && (
							<p className="text-red-500 text-xs mt-1">{errors.role.message}</p>
						)}
					</div>

					{/* Role Description */}
					<div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
						{selectedRole === "none" && (
							<p className="text-sm text-gray-600 dark:text-gray-400">
								<strong>No Role:</strong> This user will have basic access but
								cannot perform specialized actions.
							</p>
						)}

						{selectedRole === "botanist" && (
							<p className="text-sm text-green-700 dark:text-green-400">
								<strong>Approved Botanist:</strong> This user can perform
								botanical determinations and access botanical features.
							</p>
						)}

						{selectedRole === "finance" && (
							<p className="text-sm text-purple-700 dark:text-purple-400">
								<strong>Finance Officer:</strong> This user can manage financial
								aspects and access financial reporting.
							</p>
						)}
					</div>

					{/* Permission Checkboxes */}
					<div className="space-y-3">
						{/* Admin Status — Promote/Demote button for admins */}
						{(currentUser?.is_staff || currentUser?.is_superuser) &&
							currentUser?.id !== user?.id &&
							!user?.is_superuser && (
								<div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md space-y-2">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											{user?.is_staff ? (
												<ShieldCheck className="h-4 w-4 text-emerald-600" />
											) : (
												<ShieldOff className="h-4 w-4 text-muted-foreground" />
											)}
											<span className="text-sm font-medium">
												Admin Status:{" "}
												{user?.is_staff ? (
													<Badge variant="secondary" className="text-xs ml-1">
														Admin
													</Badge>
												) : (
													<span className="text-muted-foreground">
														Not an admin
													</span>
												)}
											</span>
										</div>
										{!showPromoteConfirm && (
											<Button
												type="button"
												variant={user?.is_staff ? "outline" : "default"}
												size="sm"
												onClick={() => setShowPromoteConfirm(true)}
												disabled={adminStatusMutation.isPending}
												className="cursor-pointer"
											>
												{user?.is_staff
													? "Demote from Admin"
													: "Promote to Admin"}
											</Button>
										)}
									</div>

									{showPromoteConfirm && (
										<div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
											<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
											<div className="flex-1">
												<p className="text-sm text-amber-800 dark:text-amber-200">
													{user?.is_staff
														? `Are you sure you want to demote ${user.full_name} from admin? They will lose access to admin features.`
														: `Are you sure you want to promote ${user?.full_name} to admin? They will gain full admin access.`}
												</p>
												<div className="flex gap-2 mt-2">
													<Button
														type="button"
														variant={user?.is_staff ? "destructive" : "default"}
														size="sm"
														onClick={() =>
															adminStatusMutation.mutate({
																userId: user!.id,
																action: user!.is_staff ? "demote" : "promote",
															})
														}
														disabled={adminStatusMutation.isPending}
														className="cursor-pointer"
													>
														{adminStatusMutation.isPending ? (
															<Loader2 className="mr-1 h-3 w-3 animate-spin" />
														) : null}
														{user?.is_staff
															? "Confirm Demote"
															: "Confirm Promote"}
													</Button>
													<Button
														type="button"
														variant="ghost"
														size="sm"
														onClick={() => setShowPromoteConfirm(false)}
														disabled={adminStatusMutation.isPending}
														className="cursor-pointer"
													>
														Cancel
													</Button>
												</div>
											</div>
										</div>
									)}
								</div>
							)}

						{/* Super admin notice */}
						{user?.is_superuser && (
							<div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
								<div className="flex items-center gap-2">
									<ShieldCheck className="h-4 w-4 text-red-600" />
									<span className="text-sm font-medium">
										Super Administrator
									</span>
									<Badge variant="destructive" className="text-xs">
										Cannot be changed
									</Badge>
								</div>
								<p className="text-xs text-muted-foreground mt-1 ml-6">
									Super admin status can only be changed via the database
									directly.
								</p>
							</div>
						)}

						<div className="flex items-center space-x-2">
							<Controller
								name="is_active"
								control={control}
								render={({ field }) => (
									<Checkbox
										id="is_active"
										checked={field.value}
										onCheckedChange={field.onChange}
										disabled={user?.is_superuser} // Can't deactivate superuser
									/>
								)}
							/>
							<Label htmlFor="is_active" className="text-sm">
								Active User
							</Label>
							{!watchedIsActive && (
								<Badge variant="outline" className="text-xs">
									Will be locked out
								</Badge>
							)}
						</div>
						<p className="text-xs text-gray-500 ml-6">
							Inactive users cannot log in to the system.
							{user?.is_superuser && " (Cannot be disabled for super admin)"}
						</p>

						{!watchedIsActive && (
							<div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
								<AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
								<div className="text-sm text-amber-800 dark:text-amber-200">
									<strong>Warning:</strong> Deactivating this user will prevent
									them from logging in. They will lose access to all system
									features.
								</div>
							</div>
						)}
					</div>
				</div>
			</ModalSection>

			{/* Footer */}
			<ResponsiveModalFooter>
				{onDelete && (
					<Button
						type="button"
						variant="destructive"
						onClick={onDelete}
						disabled={isSubmitting}
						className="mr-auto cursor-pointer"
					>
						Delete User
					</Button>
				)}
				{(currentUser?.is_staff || currentUser?.is_superuser) &&
					currentUser?.id !== user?.id && (
						<Button
							type="button"
							variant="outline"
							onClick={() => sendResetEmail.mutate(Number(userId))}
							disabled={sendResetEmail.isPending || isSubmitting}
							className="cursor-pointer"
							aria-label="Send password reset email to this user"
						>
							{sendResetEmail.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<Mail className="mr-2 h-4 w-4" />
							)}
							{sendResetEmail.isPending ? "Sending..." : "Send Password Reset"}
						</Button>
					)}
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
					{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
					{isSubmitting ? "Updating..." : "Update User"}
				</Button>
			</ResponsiveModalFooter>
		</form>
	);
};

export default EditUserForm;
