import { Button } from "@/components/ui/button";
import {
	ResponsiveModal,
	ResponsiveModalContent,
	ResponsiveModalFooter,
} from "@/components/ui/custom/ResponsiveModal";
import { Spinner } from "@/components/ui/custom/Spinner";
import {
	useSubmissionById,
	useSubmissions,
} from "@/hooks/tanstack/useSubmissions";
import { AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export const DeleteSubmissionModal = () => {
	const navigate = useNavigate();
	const { submissionId } = useParams();

	const { submission, isLoading } = useSubmissionById(submissionId!);
	const { deleteSubmission, isDeletingSubmission } = useSubmissions();

	const handleClose = () => {
		navigate("/submissions");
	};

	const handleDelete = async () => {
		if (!submissionId) return;

		try {
			await deleteSubmission(submissionId);
			toast.success("Submission deleted successfully!");
			handleClose();
		} catch (error) {
			toast.error("Failed to delete submission");
			console.error("Delete error:", error);
		}
	};

	if (isLoading || !submission) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => {
					if (!open) handleClose();
				}}
			>
				<ResponsiveModalContent
					side={"bottom"}
					title="Delete Submission"
					description="Loading submission information..."
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
				title="Delete Submission"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					<div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
						<div>
							<h4 className="font-semibold text-red-800">
								Are you sure you want to delete this submission?
							</h4>
							<p className="text-sm text-red-600 mt-1">
								This action is permanent and cannot be undone.
								All associated baggies and certificates will
								also be deleted.
							</p>
						</div>
					</div>

					<div className="bg-gray-50 p-4 rounded-lg">
						<h5 className="font-medium text-gray-900 mb-2">
							Submission Details:
						</h5>
						<div className="space-y-1 text-sm">
							<div>
								<span className="font-medium text-gray-700">
									ID:
								</span>{" "}
								<span>#{submission.id}</span>
							</div>
							{submission.police_officer && (
								<div>
									<span className="font-medium text-gray-700">
										Police Officer:
									</span>{" "}
									<span>
										{
											submission.police_officer.user
												.first_name
										}{" "}
										{
											submission.police_officer.user
												.last_name
										}
									</span>
								</div>
							)}
							{submission.dbca_submitter && (
								<div>
									<span className="font-medium text-gray-700">
										DBCA Submitter:
									</span>{" "}
									<span>
										{
											submission.dbca_submitter.user
												.first_name
										}{" "}
										{
											submission.dbca_submitter.user
												.last_name
										}
									</span>
								</div>
							)}
							<div>
								<span className="font-medium text-gray-700">
									Created:
								</span>{" "}
								<span>
									{new Date(
										submission.created_at
									).toLocaleDateString()}
								</span>
							</div>
							{submission.baggies && (
								<div>
									<span className="font-medium text-gray-700">
										Baggies:
									</span>{" "}
									<span>
										{submission.baggies.length} items
									</span>
								</div>
							)}
						</div>
					</div>

					<div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
						<p className="text-sm text-amber-800">
							⚠️ Deleting this submission will permanently remove
							all associated evidence records and certificates.
						</p>
					</div>
				</div>

				<ResponsiveModalFooter>
					<Button
						type="button"
						variant="outline"
						onClick={handleClose}
						disabled={isDeletingSubmission}
					>
						Cancel
					</Button>
					<Button
						type="button"
						variant="destructive"
						onClick={handleDelete}
						disabled={isDeletingSubmission}
					>
						{isDeletingSubmission
							? "Deleting..."
							: "Delete Submission"}
					</Button>
				</ResponsiveModalFooter>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
