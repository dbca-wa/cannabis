import { observer } from "mobx-react-lite";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	useCaseProcessingWizardStore,
	useDrugBagWranglerStore,
} from "@/app/providers/store.provider";
import { CaseStoresProvider } from "@/features/cases/components/providers/CaseStoresProvider";
import { useCaseById, useCases } from "@/features/cases/hooks/useCases";
import {
	createCaseForm,
	getCaseForms,
	getFormById,
	advanceFormPhase,
	generateFormCertificate,
	deleteForm,
	updateForm,
} from "@/features/cases/services/forms.service";
import { CaseProcessingWizardContainer } from "@/features/cases/components/forms/wizard/CaseProcessingWizardContainer";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";
import type { Priority3Form } from "@/shared/types/backend-api.types";

/**
 * Bridges the TanStack Query case + form objects into the Record<string, unknown>
 * shape that CaseProcessingWizardContainer expects as caseData. Bags, certificate,
 * phase, and envelope are sourced from the form; base data from the case.
 */
const buildCaseData = (
	caseObj: Record<string, unknown>,
	form: Priority3Form
): Record<string, unknown> => ({
	id: caseObj.id,
	case_number: caseObj.case_number ?? "",
	received: caseObj.received ?? "",
	// Form-scoped fields
	security_movement_envelope: form.security_movement_envelope ?? "",
	bags: form.bags ?? [],
	certificates: form.certificate ? [form.certificate] : [],
	phase: form.phase ?? "assessment",
	formId: form.id,
	// Officers and station from the case
	requesting_officer_id:
		caseObj.requesting_officer_id ?? caseObj.requesting_officer ?? null,
	submitting_officer_id:
		caseObj.submitting_officer_id ?? caseObj.submitting_officer ?? null,
	station_id: caseObj.station_id ?? caseObj.station ?? null,
	approved_botanist_id:
		caseObj.approved_botanist_id ?? caseObj.approved_botanist ?? null,
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
		given_names:
			(caseObj.requesting_officer_details as Record<string, unknown>)
				?.given_names ?? null,
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
		given_names:
			(caseObj.submitting_officer_details as Record<string, unknown>)
				?.given_names ?? null,
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
	additional_notes: form.additional_notes ?? "",
	police_form_url: caseObj.police_form_url ?? null,
});

/**
 * Builds a partial caseData from just the case object when no form is active.
 * Bags, certificates, and phase are empty/null — only case-level fields populated.
 */
const buildCaseDataNoForm = (
	caseObj: Record<string, unknown>
): Record<string, unknown> => ({
	id: caseObj.id,
	case_number: caseObj.case_number ?? "",
	received: caseObj.received ?? "",
	security_movement_envelope: "",
	bags: [],
	certificates: [],
	phase: null,
	formId: null,
	requesting_officer_id:
		caseObj.requesting_officer_id ?? caseObj.requesting_officer ?? null,
	submitting_officer_id:
		caseObj.submitting_officer_id ?? caseObj.submitting_officer ?? null,
	station_id: caseObj.station_id ?? caseObj.station ?? null,
	approved_botanist_id:
		caseObj.approved_botanist_id ?? caseObj.approved_botanist ?? null,
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
		given_names:
			(caseObj.requesting_officer_details as Record<string, unknown>)
				?.given_names ?? null,
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
		given_names:
			(caseObj.submitting_officer_details as Record<string, unknown>)
				?.given_names ?? null,
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
	additional_notes: "",
	police_form_url: caseObj.police_form_url ?? null,
});

