import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate } from "react-router";
import { CaseStoresProvider } from "../providers";
import { useCaseFormStore } from "../../hooks/useCaseFormStore";
import { CreateCaseForm } from "../forms/CreateCaseForm";
import { useCases } from "../../hooks/useCases";
import { observer } from "mobx-react-lite";
import { useState } from "react";

const CreateCaseRouteModalContent = observer(() => {
	const navigate = useNavigate();
	const formStore = useCaseFormStore();
	const { createCaseAsync } = useCases();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);

	const handleClose = () => {
		navigate("/cases");
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			const submissionData = formStore.getCaseCreateRequest();
			// Await the mutation fully — including the list invalidation/refetch in
			// the hook's onSuccess — before navigating, so the cases list already
			// holds the new case (at the top) when we land on it.
			await createCaseAsync(submissionData);
			void formStore.clearDraft();
			formStore.resetForm();
			handleClose();
		} catch (error) {
			console.error("Create case error:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveDraft = async () => {
		setIsSavingDraft(true);
		try {
			await formStore.saveDraft();
			handleClose();
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
				title="Create New Case"
				description="Create a new cannabis sample case with case details, officers, and drug bags"
				className="max-w-7xl"
			>
				<CreateCaseForm
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

export const CreateCaseRouteModal = () => {
	return (
		<CaseStoresProvider>
			<CreateCaseRouteModalContent />
		</CaseStoresProvider>
	);
};
