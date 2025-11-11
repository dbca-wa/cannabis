import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate } from "react-router";
import { SubmissionStoresProvider } from "../../components/providers";
import { useSubmissionFormStore } from "../../hooks/useSubmissionFormStore";
import { CreateSubmissionForm } from "../forms/CreateSubmissionForm";
import { useSubmissions } from "../../hooks/useSubmissions";
import { observer } from "mobx-react-lite";
import { useState } from "react";

const CreateSubmissionRouteModalContent = observer(() => {
	const navigate = useNavigate();
	const formStore = useSubmissionFormStore();
	const { createSubmission } = useSubmissions();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);

	const handleClose = () => {
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
						handleClose();
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
						handleClose();
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
		<ResponsiveModal
			open={true}
			onOpenChange={(open: boolean) => {
				if (!open) handleClose();
			}}
		>
			<ResponsiveModalContent
				side="bottom"
				title="Create New Submission"
				description="Create a new cannabis sample submission with case details, officers, and drug bags"
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

export const CreateSubmissionRouteModal = () => {
	return (
		<SubmissionStoresProvider>
			<CreateSubmissionRouteModalContent />
		</SubmissionStoresProvider>
	);
};
