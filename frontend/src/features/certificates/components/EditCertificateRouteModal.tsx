import { useNavigate, useParams } from "react-router";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/shared/components/ui/dialog";
import { EditCertificateForm } from "./forms";
import {
	useCertificateById,
	useUpdateCertificate,
} from "../hooks/useCertificates";
import type { EditCertificateFormData } from "../schemas/certificateSchemas";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export const EditCertificateRouteModal = () => {
	const navigate = useNavigate();
	const { certificateId } = useParams();
	const id = certificateId ? parseInt(certificateId) : null;

	const { data: certificate, isLoading, error } = useCertificateById(id);
	const updateCertificate = useUpdateCertificate();

	const handleClose = () => {
		navigate("/docs/certificates");
	};

	const handleSubmit = async (data: EditCertificateFormData) => {
		if (!id) return;

		try {
			await updateCertificate.mutateAsync({
				id,
				data: {
					submission: data.submission,
				},
			});
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Failed to update certificate:", error);
		}
	};

	return (
		<Dialog open={true} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Edit Certificate</DialogTitle>
					<DialogDescription>
						Update the certificate details. The certificate number
						cannot be changed.
					</DialogDescription>
				</DialogHeader>

				{isLoading ? (
					<div className="space-y-4">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : error || !certificate ? (
					<div className="flex flex-col items-center justify-center py-8">
						<AlertCircle className="h-12 w-12 text-red-500 mb-4" />
						<p className="text-center text-gray-600 dark:text-gray-400 mb-4">
							{error
								? "Failed to load certificate"
								: "Certificate not found"}
						</p>
						<Button onClick={handleClose}>Close</Button>
					</div>
				) : (
					<EditCertificateForm
						certificate={certificate}
						onSubmit={handleSubmit}
						onCancel={handleClose}
						isSubmitting={updateCertificate.isPending}
					/>
				)}
			</DialogContent>
		</Dialog>
	);
};
