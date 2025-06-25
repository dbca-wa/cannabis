import { AddSubmissionForm } from "@/components/core/submissions/forms/AddSubmissionForm";
import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/components/ui/custom/ResponsiveModal";
import { useSubmissions } from "@/hooks/tanstack/useSubmissions";
import { AddSubmissionFormData } from "@/types";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export const AddSubmissionModal = () => {
	const navigate = useNavigate();
	const { isCreatingSubmission, createSubmission } = useSubmissions();

	const handleClose = () => {
		navigate("/submissions");
	};

	const handleSubmit = async (data: AddSubmissionFormData) => {
		try {
			await createSubmission(data);
			toast.success("Submission created successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to create submission");
			console.error("Create error:", error);
		}
	};

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side={"bottom"}
				title="Add Submission"
				description="Create a new cannabis submission"
			>
				<AddSubmissionForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isCreatingSubmission}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
