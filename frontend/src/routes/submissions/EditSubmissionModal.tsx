import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/components/ui/custom/ResponsiveModal";
import { useSubmissions } from "@/hooks/tanstack/useSubmissions";
import { EditSubmissionFormData } from "@/types";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import EditSubmissionForm from "../../components/core/submissions/forms/EditSubmissionForm";

export const EditSubmissionModal = () => {
	const navigate = useNavigate();
	const { submissionId } = useParams();
	const { updateSubmission, isUpdatingSubmission, refreshSubmission } =
		useSubmissions();

	const handleClose = () => {
		navigate("/submissions");
	};

	const handleSubmit = async (transformedData: EditSubmissionFormData) => {
		if (!submissionId) return;

		console.log("Transformed data from form:", transformedData);

		try {
			await updateSubmission({
				id: submissionId,
				data: transformedData,
			});

			await refreshSubmission(submissionId);

			toast.success("Submission updated successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to update submission");
			console.error("Update error:", error);
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
				title="Edit Submission"
				description="Update submission information and details"
			>
				<EditSubmissionForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isUpdatingSubmission}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
