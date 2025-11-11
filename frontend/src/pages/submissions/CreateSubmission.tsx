import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";
import { SubmissionStoresProvider } from "@/features/submissions/components/providers/SubmissionStoresProvider";
import { CreateSubmissionForm } from "@/features/submissions/components/forms/CreateSubmissionForm";
import { useSubmissionFormStore } from "@/features/submissions/hooks/useSubmissionFormStore";
import { useSubmissions } from "@/features/submissions/hooks/useSubmissions";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";
import { Head } from "@/shared/components/layout/Head";

const CreateSubmissionContent = observer(() => {
	const navigate = useNavigate();
	const formStore = useSubmissionFormStore();
	const { createSubmission } = useSubmissions();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);

	// Clear any existing draft data when creating a new submission (only on mount)
	useEffect(() => {
		formStore.resetForm();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Only run on mount

	const handleCancel = () => {
		navigate("/submissions");
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			const submissionData = formStore.getSubmissionCreateRequest(false); // is_draft: false
			await new Promise<void>((resolve, reject) => {
				createSubmission(submissionData, {
					onSuccess: () => {
						formStore.resetForm();
						resolve();
						handleCancel();
					},
					onError: (error) => {
						reject(error);
					},
				});
			});
		} catch (error) {
			console.error("Create submission error:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveDraft = async () => {
		setIsSavingDraft(true);
		try {
			const draftData = formStore.getSubmissionCreateRequest(true); // is_draft: true
			await new Promise<void>((resolve, reject) => {
				createSubmission(draftData, {
					onSuccess: () => {
						resolve();
						handleCancel();
					},
					onError: (error) => {
						reject(error);
					},
				});
			});
		} catch (error) {
			console.error("Save draft error:", error);
		} finally {
			setIsSavingDraft(false);
		}
	};

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

export const CreateSubmission = () => {
	const breadcrumbs: BreadcrumbItem[] = [
		{ label: "Submissions", href: "/submissions" },
		{ label: "Create Submission", current: true },
	];

	return (
		<SubmissionStoresProvider>
			<ContentLayout breadcrumbs={breadcrumbs}>
				<Head title="Create Submission" />
				<SectionWrapper variant="default">
					<CreateSubmissionContent />
				</SectionWrapper>
			</ContentLayout>
		</SubmissionStoresProvider>
	);
};
