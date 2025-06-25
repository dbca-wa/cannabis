import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsiveModalFooter } from "@/components/ui/custom/ResponsiveModal";
import { Spinner } from "@/components/ui/custom/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useUserById } from "@/hooks/tanstack/useUsers";
import { useAuthStore } from "@/stores/rootStore";
import { EditUserFormData } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useParams } from "react-router";
import { editUserSchema } from "./schemas/editUserSchema";
import {
	POLICE_SENIORITY_OPTIONS,
	SENIORITY_DISPLAY_MAP,
	BACKEND_TO_FRONTEND_SENIORITY,
} from "./utils";
import PoliceStationCombobox from "./PoliceStationCombobox";
import { ModalSection } from "@/components/layout/ModalSection";

interface EditUserFormProps {
	onCancel: () => void;
	onSubmit: (data: EditUserFormData) => void; // Changed to any since we're transforming data
	isSubmitting?: boolean;
}

const EditUserForm = observer(
	({ onCancel, onSubmit, isSubmitting = false }: EditUserFormProps) => {
		const { userId } = useParams();
		const { user, isLoading, error, refetch } = useUserById(userId!);
		const authStore = useAuthStore();
		const [formInitialized, setFormInitialized] = useState(false);

		// React Hook Form setup
		const {
			register,
			handleSubmit,
			control,
			reset,
			watch,
			formState: { errors },
		} = useForm<EditUserFormData>({
			resolver: zodResolver(editUserSchema),
			defaultValues: {
				first_name: "",
				last_name: "",
				username: "",
				email: "",
				role: "none",
				police_id: "",
				station: "",
				rank: "",
				is_sworn: false,
			},
		});

		// Watch role to conditionally show police fields
		const selectedRole = watch("role");

		// Use reset() instead of setValue() - this is the React Hook Form way
		useEffect(() => {
			if (user && !isLoading && !formInitialized) {
				console.log("User data for form population:", user); // Debug log

				// Determine the correct role - if user has police_data, they're police
				let userRole = "none";
				if (user.police_data) {
					userRole = "police";
				} else if (
					user.role &&
					["botanist", "finance", "none"].includes(user.role)
				) {
					userRole = user.role;
				}

				console.log("Setting role to:", userRole); // Debug log

				const formData = {
					first_name: user.first_name || "",
					last_name: user.last_name || "",
					username: user.username || "",
					email: user.email || "",
					role: userRole,
					police_id: "",
					station: "",
					rank: "",
					is_sworn: false,
				};

				// Set police fields if police_data exists
				if (user.police_data) {
					console.log("Police data found:", user.police_data); // Debug log
					formData.police_id = user.police_data.police_id || "";
					formData.station =
						user.police_data.station?.id.toString() || "";
					// Map backend seniority to frontend value
					const backendSeniority = user.police_data.seniority;
					formData.rank =
						BACKEND_TO_FRONTEND_SENIORITY[backendSeniority] ||
						backendSeniority ||
						"officer";
					formData.is_sworn = user.police_data.sworn || false;
				} else if (user.station_id) {
					// Fallback to flat fields if they exist
					console.log("Using flat fields for police data"); // Debug log
					formData.police_id = user.police_id || "";
					formData.station = user.station_id?.toString() || "";
					formData.rank =
						BACKEND_TO_FRONTEND_SENIORITY[user.rank] ||
						user.rank ||
						"officer";
					formData.is_sworn = user.is_sworn || false;
				}

				console.log("Form data to reset with:", formData); // Debug log
				reset(formData);
				setFormInitialized(true);
			}
		}, [user, isLoading, reset, formInitialized]);

		if (!user || isLoading || !formInitialized) {
			return (
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			);
		}

		const handleFormSubmit = (data: EditUserFormData) => {
			console.log("Form data:", data);

			// Transform the data to match backend expectations
			const transformedData = {
				first_name: data.first_name,
				last_name: data.last_name,
				username: data.username,
				email: data.email,
				role: data.role,
				// Police profile fields
				police_id: data.police_id || "",
				station_id: data.station ? parseInt(data.station) : null,
				rank: data.rank || "officer", // Send the backend value directly
				is_sworn: data.is_sworn || false,
			};

			console.log("Transformed data:", transformedData);
			onSubmit(transformedData);
		};

		return (
			<form
				onSubmit={handleSubmit(handleFormSubmit)}
				className="flex flex-col"
			>
				{/* Base Details Group */}
				<ModalSection title="Base Details" isFirst>
					<div className="grid grid-cols-2 gap-3">
						{/* First Name */}
						<div>
							<Input
								{...register("first_name")}
								type="text"
								placeholder="First Name"
								disabled={user.is_staff}
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
								disabled={user.is_staff}
								className={
									errors.last_name ? "border-red-500" : ""
								}
							/>
							{errors.last_name && (
								<p className="text-red-500 text-xs mt-1">
									{errors.last_name.message}
								</p>
							)}
						</div>

						{/* Username */}
						<div>
							<Input
								{...register("username")}
								type="text"
								placeholder="Username"
								disabled={user.is_staff}
								className={
									errors.username ? "border-red-500" : ""
								}
							/>
							{errors.username && (
								<p className="text-red-500 text-xs mt-1">
									{errors.username.message}
								</p>
							)}
						</div>

						{/* Email */}
						<div>
							<Input
								{...register("email")}
								type="email"
								placeholder="Email"
								disabled={user.is_staff}
								className={errors.email ? "border-red-500" : ""}
							/>
							{errors.email && (
								<p className="text-red-500 text-xs mt-1">
									{errors.email.message}
								</p>
							)}
						</div>
					</div>
				</ModalSection>

				<ModalSection title="Role">
					{/* Role */}
					<div className="mb-3 w-full">
						<div className="w-full justify-end">
							<Controller
								name="role"
								control={control}
								render={({ field }) => {
									console.log(
										"Role field value:",
										field.value
									); // Debug log
									return (
										<Select
											onValueChange={(value) => {
												console.log(
													"Role changing to:",
													value
												); // Debug log
												field.onChange(value);
											}}
											value={field.value}
										>
											<SelectTrigger className="w-[180px]">
												<SelectValue placeholder="Set Role" />
											</SelectTrigger>
											<SelectContent className="z-[1000]">
												<SelectGroup>
													<SelectLabel>
														Role
													</SelectLabel>
													<SelectItem value="none">
														None
													</SelectItem>

													{(authStore.isAdmin ||
														authStore.user?.role ===
															"botanist") &&
														user.is_staff && (
															<SelectItem value="botanist">
																Approved
																Botanist
															</SelectItem>
														)}

													{user.is_staff && (
														<SelectItem value="finance">
															Finance Officer
														</SelectItem>
													)}

													{!user.is_staff && (
														<SelectItem value="police">
															Police
														</SelectItem>
													)}
												</SelectGroup>
											</SelectContent>
										</Select>
									);
								}}
							/>

							{errors.role && (
								<p className="text-red-500 text-xs mt-1">
									{errors.role.message}
								</p>
							)}
						</div>
					</div>
					{selectedRole === "none" && (
						<span className="text-gray-500 text-sm mb-3">
							This user will have no role and cannot perform
							actions
						</span>
					)}

					{selectedRole === "police" && (
						<span className="text-gray-500 text-sm mb-3">
							This user will be assigned as police, fill out their
							details
						</span>
					)}

					{selectedRole === "botanist" && (
						<span className="text-gray-500 text-sm mb-3">
							This user will be assigned as an approved botanist
						</span>
					)}

					{selectedRole === "finance" && (
						<span className="text-gray-500 text-sm mb-3">
							This user will be assigned as finance officer
						</span>
					)}

					{/* Police-specific fields */}
					{selectedRole === "police" && (
						<>
							<div className="mb-2 grid grid-cols-2 gap-3">
								<div>
									<Label
										htmlFor="police_id"
										className="text-[12px] font-semibold ml-1"
									>
										Police ID
									</Label>
									<Input
										{...register("police_id")}
										id="police_id"
										type="text"
										placeholder="Police ID"
										disabled={user.is_staff}
									/>
								</div>

								<div className="mb-3">
									<Label
										htmlFor="station"
										className="text-[12px] font-semibold ml-1"
									>
										Station
									</Label>
									<Controller
										name="station"
										control={control}
										render={({ field }) => (
											<PoliceStationCombobox
												value={field.value}
												onValueChange={field.onChange}
												disabled={user.is_staff}
											/>
										)}
									/>
									{errors.station && (
										<p className="text-red-500 text-xs mt-1">
											{errors.station.message}
										</p>
									)}
								</div>
							</div>

							<div className="flex gap-3 mb-3 justify-between">
								<div>
									<Controller
										name="rank"
										control={control}
										render={({ field }) => {
											console.log(
												"Rank field value:",
												field.value
											); // Debug log
											return (
												<Select
													onValueChange={(value) => {
														console.log(
															"Rank changing to:",
															value
														); // Debug log
														field.onChange(value);
													}}
													value={field.value}
												>
													<SelectTrigger className="!w-full">
														<SelectValue placeholder="Set seniority" />
													</SelectTrigger>
													<SelectContent className="z-[1000]">
														<SelectGroup>
															<SelectLabel>
																Rank
															</SelectLabel>
															{POLICE_SENIORITY_OPTIONS.map(
																(seniority) => (
																	<SelectItem
																		key={
																			seniority
																		}
																		value={
																			seniority
																		}
																	>
																		{
																			SENIORITY_DISPLAY_MAP[
																				seniority
																			]
																		}
																	</SelectItem>
																)
															)}
														</SelectGroup>
													</SelectContent>
												</Select>
											);
										}}
									/>
								</div>

								<div className="flex gap-2 items-center">
									<Label htmlFor="sworn">Sworn?</Label>
									<Controller
										name="is_sworn"
										control={control}
										render={({ field }) => (
											<Checkbox
												id="sworn"
												checked={field.value}
												onCheckedChange={field.onChange}
											/>
										)}
									/>
								</div>
							</div>
						</>
					)}
				</ModalSection>

				{/* Footer moved outside form but buttons trigger form actions */}
				<ResponsiveModalFooter>
					<Button
						type="button"
						variant="cancel"
						onClick={onCancel}
						disabled={isSubmitting}
					>
						Cancel
					</Button>
					<Button
						type="submit"
						variant="cannabis"
						disabled={isSubmitting}
					>
						{isSubmitting ? "Updating..." : "Update"}
					</Button>
				</ResponsiveModalFooter>
			</form>
		);
	}
);

export default EditUserForm;
