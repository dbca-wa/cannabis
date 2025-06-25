import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Controller, useForm } from "react-hook-form";
import { ResponsiveModalFooter } from "@/components/ui/custom/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { ModalSection } from "@/components/layout/ModalSection";
import { Input } from "@/components/ui/input";
import { Label } from "@radix-ui/react-label";
import { AddCertificateFormData, Submission } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { addCertificateSchema } from "./schemas/addCertificateSchema";
import { observer } from "mobx-react";
import { useSubmissions } from "@/hooks/tanstack/useSubmissions";

export const AddCertificateForm = observer(
	({ onCancel, onSubmit, isSubmitting = false }) => {
		const { submissions } = useSubmissions(); // Get available submissions

		const {
			register,
			handleSubmit,
			control,
			formState: { errors },
		} = useForm({
			resolver: zodResolver(addCertificateSchema),
			defaultValues: {
				identification_fee: 10,
				submission: 0,
			},
		});

		const handleFormSubmit = (data: AddCertificateFormData) => {
			console.log("Form data:", data);
			onSubmit(data);
		};

		return (
			<form
				onSubmit={handleSubmit(handleFormSubmit)}
				className="flex flex-col"
			>
				<ModalSection title="New Certificate" isFirst>
					<div className="space-y-4">
						{/* Submission Selection */}
						<div>
							<Label
								htmlFor="submission"
								className="text-sm font-medium"
							>
								Select Submission *
							</Label>
							<Controller
								name="submission"
								control={control}
								render={({ field }) => (
									<Select
										onValueChange={(value) =>
											field.onChange(parseInt(value))
										}
										value={field.value?.toString()}
									>
										<SelectTrigger
											className={
												errors.submission
													? "border-red-500"
													: ""
											}
										>
											<SelectValue placeholder="Select a submission" />
										</SelectTrigger>
										<SelectContent>
											{submissions.map(
												(submission: Submission) => (
													<SelectItem
														key={submission.id}
														value={submission.id.toString()}
													>
														#{submission.id} -{" "}
														{submission.police_officer
															? `${submission.police_officer.user.first_name} ${submission.police_officer.user.last_name}`
															: "No officer"}
													</SelectItem>
												)
											)}
										</SelectContent>
									</Select>
								)}
							/>
							{errors.submission && (
								<p className="text-red-500 text-xs mt-1">
									{errors.submission.message}
								</p>
							)}
						</div>

						{/* Identification Fee */}
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

						{/* Info Box */}
						<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
							<p className="text-sm text-blue-800">
								💡 The total fee will be calculated based on the
								number of baggies in the selected submission.
							</p>
						</div>
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
						{isSubmitting ? "Creating..." : "Create Certificate"}
					</Button>
				</ResponsiveModalFooter>
			</form>
		);
	}
);
