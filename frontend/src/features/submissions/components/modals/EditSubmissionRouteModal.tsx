import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import { SubmissionStoresProvider } from "../../components/providers";
import { useSubmissionFormStore } from "../../hooks/useSubmissionFormStore";
import { CreateSubmissionForm } from "../forms/CreateSubmissionForm";
import { useSubmissions, useSubmissionById } from "../../hooks/useSubmissions";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";

const EditSubmissionRouteModalContent = observer(() => {
	const navigate = useNavigate();
	const { submissionId } = useParams();
	const formStore = useSubmissionFormStore();
	const { updateSubmission } = useSubmissions();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);

	// Fetch submission data
	const {
		data: submission,
		isLoading,
		error,
	} = useSubmissionById(submissionId ? parseInt(submissionId) : null);

	// Load submission data into form store when available
	useEffect(() => {
		if (submission) {
			formStore.loadFromSubmission(submission);
		}
	}, [submission, formStore]);

	const handleClose = () => {
		navigate("/submissions");
	};

	const handleSubmit = async () => {
		if (!submissionId) return;

		setIsSubmitting(true);
		try {
			const submissionData = formStore.getSubmissionCreateRequest(false); // is_draft: false
			await new Promise<void>((resolve, reject) => {
				updateSubmission(
					{ id: parseInt(submissionId), data: submissionData },
					{
						onSuccess: () => {
							formStore.resetForm();
							resolve();
							handleClose();
						},
						onError: (error) => {
							reject(error);
						},
					}
				);
			});
		} catch (error) {
			console.error("Update submission error:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveDraft = async () => {
		if (!submissionId) return;

		setIsSavingDraft(true);
		try {
			const draftData = formStore.getSubmissionCreateRequest(true); // is_draft: true
			await new Promise<void>((resolve, reject) => {
				updateSubmission(
					{ id: parseInt(submissionId), data: draftData },
					{
						onSuccess: () => {
							resolve();
							handleClose();
						},
						onError: (error) => {
							reject(error);
						},
					}
				);
			});
		} catch (error) {
			console.error("Save draft error:", error);
		} finally {
			setIsSavingDraft(false);
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

	return (
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title="Edit Submission"
				description={`Update submission ${submission.case_number}`}
				className="max-w-7xl"
			>
				<CreateSubmissionForm
					onSubmit={handleSubmit}
					onSaveDraft={handleSaveDraft}
					onCancel={handleClose}
					isSubmitting={isSubmitting}
					isSavingDraft={isSavingDraft}
				/>
			</ResponsiveModalContent>
		</ResponsiveModal>
	);
});

export const EditSubmissionRouteModal = () => {
	return (
		<SubmissionStoresProvider>
			<EditSubmissionRouteModalContent />
		</SubmissionStoresProvider>
	);
};
