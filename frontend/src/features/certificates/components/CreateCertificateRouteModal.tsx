import { useNavigate } from "react-router";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/shared/components/ui/dialog";
import { CreateCertificateForm } from "./forms";
import { useCreateCertificate } from "../hooks/useCertificates";
import type { CreateCertificateFormData } from "../schemas/certificateSchemas";

export const CreateCertificateRouteModal = () => {
	const navigate = useNavigate();
	const createCertificate = useCreateCertificate();

	const handleClose = () => {
		navigate("/docs/certificates");
	};

	const handleSubmit = async (data: CreateCertificateFormData) => {
		try {
			await createCertificate.mutateAsync({
				submission: data.submission,
			});
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Failed to create certificate:", error);
		}
	};

	return (
		<Dialog open={true} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Generate Certificate</DialogTitle>
					<DialogDescription>
						Generate a botanical identification certificate for a
						submission. The certificate number will be
						auto-generated.
					</DialogDescription>
				</DialogHeader>
				<CreateCertificateForm
					onSubmit={handleSubmit}
					onCancel={handleClose}
					isSubmitting={createCertificate.isPending}
				/>
			</DialogContent>
		</Dialog>
	);
};
