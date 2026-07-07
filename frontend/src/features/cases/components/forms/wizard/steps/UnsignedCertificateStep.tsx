import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	FileText,
	RefreshCw,
	Loader2,
	CheckCircle2,
	AlertCircle,
	Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/utils/style.utils";
import {
	getCaseForms,
	generateFormCertificate,
	updateForm,
} from "../../../../services/forms.service";
import { GeneratedCertificatesViewer } from "../GeneratedCertificatesViewer";
import type { Priority3Form } from "@/shared/types/backend-api.types";

interface UnsignedCertificateStepProps {
	caseData: Record<string, unknown> | null;
	caseId: number;
	formId: number;
	onAction: (action: string) => void;
	lockActions?: boolean;
	lockMessage?: string;
	/** Callback fired when the all-forms-ready state changes */
	onAllReadyChange?: (allReady: boolean) => void;
}

/**
 * Multi-form certificate step — shows ALL forms on the case and their
 * certificate status. Users can generate/regenerate certificates per form
 * or generate all at once.
 */
export const UnsignedCertificateStep = ({
	caseData: _caseData,
	caseId,
	formId: _formId,
	onAction: _onAction,
	lockActions = false,
	lockMessage,
	onAllReadyChange,
}: UnsignedCertificateStepProps) => {
	const queryClient = useQueryClient();
	const [generatingFormIds, setGeneratingFormIds] = useState<Set<number>>(
		new Set()
	);
	const [viewerRefreshKeys, setViewerRefreshKeys] = useState<
		Record<number, number>
	>({});

	// Load all forms for this case
	const { data: formsData } = useQuery({
		queryKey: ["cases", caseId, "forms"],
		queryFn: () => getCaseForms(caseId),
		staleTime: 30_000,
	});
	const forms: Priority3Form[] = Array.isArray(formsData) ? formsData : [];

	// Per-form readiness derived from server data (marked_ready field)
	const readyFormIds = new Set(
		forms.filter((f) => f.marked_ready).map((f) => f.id)
	);

	// Forms with bags (eligible for generation)
	const eligibleForms = forms.filter((f) => (f.bags?.length ?? 0) > 0);
	// Forms that already have a generated certificate
	const generatedForms = eligibleForms.filter(
		(f) => f.certificate && (f.certificate.pdf_url || f.certificate.pdf_file)
	);
	// Forms that need generation
	const pendingForms = eligibleForms.filter(
		(f) => !f.certificate || (!f.certificate.pdf_url && !f.certificate.pdf_file)
	);

	const allGenerated = eligibleForms.length > 0 && pendingForms.length === 0;

	// Track whether a batch operation is in progress to suppress per-form toasts
	const batchCountRef = useRef(0);

	// Generate mutation for a single form
	const generateMutation = useMutation({
		mutationFn: (fId: number) => generateFormCertificate(fId, {}),
		onSuccess: async (_data, fId) => {
			await queryClient.invalidateQueries({
				queryKey: ["cases", caseId, "forms"],
			});
			// Only refresh the specific form's PDF viewer
			setViewerRefreshKeys((prev) => ({
				...prev,
				[fId]: (prev[fId] ?? 0) + 1,
			}));
			// Only show individual toast if not in a batch operation
			if (batchCountRef.current <= 1) {
				toast.success("Certificate generated");
			}
		},
		onError: () => {
			toast.error("Failed to generate certificate");
		},
		onSettled: (_data, _err, fId) => {
			setGeneratingFormIds((prev) => {
				const next = new Set(prev);
				next.delete(fId);
				return next;
			});
			// Decrement batch counter and show summary toast when all done
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

	const handleGenerate = (fId: number) => {
		setGeneratingFormIds((prev) => new Set(prev).add(fId));
		generateMutation.mutate(fId);
	};

	const handleGenerateAll = () => {
		batchCountRef.current = pendingForms.length;
		for (const form of pendingForms) {
			handleGenerate(form.id);
		}
	};

	const handleRegenerateAll = () => {
		batchCountRef.current = eligibleForms.length;
		for (const form of eligibleForms) {
			handleGenerate(form.id);
		}
	};

	const toggleReadyMutation = useMutation({
		mutationFn: ({ fId, ready }: { fId: number; ready: boolean }) =>
			updateForm(fId, { marked_ready: ready }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["cases", caseId, "forms"],
			});
		},
		onError: () => {
			toast.error("Failed to update readiness");
		},
	});

	const toggleReady = (formId: number) => {
		const currentlyReady = readyFormIds.has(formId);
		toggleReadyMutation.mutate({ fId: formId, ready: !currentlyReady });
	};

	const markAllReadyMutation = useMutation({
		mutationFn: () =>
			Promise.all(
				eligibleForms
					.filter((f) => !f.marked_ready)
					.map((f) => updateForm(f.id, { marked_ready: true }))
			),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: ["cases", caseId, "forms"],
			});
			toast.success("All forms marked ready");
		},
		onError: () => {
			toast.error("Failed to mark all ready");
		},
	});

	const handleMarkAllReady = () => {
		markAllReadyMutation.mutate();
	};

	// Notify parent when all-ready state changes
	const allFormsReady =
		eligibleForms.length > 0 &&
		allGenerated &&
		eligibleForms.every((f) => readyFormIds.has(f.id));
	useEffect(() => {
		onAllReadyChange?.(allFormsReady);
	}, [allFormsReady, onAllReadyChange]);

	if (eligibleForms.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
				<AlertCircle className="mb-4 h-12 w-12 text-muted-foreground" />
				<p className="mb-2 text-sm font-medium">No forms with drug bags</p>
				<p className="text-xs text-muted-foreground">
					Add drug bags to at least one form before generating certificates.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Summary */}
			{allGenerated ? (
				<div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3">
					<p className="text-sm text-emerald-800 dark:text-emerald-200">
						All certificates generated ({generatedForms.length} of{" "}
						{eligibleForms.length}). The botanist signs the printed copies by
						hand.
					</p>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={handleRegenerateAll}
							disabled={lockActions || generatingFormIds.size > 0}
							title={
								lockActions
									? lockMessage
									: "Regenerate all certificates with the latest data"
							}
						>
							{generatingFormIds.size > 0 ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<RefreshCw className="mr-2 h-4 w-4" />
							)}
							Regenerate All
						</Button>
						{!allFormsReady && (
							<Button
								size="sm"
								onClick={handleMarkAllReady}
								disabled={lockActions}
								className="bg-emerald-600 hover:bg-emerald-700 text-white"
							>
								<Check className="mr-2 h-4 w-4" />
								Mark All Ready
							</Button>
						)}
					</div>
				</div>
			) : (
				<div className="flex items-center justify-between rounded-lg border p-3">
					<p className="text-sm text-muted-foreground">
						{generatedForms.length} of {eligibleForms.length} certificate
						{eligibleForms.length !== 1 ? "s" : ""} generated.
					</p>
					<div className="flex items-center gap-2">
						{generatedForms.length > 0 && (
							<Button
								size="sm"
								variant="outline"
								onClick={handleRegenerateAll}
								disabled={lockActions || generatingFormIds.size > 0}
								title={
									lockActions
										? lockMessage
										: "Regenerate all certificates with the latest data"
								}
							>
								{generatingFormIds.size > 0 ? (
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								) : (
									<RefreshCw className="mr-2 h-4 w-4" />
								)}
								Regenerate All
							</Button>
						)}
						<Button
							size="sm"
							onClick={handleGenerateAll}
							disabled={lockActions || generatingFormIds.size > 0}
							title={lockActions ? lockMessage : undefined}
						>
							{generatingFormIds.size > 0 ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<FileText className="mr-2 h-4 w-4" />
							)}
							Generate All ({pendingForms.length})
						</Button>
					</div>
				</div>
			)}

			{/* Per-form certificate cards */}
			<div className="space-y-4">
				{eligibleForms.map((form, index) => {
					const cert = form.certificate;
					const hasGenerated = !!(cert && (cert.pdf_url || cert.pdf_file));
					const isGenerating = generatingFormIds.has(form.id);
					const bagCount = form.bags?.length ?? 0;
					const isReady = form.marked_ready;

					return (
						<div
							key={form.id}
							className={cn(
								"rounded-lg border p-4 space-y-3 transition-colors duration-300",
								isReady
									? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
									: hasGenerated
										? "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
										: "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
							)}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<FileText
										className={cn(
											"h-4 w-4",
											hasGenerated
												? "text-emerald-600"
												: "text-muted-foreground"
										)}
									/>
									<span className="text-sm font-medium">Form {index + 1}</span>
									<Badge variant="outline" className="text-[10px]">
										{bagCount} bag{bagCount !== 1 ? "s" : ""}
									</Badge>
									{hasGenerated && (
										<Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px]">
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Generated
										</Badge>
									)}
								</div>
								<div className="flex items-center gap-2">
									<Button
										type="button"
										variant={hasGenerated ? "outline" : "default"}
										size="sm"
										onClick={() => handleGenerate(form.id)}
										disabled={isGenerating || lockActions}
										title={lockActions ? lockMessage : undefined}
									>
										{isGenerating ? (
											<Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
										) : hasGenerated ? (
											<RefreshCw className="mr-1 h-3.5 w-3.5" />
										) : (
											<FileText className="mr-1 h-3.5 w-3.5" />
										)}
										{isGenerating
											? "Generating..."
											: hasGenerated
												? "Regenerate"
												: "Generate"}
									</Button>
									{/* Readiness toggle */}
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={() => hasGenerated && toggleReady(form.id)}
												disabled={!hasGenerated}
												className={cn(
													"w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 cursor-pointer",
													isReady
														? "border-emerald-500 bg-emerald-500 text-white scale-110"
														: hasGenerated
															? "border-amber-400 bg-amber-50 text-amber-400 hover:border-emerald-400 hover:bg-emerald-50 dark:bg-amber-950/30"
															: "border-red-300 bg-red-50 text-red-300 cursor-not-allowed opacity-50 dark:bg-red-950/30"
												)}
												aria-label={
													isReady ? "Marked as ready" : "Mark as ready"
												}
											>
												{isReady && (
													<Check className="h-4 w-4 animate-in zoom-in-50 duration-200" />
												)}
											</button>
										</TooltipTrigger>
										<TooltipContent>
											{!hasGenerated
												? "Generate certificate first"
												: isReady
													? "Click to unmark"
													: "Mark as ready"}
										</TooltipContent>
									</Tooltip>
								</div>
							</div>

							{hasGenerated && cert && (
								<div className="pl-6">
									<p className="text-xs text-muted-foreground mb-2">
										Certificate: {cert.certificate_number}
									</p>
									<GeneratedCertificatesViewer
										caseId={caseId}
										certificates={[cert]}
										refreshKey={viewerRefreshKeys[form.id] ?? 0}
									/>
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};
