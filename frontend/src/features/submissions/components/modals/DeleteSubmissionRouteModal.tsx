import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import { useSubmissions, useSubmissionById } from "../../hooks/useSubmissions";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { Button } from "@/shared/components/ui/button";
import { AlertTriangle, FileText, Calendar, User } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { SubmissionsService } from "../../services/submissions.service";

export const DeleteSubmissionRouteModal = () => {
	const navigate = useNavigate();
	const { submissionId } = useParams();
	const { deleteSubmission } = useSubmissions();

	// Fetch submission data
	const {
		data: submission,
		isLoading,
		error,
	} = useSubmissionById(submissionId ? parseInt(submissionId) : null);

	const handleClose = () => {
		navigate("/submissions");
	};

	const handleDelete = async () => {
		if (!submissionId) return;

		try {
			await new Promise<void>((resolve, reject) => {
				deleteSubmission(parseInt(submissionId), {
					onSuccess: () => {
						resolve();
						handleClose();
					},
					onError: (error) => {
						reject(error);
					},
				});
			});
		} catch (error) {
			console.error("Delete submission error:", error);
		}
	};

	if (isLoading) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent
					side="bottom"
					title="Loading..."
					description=""
				>
					<PageLoading text="Loading submission details..." />
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	if (error || !submission) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent
					side="bottom"
					title="Error"
					description=""
				>
					<ErrorAlert
						error={error || "Submission not found"}
						title="Failed to load submission"
						onDismiss={handleClose}
					/>
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	// Check if submission can be deleted (e.g., not in certain phases)
	const canDelete = submission.phase === "data_entry" || submission.is_draft;
	const warningMessage = !canDelete
		? "This submission cannot be deleted because it has progressed beyond the data entry phase. Only draft submissions or submissions in data entry phase can be deleted."
		: null;

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title="Delete Submission"
				description="This action cannot be undone"
			>
				<div className="space-y-4">
					{/* Warning Banner */}
					<div
						className={`flex items-center gap-3 p-4 rounded-lg border ${
							canDelete
								? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
								: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
						}`}
					>
						<AlertTriangle
							className={`h-5 w-5 ${
								canDelete
									? "text-red-600 dark:text-red-400"
									: "text-orange-600 dark:text-orange-400"
							}`}
						/>
						<div className="flex-1">
							<p
								className={`font-medium ${
									canDelete
										? "text-red-900 dark:text-red-100"
										: "text-orange-900 dark:text-orange-100"
								}`}
							>
								{canDelete
									? "Are you sure you want to delete this submission?"
									: "Cannot Delete Submission"}
							</p>
							{warningMessage && (
								<p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
									{warningMessage}
								</p>
							)}
						</div>
					</div>

					{/* Submission Details */}
					<div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
						<div className="flex items-center gap-2">
							<FileText className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-gray-100">
								Case Number:
							</span>
							<span className="text-gray-700 dark:text-gray-300">
								{submission.case_number}
							</span>
							{submission.is_draft && (
								<Badge variant="secondary">Draft</Badge>
							)}
						</div>

						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-gray-100">
								Received:
							</span>
							<span className="text-gray-700 dark:text-gray-300">
								{new Date(
									submission.received
								).toLocaleDateString()}
							</span>
						</div>

						<div className="flex items-center gap-2">
							<User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
							<span className="font-medium text-gray-900 dark:text-gray-100">
								Phase:
							</span>
							<Badge
								className={SubmissionsService.getPhaseBadgeClass(
									submission.phase
								)}
							>
								{submission.phase_display}
							</Badge>
						</div>

						{submission.bags && submission.bags.length > 0 && (
							<div className="flex items-center gap-2">
								<span className="font-medium text-gray-900 dark:text-gray-100">
									Drug Bags:
								</span>
								<span className="text-gray-700 dark:text-gray-300">
									{submission.bags.length} bag(s)
								</span>
							</div>
						)}
					</div>

					{/* Action Buttons */}
					<div className="flex gap-3 justify-end">
						<Button
							variant="outline"
							onClick={handleClose}
							disabled={!canDelete}
						>
							{canDelete ? "Cancel" : "Close"}
						</Button>
						{canDelete && (
							<Button
								variant="destructive"
								onClick={handleDelete}
							>
								Delete Submission
							</Button>
						)}
					</div>
				</div>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
};
