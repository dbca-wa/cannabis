import EditCertificateForm from "@/components/core/certificates/forms/EditCertificateForm";
import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/components/ui/custom/ResponsiveModal";
import { useSubmissions } from "@/hooks/tanstack/useSubmissions";
import { EditCertificateFormData } from "@/types";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export const EditCertificateModal = () => {
	const navigate = useNavigate();
	const { certificateId } = useParams();
	const { updateCertificate, isUpdatingCertificate } = useSubmissions();

	const handleClose = () => {
		navigate("/certificates");
	};

	const handleSubmit = async (transformedData: EditCertificateFormData) => {
		if (!certificateId) return;

		console.log("Transformed data from form:", transformedData);

		try {
			await updateCertificate({
				id: certificateId,
				data: transformedData,
			});

			toast.success("Certificate updated successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to update certificate");
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
				title="Edit Certificate"
				description="Update certificate information and fees"
			>
				<EditCertificateForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isUpdatingCertificate}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
