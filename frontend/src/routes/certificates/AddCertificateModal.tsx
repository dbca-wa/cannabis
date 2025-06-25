import { AddCertificateForm } from "@/components/core/certificates/forms/AddCertificateForm";
import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/components/ui/custom/ResponsiveModal";
import { useSubmissions } from "@/hooks/tanstack/useSubmissions";
import { AddCertificateFormData } from "@/types";
import { useNavigate } from "react-router";
import { toast } from "sonner";

export const AddCertificateModal = () => {
	const navigate = useNavigate();
	const { isCreatingCertificate, createCertificate } = useSubmissions();

	const handleClose = () => {
		navigate("/certificates");
	};

	const handleSubmit = async (data: AddCertificateFormData) => {
		try {
			await createCertificate(data);
			toast.success("Certificate created successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to create certificate");
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
				title="Add Certificate"
				description="Create a new identification certificate"
			>
				<AddCertificateForm
					onCancel={handleClose}
					onSubmit={handleSubmit}
					isSubmitting={isCreatingCertificate}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
