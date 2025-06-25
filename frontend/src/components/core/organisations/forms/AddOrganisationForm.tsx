import { Button } from "@/components/ui/button";
import { ResponsiveModalFooter } from "@/components/ui/custom/ResponsiveModal";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddOrganisationFormData } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
import { addOrganisationSchema } from "./schemas/addOrganisationSchema";
import { ModalSection } from "@/components/layout/ModalSection";

interface AddOrganisationFormProps {
	onCancel: () => void;
	onSubmit: (data: AddOrganisationFormData) => void;
	isSubmitting?: boolean;
}

const AddOrganisationForm = observer(
	({
		onCancel,
		onSubmit,
		isSubmitting = false,
	}: AddOrganisationFormProps) => {
		// React Hook Form setup
		const {
			register,
			handleSubmit,
			formState: { errors },
		} = useForm<AddOrganisationFormData>({
			resolver: zodResolver(addOrganisationSchema),
			defaultValues: {
				name: "",
				address: "",
				phone_number: "",
				email: "",
			},
		});

		const handleFormSubmit = (data: AddOrganisationFormData) => {
			console.log("Form data:", data);
			onSubmit(data);
		};

		return (
			<form
				onSubmit={handleSubmit(handleFormSubmit)}
				className="flex flex-col"
			>
				{/* Organisation Details */}
				<ModalSection title="Organisation Details" isFirst>
					<div className="space-y-4">
						{/* Name */}
						<div>
							<Label
								htmlFor="name"
								className="text-sm font-medium"
							>
								Organisation Name *
							</Label>
							<Input
								{...register("name")}
								id="name"
								type="text"
								placeholder="Police Station Name"
								className={errors.name ? "border-red-500" : ""}
							/>
							{errors.name && (
								<p className="text-red-500 text-xs mt-1">
									{errors.name.message}
								</p>
							)}
						</div>

						{/* Address */}
						<div>
							<Label
								htmlFor="address"
								className="text-sm font-medium"
							>
								Address
							</Label>
							<Input
								{...register("address")}
								id="address"
								type="text"
								placeholder="Street address"
								className={
									errors.address ? "border-red-500" : ""
								}
							/>
							{errors.address && (
								<p className="text-red-500 text-xs mt-1">
									{errors.address.message}
								</p>
							)}
						</div>

						<div className="grid grid-cols-2 gap-3">
							{/* Phone Number */}
							<div>
								<Label
									htmlFor="phone_number"
									className="text-sm font-medium"
								>
									Phone Number
								</Label>
								<Input
									{...register("phone_number")}
									id="phone_number"
									type="tel"
									placeholder="(08) 1234 5678"
									className={
										errors.phone_number
											? "border-red-500"
											: ""
									}
								/>
								{errors.phone_number && (
									<p className="text-red-500 text-xs mt-1">
										{errors.phone_number.message}
									</p>
								)}
							</div>

							{/* Email */}
							<div>
								<Label
									htmlFor="email"
									className="text-sm font-medium"
								>
									Email Address
								</Label>
								<Input
									{...register("email")}
									id="email"
									type="email"
									placeholder="station@police.wa.gov.au"
									className={
										errors.email ? "border-red-500" : ""
									}
								/>
								{errors.email && (
									<p className="text-red-500 text-xs mt-1">
										{errors.email.message}
									</p>
								)}
							</div>
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
						disabled={isSubmitting}
					>
						{isSubmitting ? "Creating..." : "Create Organisation"}
					</Button>
				</ResponsiveModalFooter>
			</form>
		);
	}
);

export default AddOrganisationForm;
