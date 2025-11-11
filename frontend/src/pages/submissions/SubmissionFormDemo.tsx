import React from "react";
import { useNavigate } from "react-router";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";
import { SubmissionStoresProvider } from "@/features/submissions/components/providers";
import { CreateSubmissionForm } from "@/features/submissions/components/forms";
import { SubmissionFormLayout } from "@/features/submissions/components/SubmissionFormLayout";
import { CertificatePDFPreview } from "@/features/submissions/components/CertificatePDFPreview";
import { useSubmissionFormStore } from "@/features/submissions/hooks/useSubmissionFormStore";
import { toast } from "sonner";
import { Head } from "@/shared/components/layout/Head";

const SubmissionFormDemoContent: React.FC = () => {
	const navigate = useNavigate();
	const formStore = useSubmissionFormStore();
	const [isSubmitting, setIsSubmitting] = React.useState(false);
	const [isSavingDraft, setIsSavingDraft] = React.useState(false);

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			// Get the submission data from the store (final submission, not draft)
			const submissionData = formStore.getSubmissionCreateRequest(false);

			console.log("Submission data:", submissionData);
			console.log("Drug bags:", formStore.formData.bags);

			// In a real implementation, this would call the API
			// await SubmissionsService.createSubmission(submissionData);

			toast.success(
				"Form validation passed! (Demo mode - not actually submitted)"
			);

			// Reset form after successful submission
			// formStore.resetForm();
		} catch (error) {
			console.error("Submission error:", error);
			toast.error("Failed to submit form");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveDraft = async () => {
		setIsSavingDraft(true);
		try {
			// Get the submission data from the store (as draft)
			const draftData = formStore.getSubmissionCreateRequest(true);

			console.log("Draft data:", draftData);

			// In a real implementation, this would call the API
			// await SubmissionsService.createSubmission(draftData);

			toast.success(
				"Draft saved successfully! (Demo mode - not actually saved)"
			);
		} catch (error) {
			console.error("Save draft error:", error);
			toast.error("Failed to save draft");
		} finally {
			setIsSavingDraft(false);
		}
	};

	const handleCancel = () => {
		navigate("/submissions");
	};

	return (
		<SubmissionFormLayout
			title="New Submission"
			subtitle="Create a new cannabis sample submission with real-time certificate preview"
			formContent={
				<CreateSubmissionForm
					onSubmit={handleSubmit}
					onSaveDraft={handleSaveDraft}
					onCancel={handleCancel}
					isSubmitting={isSubmitting}
					isSavingDraft={isSavingDraft}
				/>
			}
			previewContent={<CertificatePDFPreview />}
			showViewSwitcher={true}
		/>
	);
};

const SubmissionFormDemo: React.FC = () => {
	const breadcrumbs = [
		{ label: "Submissions", href: "/submissions" },
		{ label: "Form Demo", current: true },
	];

	return (
		<ContentLayout breadcrumbs={breadcrumbs} maxWidth="2xl">
			<Head title="Submission Form Demo" />
			<SectionWrapper variant="minimal">
				<SubmissionStoresProvider
					autoRefresh={false}
					template="standard"
				>
					<SubmissionFormDemoContent />
				</SubmissionStoresProvider>
			</SectionWrapper>
		</ContentLayout>
	);
};

export default SubmissionFormDemo;
