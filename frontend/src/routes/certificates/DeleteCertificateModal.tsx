import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalFooter,
} from "@/components/ui/custom/ResponsiveModal";
import { Spinner } from "@/components/ui/custom/Spinner";
import {
	useCertificateById,
	useSubmissions,
} from "@/hooks/tanstack/useSubmissions";
import { AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export const DeleteCertificateModal = () => {
	const navigate = useNavigate();
	const { certificateId } = useParams();

	const { certificate, isLoading } = useCertificateById(certificateId!);
	const { deleteCertificate, isDeletingCertificate } = useSubmissions();

	const handleClose = () => {
		navigate("/certificates");
	};

	const handleDelete = async () => {
		if (!certificateId) return;

		try {
			await deleteCertificate(certificateId);
			toast.success("Certificate deleted successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to delete certificate");
			console.error("Delete error:", error);
		}
	};

	if (isLoading || !certificate) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => {
					if (!open) handleClose();
				}}
			>
				<ResponsiveModalContent
					side={"bottom"}
					title="Delete Certificate"
					description="Loading certificate information..."
				>
					<div className="flex justify-center py-8">
						<Spinner />
					</div>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side={"bottom"}
				title="Delete Certificate"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					<div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
						<div>
							<h4 className="font-semibold text-red-800">
								Are you sure you want to delete this
								certificate?
							</h4>
							<p className="text-sm text-red-600 mt-1">
								This action is permanent and cannot be undone.
								The certificate record will be permanently
								removed.
							</p>
						</div>
					</div>

					<div className="bg-gray-50 p-4 rounded-lg">
						<h5 className="font-medium text-gray-900 mb-2">
							Certificate Details:
						</h5>
						<div className="space-y-1 text-sm">
							<div>
								<span className="font-medium text-gray-700">
									Certificate ID:
								</span>{" "}
								<span>#{certificate.id}</span>
							</div>
							<div>
								<span className="font-medium text-gray-700">
									Submission ID:
								</span>{" "}
								<span>#{certificate.submission}</span>
							</div>
							<div>
								<span className="font-medium text-gray-700">
									Identification Fee:
								</span>{" "}
								<span>${certificate.identification_fee}</span>
							</div>
							{/* {certificate.total_fee && (
								<div>
									<span className="font-medium text-gray-700">
										Total Fee:
									</span>{" "}
									<span>${certificate.total_fee}</span>
								</div>
							)} */}
							<div>
								<span className="font-medium text-gray-700">
									Created:
								</span>{" "}
								<span>
									{new Date(
										certificate.created_at
									).toLocaleDateString()}
								</span>
							</div>
						</div>
					</div>

					<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<p className="text-sm text-amber-800">
							⚠️ This certificate may be referenced in official
							records. Deletion will affect audit trails.
						</p>
					</div>
				</div>

				<ResponsiveModalFooter>
					<Button
						type="button"
						variant="outline"
						onClick={handleClose}
						disabled={isDeletingCertificate}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={handleDelete}
						disabled={isDeletingCertificate}
					>
						{isDeletingCertificate
							? "Deleting..."
							: "Delete Certificate"}
					</Button>
				</ResponsiveModalFooter>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
