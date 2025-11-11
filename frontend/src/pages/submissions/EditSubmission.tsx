import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";
import { SubmissionStoresProvider } from "@/features/submissions/components/providers/SubmissionStoresProvider";
import { CreateSubmissionForm } from "@/features/submissions/components/forms/CreateSubmissionForm";
import { useSubmissionFormStore } from "@/features/submissions/hooks/useSubmissionFormStore";
import {
	useSubmissionById,
	useSubmissions,
} from "@/features/submissions/hooks/useSubmissions";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { Button } from "@/shared/components/ui/button";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";
import { Head } from "@/shared/components/layout/Head";

const EditSubmissionContent = observer(() => {
	const navigate = useNavigate();
	const { submissionId } = useParams<{ submissionId: string }>();
	const formStore = useSubmissionFormStore();
	const { updateSubmission } = useSubmissions();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);

	// Fetch submission data
	const {
		data: submission,
		isLoading,
		isError,
		error,
		refetch,
	} = useSubmissionById(submissionId ? parseInt(submissionId, 10) : null);

	// Load submission data into form store when available
	useEffect(() => {
		if (submission) {
			formStore.loadFromSubmission(submission);
		}
	}, [submission, formStore]);

	const handleCancel = () => {
		navigate("/submissions");
	};

	const handleSubmit = async () => {
		if (!submissionId) return;

		setIsSubmitting(true);
		try {
			const submissionData = formStore.getSubmissionCreateRequest(false); // is_draft: false
			await new Promise<void>((resolve, reject) => {
				updateSubmission(
					{ id: parseInt(submissionId, 10), data: submissionData },
					{
						onSuccess: () => {
							resolve();
							handleCancel();
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
					{ id: parseInt(submissionId, 10), data: draftData },
					{
						onSuccess: () => {
							resolve();
							handleCancel();
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

	// Show loading state
	if (isLoading) {
		return <PageLoading text="Loading submission..." />;
	}

	// Show error state
	if (isError) {
		return (
			<ErrorAlert
				error={error}
				title="Failed to load submission"
				showRetry
				onRetry={refetch}
			>
				<Button variant="outline" size="sm" onClick={handleCancel}>
					Back to Submissions
				</Button>
			</ErrorAlert>
		);
	}

	// Show form when data is loaded
	return (
		<CreateSubmissionForm
			onSubmit={handleSubmit}
			onSaveDraft={handleSaveDraft}
			onCancel={handleCancel}
			isSubmitting={isSubmitting}
			isSavingDraft={isSavingDraft}
		/>
	);
});

export const EditSubmission = () => {
	const breadcrumbs: BreadcrumbItem[] = [
		{ label: "Submissions", href: "/submissions" },
		{ label: "Edit Submission", current: true },
	];

	return (
		<SubmissionStoresProvider>
			<ContentLayout breadcrumbs={breadcrumbs}>
				<Head title="Edit Submission" />
				<SectionWrapper variant="default">
					<EditSubmissionContent />
				</SectionWrapper>
			</ContentLayout>
		</SubmissionStoresProvider>
	);
};
