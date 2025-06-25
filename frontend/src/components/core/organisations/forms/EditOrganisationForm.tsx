import { Button } from "@/components/ui/button";
import { ResponsiveModalFooter } from "@/components/ui/custom/ResponsiveModal";
import { Spinner } from "@/components/ui/custom/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditOrganisationFormData } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { ModalSection } from "../../../layout/ModalSection";
import { usePoliceStationById } from "@/hooks/tanstack/useOrganisations";
import { editOrganisationSchema } from "./schemas/editOrganisationsSchema";

interface EditOrganisationFormProps {
	onCancel: () => void;
	onSubmit: (data: EditOrganisationFormData) => void;
	isSubmitting?: boolean;
}

const EditOrganisationForm = observer(
	({
		onCancel,
		onSubmit,
		isSubmitting = false,
	}: EditOrganisationFormProps) => {
		const { organisationId } = useParams();
		const { station, isLoading, error, refetch } = usePoliceStationById(
			organisationId!
		);
		const [formInitialized, setFormInitialized] = useState(false);

		// Force refetch when component mounts
		useEffect(() => {
			console.log("EditOrganisationForm mounted, forcing refetch");
			refetch();
		}, [refetch]);

		// React Hook Form setup
		const {
			register,
			handleSubmit,
			reset,
			formState: { errors },
		} = useForm<EditOrganisationFormData>({
			resolver: zodResolver(editOrganisationSchema),
			defaultValues: {
				name: "",
				address: "",
				phone_number: "",
				email: "",
			},
		});

		// Reset form when station data changes
		useEffect(() => {
			if (station && !isLoading) {
				console.log("Station data for form population:", station);

				setFormInitialized(false);

				const formData = {
					name: station.name || "",
					address: station.address || "",
					phone_number: station.phone_number || "",
					email: station.email || "",
				};

				console.log("Form data to reset with:", formData);
				reset(formData);
				setFormInitialized(true);
			}
		}, [station, isLoading, reset]);

		if (!station || isLoading || !formInitialized) {
			return (
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			);
		}

		const handleFormSubmit = (data: EditOrganisationFormData) => {
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
						{isSubmitting ? "Updating..." : "Update Organisation"}
					</Button>
				</ResponsiveModalFooter>
			</form>
		);
	}
);

export default EditOrganisationForm;
