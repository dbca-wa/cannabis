import { useRef } from "react";
import {
	useMutation,
	useMutationState,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
	generateFormCertificate,
	getCaseForms,
	updateForm,
} from "../services/forms.service";
import { isFormStale } from "../utils/certificateStaleness";
import type { Priority3Form } from "@/shared/types/backend-api.types";

const hasPdf = (form: Priority3Form): boolean =>
	!!(
		form.certificate &&
		(form.certificate.pdf_url || form.certificate.pdf_file)
	);

/** The next bulk certificate step for a case, or null when all are ready. */
export type CertificateBulkAction = "generate" | "regenerate" | "markReady";

/**
 * Which bulk action a case's certificates need next: generate the missing
 * ones, then regenerate any out of date, then mark every form ready. Null
 * when every certificate is current and marked ready, or there is nothing to
 * generate.
 */
export const nextCertificateAction = (
	forms: Priority3Form[]
): CertificateBulkAction | null => {
	const eligible = forms.filter((f) => (f.bags?.length ?? 0) > 0);
	if (eligible.length === 0) return null;
	if (eligible.some((f) => !hasPdf(f))) return "generate";
	if (eligible.some(isFormStale)) return "regenerate";
	if (eligible.some((f) => !f.marked_ready)) return "markReady";
	return null;
};

/**
 * A case's forms and the actions on their certificates: generate or
 * regenerate one or all, and mark forms ready.
 *
 * Several parts of the case page use this at once. The generating state is
 * read from the shared mutation cache, so a certificate started from one
 * place shows as generating everywhere.
 */
export const useCaseCertificates = (caseId: number) => {
	const queryClient = useQueryClient();
	const formsQueryKey = ["cases", caseId, "forms"] as const;
	const generateKey = ["cases", caseId, "generate-certificate"] as const;

	const { data: formsData } = useQuery({
		queryKey: formsQueryKey,
		queryFn: () => getCaseForms(caseId),
		staleTime: 30_000,
	});
	const forms: Priority3Form[] = Array.isArray(formsData) ? formsData : [];

	// Forms with bags can have a certificate.
	const eligibleForms = forms.filter((f) => (f.bags?.length ?? 0) > 0);
	const generatedForms = eligibleForms.filter(hasPdf);
	const pendingForms = eligibleForms.filter((f) => !hasPdf(f));
	const staleForms = eligibleForms.filter(isFormStale);
	const allGenerated = eligibleForms.length > 0 && pendingForms.length === 0;
	const hasStaleCertificates = staleForms.length > 0;
	// A batched certificate is rebuilt by re-packaging its batch instead.
	const anyBatched = eligibleForms.some((f) => f.certificate?.batch_id != null);
	// A stale certificate is never "ready": its review no longer applies.
	const allFormsReady =
		allGenerated &&
		!hasStaleCertificates &&
		eligibleForms.every((f) => f.marked_ready);

	const generatingFormIds = new Set(
		useMutationState({
			filters: { mutationKey: generateKey, status: "pending" },
			select: (mutation) => mutation.state.variables as number,
		})
	);

	// Counts the certificates left in a bulk run, so one toast reports it.
	const batchCountRef = useRef(0);
	const generateMutation = useMutation({
		mutationKey: generateKey,
		mutationFn: (formId: number) => generateFormCertificate(formId, {}),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: formsQueryKey });
			// A bulk run reports once, when its last certificate settles.
			if (batchCountRef.current <= 1) {
				toast.success("Certificate generated");
			}
		},
		onError: (error: unknown) => {
			// A 404 means the form no longer exists on the server, most often a
			// practice case that was reset while this tab still showed it.
			const status = (error as { status?: number })?.status;
			if (status === 404) {
				toast.error(
					"This form no longer exists — your practice case may have been reset. Reload and start a new practice case."
				);
			} else {
				toast.error("Failed to generate certificate");
			}
		},
		onSettled: () => {
			if (batchCountRef.current > 1) {
				batchCountRef.current -= 1;
				if (batchCountRef.current === 0) {
					toast.success("All certificates regenerated");
				}
			} else {
				batchCountRef.current = 0;
			}
		},
	});

	const generate = (formId: number) => generateMutation.mutate(formId);

	// Failures are reported by onError; settle every one so none goes unhandled.
	const generateMany = (targets: Priority3Form[]) => {
		batchCountRef.current = targets.length;
		return Promise.allSettled(
			targets.map((f) => generateMutation.mutateAsync(f.id))
		);
	};

	/** Generate every form's missing certificate. */
	const generateAll = () => generateMany(pendingForms);

	/** Regenerate every form's certificate from the current data. */
	const regenerateAll = () => generateMany(eligibleForms);

	const setReadyMutation = useMutation({
		mutationFn: ({ formId, ready }: { formId: number; ready: boolean }) =>
			updateForm(formId, { marked_ready: ready }),
		// Flip the mark straight away rather than waiting for the save and a
		// refetch, which felt laggy.
		onMutate: async ({ formId, ready }) => {
			await queryClient.cancelQueries({ queryKey: formsQueryKey });
			const previous = queryClient.getQueryData<Priority3Form[]>(formsQueryKey);
			queryClient.setQueryData<Priority3Form[]>(formsQueryKey, (old) =>
				Array.isArray(old)
					? old.map((f) =>
							f.id === formId ? { ...f, marked_ready: ready } : f
						)
					: old
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(formsQueryKey, context.previous);
			}
			toast.error("Failed to update readiness");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: formsQueryKey });
		},
	});

	const setReady = (formId: number, ready: boolean) =>
		setReadyMutation.mutate({ formId, ready });

	const markAllReadyMutation = useMutation({
		mutationFn: () =>
			Promise.all(
				eligibleForms
					.filter((f) => !f.marked_ready)
					.map((f) => updateForm(f.id, { marked_ready: true }))
			),
		// Fill every mark at once, then reconcile with the server.
		onMutate: async () => {
			await queryClient.cancelQueries({ queryKey: formsQueryKey });
			const previous = queryClient.getQueryData<Priority3Form[]>(formsQueryKey);
			queryClient.setQueryData<Priority3Form[]>(formsQueryKey, (old) =>
				Array.isArray(old)
					? old.map((f) =>
							(f.bags?.length ?? 0) > 0 ? { ...f, marked_ready: true } : f
						)
					: old
			);
			return { previous };
		},
		onError: (_err, _vars, context) => {
			if (context?.previous) {
				queryClient.setQueryData(formsQueryKey, context.previous);
			}
			toast.error("Failed to mark all ready");
		},
		onSuccess: () => {
			toast.success("All forms marked ready");
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: formsQueryKey });
		},
	});

	return {
		forms,
		eligibleForms,
		generatedForms,
		pendingForms,
		staleForms,
		allGenerated,
		hasStaleCertificates,
		anyBatched,
		allFormsReady,
		nextAction: nextCertificateAction(forms),
		generatingFormIds,
		isGenerating: generatingFormIds.size > 0,
		generate,
		generateAll,
		regenerateAll,
		setReady,
		markAllReady: () => markAllReadyMutation.mutate(),
		isMarkingAllReady: markAllReadyMutation.isPending,
	};
};
