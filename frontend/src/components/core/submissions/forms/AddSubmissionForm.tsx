import { zodResolver } from "@hookform/resolvers/zod";
import { observer } from "mobx-react";
import { useForm } from "react-hook-form";
import { addSubmissionSchema } from "./schemas/addSubmissionSchema";
import { ModalSection } from "@/components/layout/ModalSection";
import { ResponsiveModalFooter } from "@/components/ui/custom/ResponsiveModal";
import { Button } from "@/components/ui/button";
import { AddSubmissionFormData } from "@/types";

export const AddSubmissionForm = observer(
	({ onCancel, onSubmit, isSubmitting = false }) => {
		const {
			register,
			handleSubmit,
			formState: { errors },
		} = useForm({
			resolver: zodResolver(addSubmissionSchema),
			defaultValues: {
				// Add default values
			},
		});

		const handleFormSubmit = (data: AddSubmissionFormData) => {
			console.log("Form data:", data);
			onSubmit(data);
		};

		return (
			<form
				onSubmit={handleSubmit(handleFormSubmit)}
				className="flex flex-col"
			>
				<ModalSection title="New Submission" isFirst>
					<div className="space-y-4">
						<div className="text-sm text-gray-600">
							Creating a new cannabis submission...
						</div>

						{/* Add form fields for creating submissions */}
						<div className="text-center py-8">
							<p className="text-gray-500">
								Submission form fields will be added based on
								your requirements.
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
						{isSubmitting ? "Creating..." : "Create Submission"}
					</Button>
				</ResponsiveModalFooter>
			</form>
		);
	}
);