const ProcessCaseContent = observer(() => {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const wizardStore = useCaseProcessingWizardStore();
	const wrangler = useDrugBagWranglerStore();
	const parsedId = id ? parseInt(id, 10) : null;

	// Active form tracked in local state (no URL param)
	const [activeFormId, setActiveFormId] = useState<number | null>(null);

	// Local notes state for instant preview updates (ahead of debounced server save)
	const [localAdditionalNotes, setLocalAdditionalNotes] = useState<
		string | null
	>(null);

	// Local case_number state for instant typing feedback (ahead of debounced save)
	const [localCaseNumber, setLocalCaseNumber] = useState<string | null>(null);

	const {
		data: caseObj,
		isLoading: isCaseLoading,
		isError,
	} = useCaseById(parsedId);

	// Load the case's forms
	const { data: formsData, isLoading: isFormsLoading } = useQuery({
		queryKey: ["cases", parsedId, "forms"],
		queryFn: () => getCaseForms(parsedId!),
		enabled: !!parsedId,
		staleTime: 30_000,
	});

	const forms: Priority3Form[] = Array.isArray(formsData) ? formsData : [];

	// Default to first form when forms load (or after adding one)
	useEffect(() => {
		if (forms.length > 0 && activeFormId === null) {
			setActiveFormId(forms[0].id);
		}
	}, [forms, activeFormId]);

	// Load the active form's full data
	const { data: form, isLoading: isFormLoading } = useQuery({
		queryKey: ["cases", "forms", activeFormId],
		queryFn: () => getFormById(activeFormId!),
		enabled: !!activeFormId,
		staleTime: 30_000,
	});

	// Create form mutation — adds a new P3 form and sets it active
	const createFormMutation = useMutation({
		mutationFn: (caseId: number) => createCaseForm(caseId),
		onSuccess: async (newForm) => {
			await queryClient.invalidateQueries({
				queryKey: ["cases", parsedId, "forms"],
			});
			setActiveFormId(newForm.id);
		},
		onError: () => {
			toast.error("Failed to create form");
		},
	});

	// Generate certificate mutation (form-scoped)
	const generateCertificateMutation = useMutation({
		mutationFn: ({
			fId,
			sectionCNote,
		}: {
			fId: number;
			sectionCNote?: string | null;
		}) =>
			generateFormCertificate(fId, {
				section_c_note: sectionCNote ?? undefined,
			}),
		onSuccess: async () => {
			if (activeFormId) {
				await queryClient.invalidateQueries({
					queryKey: ["cases", "forms", activeFormId],
				});
			}
			toast.success("Certificate generated");
		},
		onError: () => {
			toast.error("Failed to generate certificate");
		},
	});

	// Advance form phase mutation
	const advanceFormPhaseMutation = useMutation({
		mutationFn: (fId: number) => advanceFormPhase(fId),
		onSuccess: async () => {
			if (activeFormId) {
				await queryClient.invalidateQueries({
					queryKey: ["cases", "forms", activeFormId],
				});
			}
		},
	});

	// Delete form mutation
	const deleteFormMutation = useMutation({
		mutationFn: (formId: number) => deleteForm(formId),
		onSuccess: async (_data, deletedFormId) => {
			await queryClient.invalidateQueries({
				queryKey: ["cases", parsedId, "forms"],
			});
			// If the deleted form was the active one, clear selection
			if (activeFormId === deletedFormId) {
				setActiveFormId(null);
			}
			toast.success("Form deleted");
		},
		onError: () => {
			toast.error("Failed to delete form");
		},
	});

	// Reset the processing wizard store on unmount
	useEffect(() => {
		return () => {
			wizardStore.reset();
		};
	}, [wizardStore]);

	// Sync local notes from the form when it loads or changes
	useEffect(() => {
		if (form) {
			setLocalAdditionalNotes(form.additional_notes ?? null);
		} else {
			setLocalAdditionalNotes(null);
		}
	}, [form]);

	// Sync local case number from server on initial load of each case.
	// Depends on parsedId so it resets when navigating between cases.
	// Does NOT depend on caseObj to avoid overwriting local edits on refetch.
	const caseNumberSyncedRef = useRef<number | null>(null);
	useEffect(() => {
		if (caseObj && parsedId && caseNumberSyncedRef.current !== parsedId) {
			caseNumberSyncedRef.current = parsedId;
			setLocalCaseNumber(
				(caseObj as unknown as Record<string, unknown>).case_number as string
			);
		}
	}, [caseObj, parsedId]);

	const caseData = caseObj
		? form
			? buildCaseData(caseObj as unknown as Record<string, unknown>, form)
			: buildCaseDataNoForm(caseObj as unknown as Record<string, unknown>)
		: null;

	// Override with local state for instant preview updates (ahead of server round-trip)
	if (caseData && localAdditionalNotes !== null) {
		caseData.additional_notes = localAdditionalNotes;
	}
	if (caseData && localCaseNumber !== null) {
		caseData.case_number = localCaseNumber;
	}

	logger.debug("ProcessCase caseData built", {
		hasCaseObj: !!caseObj,
		hasForm: !!form,
		bagsCount: (caseData?.bags as unknown[])?.length ?? 0,
		phase: caseData?.phase,
		formId: activeFormId,
	});

	const { updateCase } = useCases();

	const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const notesSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const pendingNotesRef = useRef<{ formId: number; value: string } | null>(
		null
	);
	const [isSavingNotes, setIsSavingNotes] = useState(false);

	// Attach saving state to caseData for downstream components
	if (caseData) {
		caseData._isSavingNotes = isSavingNotes;
	}

	/** Flush any pending section C notes save immediately (e.g., before form switch). */
	const flushPendingNotes = useCallback(() => {
		if (notesSaveRef.current) {
			clearTimeout(notesSaveRef.current);
			notesSaveRef.current = null;
		}
		if (pendingNotesRef.current) {
			const { formId: fId, value } = pendingNotesRef.current;
			pendingNotesRef.current = null;
			setIsSavingNotes(true);
			updateForm(fId, { additional_notes: value })
				.then(() => {
					toast.success("Section C notes saved");
					queryClient.invalidateQueries({ queryKey: ["cases", "forms", fId] });
				})
				.catch(() => {
					toast.error("Failed to save section C notes");
				})
				.finally(() => {
					setIsSavingNotes(false);
				});
		}
	}, [queryClient]);

	/** Field change handler — debounces text fields (800ms), saves others immediately. */
	const handleFieldChange = useCallback(
		(field: string, value: unknown) => {
			if (!parsedId) return;
			logger.debug("ProcessCase field change", { field, value });

			// Update local notes immediately for instant preview feedback
			if (field === "additional_notes" && typeof value === "string") {
				setLocalAdditionalNotes(value);
			}

			// Update local case number immediately for instant typing feedback
			if (field === "case_number" && typeof value === "string") {
				setLocalCaseNumber(value);
			}

			// additional_notes is per-form — PATCH the form, not the case
			if (field === "additional_notes") {
				if (!activeFormId) return;
				// Store the pending value with its form ID for reliable flush
				pendingNotesRef.current = {
					formId: activeFormId,
					value: value as string,
				};
				if (notesSaveRef.current) clearTimeout(notesSaveRef.current);
				notesSaveRef.current = setTimeout(() => {
					const pending = pendingNotesRef.current;
					if (!pending) return;
					pendingNotesRef.current = null;
					notesSaveRef.current = null;
					setIsSavingNotes(true);
					updateForm(pending.formId, { additional_notes: pending.value })
						.then(() => {
							toast.success("Section C notes saved");
							queryClient.invalidateQueries({
								queryKey: ["cases", "forms", pending.formId],
							});
						})
						.catch(() => {
							toast.error("Failed to save section C notes");
						})
						.finally(() => {
							setIsSavingNotes(false);
						});
				}, 800);
				return;
			}

			// Defendants M2M — add or set the full list of IDs
			if (field === "add_defendant") {
				const defendant = value as { id: number };
				const currentIds = (caseData?.defendants as number[]) ?? [];
				if (!currentIds.includes(defendant.id)) {
					const newIds = [...currentIds, defendant.id];
					updateCase({ id: parsedId, data: { defendants: newIds } });
					queryClient.invalidateQueries({
						queryKey: ["cases", "detail", parsedId],
					});
				}
				return;
			}
			if (field === "defendants") {
				// value is the updated array of defendant IDs (after removal)
				updateCase({ id: parsedId, data: { defendants: value as number[] } });
				queryClient.invalidateQueries({
					queryKey: ["cases", "detail", parsedId],
				});
				return;
			}

			// Text fields: debounce the save to avoid a PATCH on every keystroke
			if (typeof value === "string") {
				if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
				debouncedSaveRef.current = setTimeout(() => {
					updateCase({ id: parsedId, data: { [field]: value } });
				}, 800);
				return;
			}

			// Non-text fields (selects, IDs): save immediately
			// Map frontend field names (with _id suffix) to backend serializer field names
			const fieldMap: Record<string, string> = {
				requesting_officer_id: "requesting_officer",
				submitting_officer_id: "submitting_officer",
				station_id: "station",
				approved_botanist_id: "approved_botanist",
			};
			const apiField = fieldMap[field] ?? field;
			updateCase({ id: parsedId, data: { [apiField]: value } });
		},
		[parsedId, activeFormId, updateCase, queryClient]
	);

	// Clean up debounce timeouts on unmount — flush notes to avoid data loss
	useEffect(() => {
		return () => {
			if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
			if (notesSaveRef.current) clearTimeout(notesSaveRef.current);
			// Flush pending notes synchronously on unmount
			if (pendingNotesRef.current) {
				const { formId: fId, value } = pendingNotesRef.current;
				updateForm(fId, { additional_notes: value });
			}
		};
	}, []);

	/** Action handler — triggers form-scoped actions. */
	const handleAction = useCallback(
		(action: string) => {
			if (!activeFormId) return;
			if (action === "generate_certificate") {
				const sectionCNote =
					typeof caseData?.additional_notes === "string"
						? caseData.additional_notes
						: undefined;
				generateCertificateMutation.mutate({
					fId: activeFormId,
					sectionCNote,
				});
			} else if (action === "advance_phase") {
				advanceFormPhaseMutation.mutate(activeFormId);
			}
		},
		[
			activeFormId,
			caseData,
			generateCertificateMutation,
			advanceFormPhaseMutation,
		]
	);

	/** Submit handler — advances ALL forms on the case to batching, then returns to cases list. */
	const handleSubmit = useCallback(() => {
		if (!parsedId) return;
		wizardStore.setSubmitting(true);

		const finish = () => {
			wizardStore.setSubmitting(false);
			toast.success("Case ready for batching");
			navigate("/cases");
		};

		// Advance a single form to batching by repeatedly calling advance_phase
		const advanceFormUntilBatching = (formId: number): Promise<void> => {
			return advanceFormPhase(formId).then((response) => {
				const newPhase = response?.new_phase;
				if (newPhase === "assessment" || newPhase === "unsigned_generation") {
					return advanceFormUntilBatching(formId);
				}
				// Form is now in batching or beyond
			});
		};

		// Advance all forms that aren't already in batching/in_batch/complete
		const formsToAdvance = forms.filter(
			(f) =>
				f.phase !== "batching" &&
				f.phase !== "in_batch" &&
				f.phase !== "complete"
		);

		if (formsToAdvance.length === 0) {
			finish();
			return;
		}

		Promise.all(formsToAdvance.map((f) => advanceFormUntilBatching(f.id)))
			.then(() => {
				queryClient.invalidateQueries({
					queryKey: ["cases", parsedId, "forms"],
				});
				queryClient.invalidateQueries({ queryKey: ["cases"] });
				finish();
			})
			.catch(() => {
				wizardStore.setSubmitting(false);
				toast.error("Failed to finalise case");
			});
	}, [parsedId, forms, wizardStore, navigate, queryClient]);

	/** Discard handler — navigates back to cases list. */
	const handleDiscard = useCallback(() => {
		navigate("/cases");
	}, [navigate]);

	/** Callback for FormsNavigator form selection. */
	const handleFormSelect = useCallback(
		(formId: number) => {
			// Flush any pending section C notes before switching
			flushPendingNotes();
			// Stash current form's unsaved bags before switching
			if (activeFormId) {
				wrangler.stashForForm(activeFormId);
			}
			setActiveFormId(formId);
			// Restore the target form's stashed bags
			wrangler.restoreForForm(formId);
		},
		[activeFormId, wrangler, flushPendingNotes]
	);

	/** Callback for FormsNavigator "Add Form" button. */
	const handleAddForm = useCallback(() => {
		if (!parsedId) return;
		createFormMutation.mutate(parsedId);
	}, [parsedId, createFormMutation]);

	/** Callback for FormsNavigator form deletion. */
	const handleDeleteForm = useCallback(
		(formId: number) => {
			deleteFormMutation.mutate(formId);
		},
		[deleteFormMutation]
	);

	// Loading state — only wait for the form when there's an active form to load
	const isLoading =
		isCaseLoading || isFormsLoading || (!!activeFormId && isFormLoading);
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
		formId: activeFormId,
		phase: caseData?.phase ?? null,
	});

	return (
		<div className="space-y-4">
			<CaseProcessingWizardContainer
				caseData={caseData}
				caseId={parsedId!}
				activeFormId={activeFormId ?? 0}
				forms={forms}
				onFieldChange={handleFieldChange}
				onAction={handleAction}
				onSubmit={handleSubmit}
				onDiscard={handleDiscard}
				onFormSelect={handleFormSelect}
				onAddForm={handleAddForm}
				onDeleteForm={handleDeleteForm}
			/>
		</div>
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
