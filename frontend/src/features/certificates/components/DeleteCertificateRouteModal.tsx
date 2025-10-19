import { useNavigate, useParams } from "react-router";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
	useCertificateById,
	useDeleteCertificate,
} from "../hooks/useCertificates";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export const DeleteCertificateRouteModal = () => {
	const navigate = useNavigate();
	const { certificateId } = useParams();
	const id = certificateId ? parseInt(certificateId) : null;

	const { data: certificate, isLoading, error } = useCertificateById(id);
	const deleteCertificate = useDeleteCertificate();

	const handleClose = () => {
		navigate("/docs/certificates");
	};

	const handleDelete = async () => {
		if (!id) return;

		try {
			await deleteCertificate.mutateAsync(id);
			handleClose();
		} catch (error) {
			// Error is handled by the mutation
			console.error("Failed to delete certificate:", error);
		}
	};

	if (isLoading) {
		return (
			<AlertDialog open={true} onOpenChange={handleClose}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Certificate</AlertDialogTitle>
						<AlertDialogDescription>
							<div className="space-y-2">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-3/4" />
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction disabled>Delete</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	if (error || !certificate) {
		return (
			<AlertDialog open={true} onOpenChange={handleClose}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete Certificate</AlertDialogTitle>
						<AlertDialogDescription>
							<div className="flex flex-col items-center justify-center py-4">
								<AlertCircle className="h-12 w-12 text-red-500 mb-4" />
								<p className="text-center">
									{error
										? "Failed to load certificate"
										: "Certificate not found"}
								</p>
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Close</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}

	return (
		<AlertDialog open={true} onOpenChange={handleClose}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Delete Certificate</AlertDialogTitle>
					<AlertDialogDescription>
						Are you sure you want to delete certificate{" "}
						<strong>{certificate.certificate_number}</strong>?
						<br />
						<br />
						This action cannot be undone. The certificate PDF and
						all associated data will be permanently removed.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={deleteCertificate.isPending}>
						Cancel
					</AlertDialogCancel>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteCertificate.isPending}
					>
						{deleteCertificate.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						Delete Certificate
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
};
