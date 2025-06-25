import { Button } from "@/components/ui/button";
import { ResponsiveModalFooter } from "@/components/ui/custom/ResponsiveModal";
import { Spinner } from "@/components/ui/custom/Spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EditCertificateFormData } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { editCertificateSchema } from "./schemas/editCertificateSchema";
import { useCertificateById } from "@/hooks/tanstack/useSubmissions";
import { ModalSection } from "@/components/layout/ModalSection";

interface EditCertificateFormProps {
	onCancel: () => void;
	onSubmit: (data: EditCertificateFormData) => void;
	isSubmitting?: boolean;
}

const EditCertificateForm = observer(
	({
		onCancel,
		onSubmit,
		isSubmitting = false,
	}: EditCertificateFormProps) => {
		const { certificateId } = useParams();
		const { certificate, isLoading, refetch } = useCertificateById(
			certificateId!
		);
		const [formInitialized, setFormInitialized] = useState(false);

		useEffect(() => {
			console.log("EditCertificateForm mounted, forcing refetch");
			refetch();
		}, [refetch]);

		const {
			register,
			handleSubmit,
			reset,
			formState: { errors },
		} = useForm<EditCertificateFormData>({
			resolver: zodResolver(editCertificateSchema),
			defaultValues: {
				identification_fee: 10,
				submission: 0,
			},
		});

		useEffect(() => {
			if (certificate && !isLoading) {
				console.log(
					"Certificate data for form population:",
					certificate
				);

				setFormInitialized(false);

				const formData = {
					identification_fee: certificate.identification_fee || 10,
					submission: certificate.submission,
				};

				console.log("Form data to reset with:", formData);
				reset(formData);
				setFormInitialized(true);
			}
		}, [certificate, isLoading, reset]);

		if (!certificate || isLoading || !formInitialized) {
			return (
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			);
		}

		const handleFormSubmit = (data: EditCertificateFormData) => {
			console.log("Form data:", data);
			onSubmit(data);
		};

		return (
			<form
				onSubmit={handleSubmit(handleFormSubmit)}
				className="flex flex-col"
			>
				<ModalSection title="Certificate Details" isFirst>
					<div className="space-y-4">
						{/* Certificate Info */}
						<div className="bg-gray-50 p-3 rounded-lg">
							<div className="text-sm space-y-1">
								<div>
									<span className="font-medium">
										Certificate ID:
									</span>{" "}
									#{certificate.id}
								</div>
								<div>
									<span className="font-medium">
										Submission:
									</span>{" "}
									#{certificate.submission}
								</div>
								<div>
									<span className="font-medium">
										Created:
									</span>{" "}
									{new Date(
										certificate.created_at
									).toLocaleDateString()}
								</div>
								{certificate.total_fee && (
									<div>
										<span className="font-medium">
											Current Total Fee:
										</span>{" "}
										${certificate.total_fee}
									</div>
								)}
							</div>
						</div>

						{/* Editable Fields */}
						<div>
							<Label
								htmlFor="identification_fee"
								className="text-sm font-medium"
							>
								Identification Fee (per bag) *
							</Label>
							<Input
								{...register("identification_fee", {
									valueAsNumber: true,
								})}
								id="identification_fee"
								type="number"
								step="0.01"
								min="0"
								placeholder="10.00"
								className={
									errors.identification_fee
										? "border-red-500"
										: ""
								}
							/>
							{errors.identification_fee && (
								<p className="text-red-500 text-xs mt-1">
									{errors.identification_fee.message}
								</p>
							)}
						</div>

						{/* Read-only submission field */}
						<div>
							<Label
								htmlFor="submission"
								className="text-sm font-medium"
							>
								Submission ID
							</Label>
							<Input
								{...register("submission", {
									valueAsNumber: true,
								})}
								id="submission"
								type="number"
								readOnly
								className="bg-gray-100"
							/>
						</div>

						{/* Fee Calculation Info */}
						{certificate.baggy_count && (
							<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
								<p className="text-sm text-blue-800">
									💡 This certificate covers{" "}
									{certificate.baggy_count} bag(s). Total fee
									will be: $
									{(
										certificate.identification_fee *
										certificate.baggy_count
									).toFixed(2)}
								</p>
							</div>
						)}
					</div>
				</ModalSection>

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
						{isSubmitting ? "Updating..." : "Update Certificate"}
					</Button>
				</ResponsiveModalFooter>
			</form>
		);
	}
);

export default EditCertificateForm;
