import { Button } from "@/components/ui/button";
import { ResponsiveModalFooter } from "@/components/ui/custom/ResponsiveModal";
import { Spinner } from "@/components/ui/custom/Spinner";
import { Label } from "@/components/ui/label";
import { EditSubmissionFormData } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { editSubmissionSchema } from "./schemas/editSubmissionSchema";
import { useSubmissionById } from "@/hooks/tanstack/useSubmissions";
import { ModalSection } from "@/components/layout/ModalSection";

interface EditSubmissionFormProps {
	onCancel: () => void;
	onSubmit: (data: EditSubmissionFormData) => void;
	isSubmitting?: boolean;
}

const EditSubmissionForm = observer(
	({ onCancel, onSubmit, isSubmitting = false }: EditSubmissionFormProps) => {
		const { submissionId } = useParams();
		const { submission, isLoading, refetch } = useSubmissionById(
			submissionId!
		);
		const [formInitialized, setFormInitialized] = useState(false);

		useEffect(() => {
			console.log("EditSubmissionForm mounted, forcing refetch");
			refetch();
		}, [refetch]);

		const {
			register,
			handleSubmit,
			reset,
			formState: { errors },
		} = useForm<EditSubmissionFormData>({
			resolver: zodResolver(editSubmissionSchema),
			defaultValues: {
				// Add default values based on your submission model
			},
		});

		useEffect(() => {
			if (submission && !isLoading) {
				console.log("Submission data for form population:", submission);

				setFormInitialized(false);

				const formData = {
					// Map submission data to form fields
				};

				console.log("Form data to reset with:", formData);
				reset(formData);
				setFormInitialized(true);
			}
		}, [submission, isLoading, reset]);

		if (!submission || isLoading || !formInitialized) {
			return (
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			);
		}

		const handleFormSubmit = (data: EditSubmissionFormData) => {
			console.log("Form data:", data);
			onSubmit(data);
		};

		return (
			<form
				onSubmit={handleSubmit(handleFormSubmit)}
				className="flex flex-col"
			>
				<ModalSection title="Submission Details" isFirst>
					<div className="space-y-4">
						<div className="text-sm text-gray-600">
							Submission ID: #{submission.id}
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div>
								<Label className="text-sm font-medium">
									Police Officer
								</Label>
								<div className="text-sm">
									{submission.police_officer
										? `${submission.police_officer.user.first_name} ${submission.police_officer.user.last_name}`
										: "Not assigned"}
								</div>
							</div>

							{submission.dbca_submitter && (
								<div>
									<Label className="text-sm font-medium">
										DBCA Submitter
									</Label>
									<div className="text-sm">
										{
											submission.dbca_submitter.user
												.first_name
										}{" "}
										{
											submission.dbca_submitter.user
												.last_name
										}
									</div>
								</div>
							)}
						</div>

						{/* Baggies Section */}
						{submission.baggies &&
							submission.baggies.length > 0 && (
								<div>
									<Label className="text-sm font-medium mb-2 block">
										Baggies ({submission.baggies.length})
									</Label>
									<div className="space-y-2">
										{submission.baggies.map(
											(baggy, index) => (
												<div
													key={baggy.id}
													className="p-2 border rounded text-sm"
												>
													<div>
														Item Type:{" "}
														{baggy.item_type}
													</div>
													<div>
														Units: {baggy.units}
													</div>
													<div>
														Reference:{" "}
														{
															baggy.police_reference_number
														}
													</div>
												</div>
											)
										)}
									</div>
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
						{isSubmitting ? "Updating..." : "Update Submission"}
					</Button>
				</ResponsiveModalFooter>
			</form>
		);
	}
);

export default EditSubmissionForm;
