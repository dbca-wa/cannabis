import { observer } from "mobx-react-lite";
import { useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { useCaseProcessingWizardStore } from "@/app/providers/store.provider";
import { CaseStoresProvider } from "@/features/cases/components/providers/CaseStoresProvider";
import { useCaseById, useCases } from "@/features/cases/hooks/useCases";
import { useDrugBags } from "@/features/cases/hooks/useDrugBags";
import { CaseProcessingWizardContainer } from "@/features/cases/components/forms/wizard/CaseProcessingWizardContainer";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";
import type { DefendantTiny } from "@/shared/types/backend-api.types";
import type { WorkflowAction } from "@/shared/types/backend-api.types";

/**
 * Bridges the TanStack Query case object into the Record<string, unknown>
 * shape that CaseProcessingWizardContainer expects as caseData.
 */
const buildCaseData = (
	caseObj: Record<string, unknown>
): Record<string, unknown> => ({
	id: caseObj.id,
	case_number: caseObj.case_number ?? "",
	received: caseObj.received ?? "",
	security_movement_envelope: caseObj.security_movement_envelope ?? "",
	requesting_officer_id:
		caseObj.requesting_officer_id ?? caseObj.requesting_officer ?? null,
	submitting_officer_id:
		caseObj.submitting_officer_id ?? caseObj.submitting_officer ?? null,
	station_id: caseObj.station_id ?? caseObj.station ?? null,
	approved_botanist_id:
		caseObj.approved_botanist_id ?? caseObj.approved_botanist ?? null,
	bags: caseObj.bags ?? [],
	certificates: caseObj.certificates ?? [],
	defendants: caseObj.defendant_ids ?? caseObj.defendants ?? [],
	defendants_details: caseObj.defendants_details ?? [],
	requesting_officer_name:
		(caseObj.requesting_officer_details as Record<string, unknown>)
			?.full_name ??
		caseObj.requesting_officer_name ??
		null,
	submitting_officer_name:
		(caseObj.submitting_officer_details as Record<string, unknown>)
			?.full_name ??
		caseObj.submitting_officer_name ??
		null,
	requesting_officer_details: {
		rank_display:
			(caseObj.requesting_officer_details as Record<string, unknown>)
				?.rank_display ?? null,
		badge_number:
			(caseObj.requesting_officer_details as Record<string, unknown>)
				?.badge_number ?? null,
		first_name:
			(caseObj.requesting_officer_details as Record<string, unknown>)
				?.first_name ?? null,
		last_name:
			(caseObj.requesting_officer_details as Record<string, unknown>)
				?.last_name ?? null,
		station_name:
			(caseObj.requesting_officer_details as Record<string, unknown>)
				?.station_name ?? null,
	},
	submitting_officer_details: {
		rank_display:
			(caseObj.submitting_officer_details as Record<string, unknown>)
				?.rank_display ?? null,
		badge_number:
			(caseObj.submitting_officer_details as Record<string, unknown>)
				?.badge_number ?? null,
		first_name:
			(caseObj.submitting_officer_details as Record<string, unknown>)
				?.first_name ?? null,
		last_name:
			(caseObj.submitting_officer_details as Record<string, unknown>)
				?.last_name ?? null,
		station_name:
			(caseObj.submitting_officer_details as Record<string, unknown>)
				?.station_name ?? null,
	},
	approved_botanist_name:
		(caseObj.approved_botanist_details as Record<string, unknown>)?.full_name ??
		caseObj.approved_botanist_name ??
		null,
	station_name:
		(caseObj.station_details as Record<string, unknown>)?.name ??
		caseObj.station_name ??
		null,
	internal_comments: caseObj.internal_comments ?? "",
	additional_notes: caseObj.additional_notes ?? "None",
	unsigned_certificate_generated:
		caseObj.unsigned_certificate_generated ?? false,
	certificate_signed: caseObj.certificate_signed ?? false,
	invoice_generated: caseObj.invoice_generated ?? false,
	documents_sent: caseObj.documents_sent ?? false,
	invoices: caseObj.invoices ?? [],
	customer_number: caseObj.customer_number ?? "",
	phase: caseObj.phase ?? "case_creation",
});

const ProcessCaseContent = observer(() => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const wizardStore = useCaseProcessingWizardStore();
	const parsedId = id ? parseInt(id, 10) : null;

	const { data: caseObj, isLoading, isError } = useCaseById(parsedId);
	const { updateCase, executeWorkflowAction, deleteCase } = useCases();
	const { createDrugBag } = useDrugBags(parsedId);

	// Reset the processing wizard store on unmount
	useEffect(() => {
		return () => {
			wizardStore.reset();
		};
	}, [wizardStore]);

	const caseData = caseObj
		? buildCaseData(caseObj as unknown as Record<string, unknown>)
		: null;

	logger.debug("ProcessCase caseData built", {
		hasCaseObj: !!caseObj,
		bagsCount: (caseData?.bags as unknown[])?.length ?? 0,
		approvedBotanistId: caseData?.approved_botanist_id,
		phase: caseData?.phase,
	});

	/**
	 * Field change handler — persists field changes via PATCH mutation.
	 */
	/**
	 * Field change handler — persists field changes via PATCH mutation.
	 * Maps frontend field names to backend API field names where they differ.
	 */
	const handleFieldChange = useCallback(
		(field: string, value: unknown) => {
			if (!parsedId) return;

			if (field === "add_bag") {
				// Create a new drug bag with auto-generated tag number
				const timestamp = Date.now().toString(36).toUpperCase();
				createDrugBag({
					case: parsedId,
					seal_tag_numbers: `DMB-${timestamp}`,
					content_type: "plant_material",
				});
				return;
			}

			if (field === "defendants") {
				updateCase({ id: parsedId, data: { defendants: value as number[] } });
				return;
			}

			if (field === "add_defendant") {
				const defendant = value as DefendantTiny;
				const currentIds = (caseData?.defendants as number[]) ?? [];
				if (!currentIds.includes(defendant.id)) {
					updateCase({
						id: parsedId,
						data: { defendants: [...currentIds, defendant.id] },
					});
				}
				return;
			}

			// Map frontend field names to backend API field names
			const fieldMap: Record<string, string> = {
				approved_botanist_id: "approved_botanist",
				requesting_officer_id: "requesting_officer",
				submitting_officer_id: "submitting_officer",
				station_id: "station",
			};

			const apiField = fieldMap[field] ?? field;
			updateCase({ id: parsedId, data: { [apiField]: value } });
		},
		[parsedId, updateCase, createDrugBag, caseData]
	);

	/**
	 * Action handler — triggers workflow actions (generate_certificate, etc.)
	 */
	const handleAction = useCallback(
		(action: string) => {
			if (!parsedId) return;
			executeWorkflowAction({
				id: parsedId,
				action: { action: action as WorkflowAction },
			});
		},
		[parsedId, executeWorkflowAction]
	);

	/**
	 * Submit handler — finalises the case processing.
	 */
	const handleSubmit = useCallback(() => {
		if (!parsedId) return;
		wizardStore.setSubmitting(true);
		executeWorkflowAction(
			{ id: parsedId, action: { action: "send_documents" } },
			{
				onSuccess: () => {
					wizardStore.setSubmitting(false);
					toast.success("Case completed successfully!");
					navigate("/cases");
				},
				onError: () => {
					wizardStore.setSubmitting(false);
				},
			}
		);
	}, [parsedId, wizardStore, executeWorkflowAction, navigate]);

	/**
	 * Delete handler — deletes the case and navigates back to cases list.
	 */
	const handleDiscard = useCallback(() => {
		if (!parsedId) {
			navigate("/cases");
			return;
		}
		deleteCase(parsedId, {
			onSuccess: () => {
				toast.success("Case deleted successfully");
				navigate("/cases");
			},
			onError: () => {
				toast.error("Failed to delete case");
			},
		});
	}, [parsedId, deleteCase, navigate]);

	// Loading state
	if (isLoading) {
		return (
			<div className="space-y-6 p-6">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-12 w-full" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	// Error state
	if (isError || !caseObj) {
		return (
			<div className="flex items-center justify-center min-h-[400px]">
				<div className="text-center max-w-md">
					<AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
					<h2 className="text-2xl font-bold mb-2">Case Not Found</h2>
					<p className="text-muted-foreground mb-6">
						The case you&apos;re looking for doesn&apos;t exist or you
						don&apos;t have permission.
					</p>
					<Button onClick={() => navigate("/cases")}>Back to Cases</Button>
				</div>
			</div>
		);
	}

	logger.debug("ProcessCase rendering", {
		caseId: parsedId,
		phase: caseObj.phase,
	});

	return (
		<CaseProcessingWizardContainer
			caseData={caseData}
			onFieldChange={handleFieldChange}
			onAction={handleAction}
			onSubmit={handleSubmit}
			onDiscard={handleDiscard}
		/>
	);
});

export const ProcessCase = () => {
	useDocumentTitle("Process Case");

	return (
		<CaseStoresProvider>
			<ProcessCaseContent />
		</CaseStoresProvider>
	);
};
