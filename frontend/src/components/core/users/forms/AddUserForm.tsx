import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ResponsiveModalFooter } from "@/components/ui/custom/ResponsiveModal";
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
import { useAuthStore } from "@/stores/rootStore";
import { AddUserFormData } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react";
import { Controller, useForm } from "react-hook-form";
import { addUserSchema } from "./schemas/addUserSchema";
import { POLICE_SENIORITY_OPTIONS, SENIORITY_DISPLAY_MAP } from "./utils";
import PoliceStationCombobox from "./PoliceStationCombobox";
import { ModalSection } from "@/components/layout/ModalSection";

interface AddUserFormProps {
	onCancel: () => void;
	onSubmit: (data: AddUserFormData) => void;
	isSubmitting?: boolean;
}

const AddUserForm = observer(
	({ onCancel, onSubmit, isSubmitting = false }: AddUserFormProps) => {
		const authStore = useAuthStore();

		// React Hook Form setup
		const {
			register,
			handleSubmit,
			control,
			watch,
			formState: { errors },
		} = useForm<AddUserFormData>({
			resolver: zodResolver(addUserSchema),
			defaultValues: {
				first_name: "",
				last_name: "",
				email: "",
				role: "police",
				police_id: "",
				station: "",
				rank: "officer",
				is_sworn: false,
			},
		});

		// Watch role to conditionally show police fields
		const selectedRole = watch("role");

		const handleFormSubmit = (data: AddUserFormData) => {
			console.log("Form data:", data);

			// Generate username based on email or name + year
			let username = "";
			if (data.email && data.email.trim()) {
				username = data.email.trim();
			} else {
				const currentYear = new Date().getFullYear();
				username = `${data.first_name.toLowerCase()}${data.last_name.toLowerCase()}${currentYear}`;
			}

			// Transform the data to match backend expectations
			const transformedData = {
				first_name: data.first_name,
				last_name: data.last_name,
				username: username,
				email: data.email || "",
				role: data.role,
				// Police profile fields
				police_id: data.police_id || "",
				station_id: data.station ? parseInt(data.station) : null,
				rank: data.rank || "officer",
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

						{/* Email - spans both columns */}
						<div className="col-span-2">
							<Input
								{...register("email")}
								type="email"
								placeholder="Email (optional)"
								className={errors.email ? "border-red-500" : ""}
							/>
							{errors.email && (
								<p className="text-red-500 text-xs mt-1">
									{errors.email.message}
								</p>
							)}
							<p className="text-gray-500 text-xs mt-1 text-justify">
								If no email is provided, username is generated
								from name and year. If the user requires access,
								an email must be provided.
							</p>
						</div>
					</div>
				</ModalSection>

				<ModalSection title="Role & Permissions">
					{/* Role */}
					<div className="mb-3 w-full">
						<div className="w-full justify-end">
							<Controller
								name="role"
								control={control}
								render={({ field }) => (
									<Select
										onValueChange={field.onChange}
										value={field.value}
									>
										<SelectTrigger className="w-[180px]">
											<SelectValue placeholder="Set Role" />
										</SelectTrigger>
										<SelectContent className="z-[1000]">
											<SelectGroup>
												<SelectLabel>Role</SelectLabel>
												<SelectItem value="none">
													None
												</SelectItem>

												{(authStore.isAdmin ||
													authStore.user?.role ===
														"botanist") && (
													<SelectItem value="botanist">
														Approved Botanist
													</SelectItem>
												)}

												{authStore.isAdmin && (
													<SelectItem value="finance">
														Finance Officer
													</SelectItem>
												)}

												<SelectItem value="police">
													Police
												</SelectItem>
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
					</div>

					{/* Role Descriptions */}
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
									/>
									{errors.police_id && (
										<p className="text-red-500 text-xs mt-1">
											{errors.police_id.message}
										</p>
									)}
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
									<Label
										htmlFor="rank"
										className="text-[12px] font-semibold ml-1 mb-1 block"
									>
										Rank
									</Label>
									<Controller
										name="rank"
										control={control}
										render={({ field }) => (
											<Select
												onValueChange={field.onChange}
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
										)}
									/>
									{errors.rank && (
										<p className="text-red-500 text-xs mt-1">
											{errors.rank.message}
										</p>
									)}
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
						disabled={isSubmitting}
					>
						{isSubmitting ? "Creating..." : "Create User"}
					</Button>
				</ResponsiveModalFooter>
			</form>
		);
	}
);

export default AddUserForm;
