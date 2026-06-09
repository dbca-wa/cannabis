import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import ContentLayout from "@/shared/components/layout/ContentLayout";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";
import { CaseStoresProvider } from "@/features/cases/components/providers/CaseStoresProvider";
import { CreateCaseForm } from "@/features/cases/components/forms/CreateCaseForm";
import { useCaseFormStore } from "@/features/cases/hooks/useCaseFormStore";
import { useCaseById, useCases } from "@/features/cases/hooks/useCases";
import { PageLoading } from "@/shared/components/feedback/LoadingSpinner";
import { ErrorAlert } from "@/shared/components/feedback/ErrorAlert";
import { Button } from "@/shared/components/ui/button";
import type { BreadcrumbItem } from "@/shared/components/ui/breadcrumb";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

const EditCaseContent = observer(() => {
	const navigate = useNavigate();
	const { submissionId } = useParams<{ submissionId: string }>();
	const formStore = useCaseFormStore();
	const { updateCase } = useCases();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSavingDraft, setIsSavingDraft] = useState(false);

	// Fetch case data
	const {
		data: caseObj,
		isLoading,
		isError,
		error,
		refetch,
	} = useCaseById(submissionId ? parseInt(submissionId, 10) : null);

	// Load case data into form store when available
	useEffect(() => {
		if (caseObj) {
			formStore.loadFromCase(caseObj);
		}
	}, [caseObj, formStore]);

	const handleCancel = () => {
		navigate("/cases");
	};

	const handleSubmit = async () => {
		if (!submissionId) return;

		setIsSubmitting(true);
		try {
			const submissionData = formStore.getCaseCreateRequest();
			await new Promise<void>((resolve, reject) => {
				updateCase(
					{ id: parseInt(submissionId, 10), data: submissionData },
					{
						onSuccess: () => {
							void formStore.clearDraft();
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
			console.error("Update case error:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSaveDraft = async () => {
		setIsSavingDraft(true);
		try {
			await formStore.saveDraft();
			handleCancel();
		} catch (error) {
			console.error("Save draft error:", error);
		} finally {
			setIsSavingDraft(false);
		}
	};

	// Show loading state
	if (isLoading) {
		return <PageLoading text="Loading caseObj..." />;
	}

	// Show error state
	if (isError) {
		return (
			<ErrorAlert
				error={error}
				title="Failed to load case"
				showRetry
				onRetry={refetch}
			>
				<Button variant="outline" size="sm" onClick={handleCancel}>
					Back to Cases
				</Button>
			</ErrorAlert>
		);
	}

	// Show form when data is loaded
	return (
		<CreateCaseForm
			onSubmit={handleSubmit}
			onSaveDraft={handleSaveDraft}
			onCancel={handleCancel}
			isSubmitting={isSubmitting}
			isSavingDraft={isSavingDraft}
		/>
	);
});

export const EditCase = () => {
	useDocumentTitle("Edit Case");

	const breadcrumbs: BreadcrumbItem[] = [
		{ label: "Cases", href: "/cases" },
		{ label: "Edit Case", current: true },
	];

	return (
		<CaseStoresProvider>
			<ContentLayout breadcrumbs={breadcrumbs} title="Edit Case">
				<SectionWrapper variant="default">
					<EditCaseContent />
				</SectionWrapper>
			</ContentLayout>
		</CaseStoresProvider>
	);
};
