import {
	ResponsiveModal,
	ResponsiveModalContent,
} from "@/shared/components/layout/ResponsiveModal";
import { useNavigate, useParams } from "react-router";
import { CaseStoresProvider } from "../providers";
import { useCaseFormStore } from "../../hooks/useCaseFormStore";
import { CreateCaseForm } from "../forms/CreateCaseForm";
import { useCases, useCaseById } from "../../hooks/useCases";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { observer } from "mobx-react-lite";
import { useState, useEffect } from "react";

const EditCaseRouteModalContent = observer(() => {
	const navigate = useNavigate();
	const { submissionId } = useParams();
	const formStore = useCaseFormStore();
	const { updateCase } = useCases();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);

	// Fetch case data
	const {
		data: caseObj,
		isLoading,
		error,
	} = useCaseById(submissionId ? parseInt(submissionId) : null);

	// Load case data into form store when available
	useEffect(() => {
		if (caseObj) {
			formStore.loadFromCase(caseObj);
		}
	}, [caseObj, formStore]);

	const handleClose = () => {
		navigate("/cases");
	};

	const handleSubmit = async () => {
		if (!submissionId) return;

		setIsSubmitting(true);
		try {
			const submissionData = formStore.getCaseCreateRequest();
			await new Promise<void>((resolve, reject) => {
				updateCase(
					{ id: parseInt(submissionId), data: submissionData },
					{
						onSuccess: () => {
							void formStore.clearDraft();
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
			console.error("Update case error:", error);
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

	if (isLoading) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Loading..." description="">
					<PageLoading text="Loading case details..." />
				</ResponsiveModalContent>
			</ResponsiveModal>
		);
	}

	if (error || !caseObj) {
		return (
			<ResponsiveModal
				open={true}
				onOpenChange={(open) => !open && handleClose()}
			>
				<ResponsiveModalContent side="bottom" title="Error" description="">
					<ErrorAlert
						error={error || "Case not found"}
						title="Failed to load case"
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
				title="Edit Case"
				description={`Update case ${caseObj.case_number}`}
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

export const EditCaseRouteModal = () => {
	return (
		<CaseStoresProvider>
			<EditCaseRouteModalContent />
		</CaseStoresProvider>
	);
};
