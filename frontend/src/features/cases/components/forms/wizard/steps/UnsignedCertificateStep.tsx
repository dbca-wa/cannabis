import { useEffect } from "react";
import {
	FileText,
	RefreshCw,
	Loader2,
	CheckCircle2,
	AlertCircle,
	AlertTriangle,
	Check,
	Circle,
	Info,
} from "lucide-react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { cn } from "@/shared/utils/style.utils";
import { useCaseCertificates } from "../../../../hooks/useCaseCertificates";
import { GeneratedCertificatesViewer } from "../GeneratedCertificatesViewer";
import { isFormStale } from "../../../../utils/certificateStaleness";
import type { Priority3Form } from "@/shared/types/backend-api.types";

interface UnsignedCertificateStepProps {
	caseId: number;
	lockActions?: boolean;
	lockMessage?: string;
	/** Callback fired when the all-forms-ready state changes */
	onAllReadyChange?: (allReady: boolean) => void;
}

/**
 * Certificate section — shows every form on the case and its certificate
 * status. Certificates can be generated or regenerated per form, or all at
 * once, and each form is marked ready once its certificate has been reviewed.
 *
 * Scoped to the case rather than the active form: finalising requires every
 * form's certificate, so all of them are listed here.
 */
export const UnsignedCertificateStep = ({
	caseId,
	lockActions = false,
	lockMessage,
	onAllReadyChange,
}: UnsignedCertificateStepProps) => {
	const {
		eligibleForms,
		generatedForms,
		pendingForms,
		staleForms,
		allGenerated,
		hasStaleCertificates,
		anyBatched,
		allFormsReady,
		generatingFormIds,
		generate: handleGenerate,
		generateAll: handleGenerateAll,
		regenerateAll: handleRegenerateAll,
		setReady,
		markAllReady: handleMarkAllReady,
	} = useCaseCertificates(caseId);

	const toggleReady = (form: Priority3Form) =>
		setReady(form.id, !form.marked_ready);

	useEffect(() => {
		onAllReadyChange?.(allFormsReady);
	}, [allFormsReady, onAllReadyChange]);

	// When a certificate goes stale, its "ready" mark reflects a review of data
	// that has since changed. Clear it on the server so the botanist must review
	// and re-mark the regenerated certificate. Guarded so it only fires for forms
	// still flagged ready, avoiding a loop.
	const staleReadyKey = staleForms
		.filter((f) => f.marked_ready)
		.map((f) => f.id)
		.join(",");
	useEffect(() => {
		if (!staleReadyKey) return;
		for (const id of staleReadyKey.split(",").map(Number)) {
			setReady(id, false);
		}
		// Fire only when the set of stale-yet-ready forms changes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [staleReadyKey]);

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
			{hasStaleCertificates ? (
				// A generated certificate no longer matches its bag data. Reuse the
				// summary banner's shape but in an attention-getting orange, animate
				// it in, and keep a continuously pulsing chip so it is obvious the
				// certificate on screen is out of date and should be regenerated.
				<motion.div
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.25, ease: "easeOut" }}
					className="flex items-center justify-between gap-3 rounded-lg border border-orange-300 bg-orange-50 p-3 dark:border-orange-700 dark:bg-orange-950/30"
				>
					<div className="flex items-center gap-3 min-w-0">
						<motion.span
							animate={{ opacity: [1, 0.4, 1] }}
							transition={{
								duration: 1.4,
								repeat: Infinity,
								ease: "easeInOut",
							}}
							className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-200 px-2 py-0.5 text-xs font-semibold text-orange-900 dark:bg-orange-800 dark:text-orange-100"
						>
							<AlertTriangle className="h-3 w-3" />
							Out of date
						</motion.span>
						<p className="text-sm text-orange-800 dark:text-orange-200">
							{staleForms.length} of {generatedForms.length} certificate
							{generatedForms.length !== 1 ? "s" : ""}{" "}
							{staleForms.length === 1 ? "is" : "are"} based on old data.
							Something printed on {staleForms.length === 1 ? "it" : "them"}{" "}
							changed after generating (bags, Section C, officers or their tick
							boxes, or the certificate wording) — regenerate to update.
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										size="sm"
										onClick={handleRegenerateAll}
										disabled={
											lockActions || generatingFormIds.size > 0 || anyBatched
										}
										className="bg-orange-600 text-white hover:bg-orange-700"
									>
										{generatingFormIds.size > 0 ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="mr-2 h-4 w-4" />
										)}
										Regenerate All
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								{anyBatched
									? "Certificates are batched. Use Repackage on the Batches page to regenerate."
									: lockActions
										? lockMessage
										: "Regenerate all certificates with the latest data"}
							</TooltipContent>
						</Tooltip>
					</div>
				</motion.div>
			) : allGenerated ? (
				<div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3">
					<p className="text-sm text-emerald-800 dark:text-emerald-200">
						All certificates generated ({generatedForms.length} of{" "}
						{eligibleForms.length}). The botanist signs the printed copies by
						hand.
					</p>
					<div className="flex items-center gap-2">
						<Tooltip>
							<TooltipTrigger asChild>
								<span>
									<Button
										size="sm"
										variant="outline"
										onClick={handleRegenerateAll}
										disabled={
											lockActions || generatingFormIds.size > 0 || anyBatched
										}
									>
										{generatingFormIds.size > 0 ? (
											<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										) : (
											<RefreshCw className="mr-2 h-4 w-4" />
										)}
										Regenerate All
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>
								{anyBatched
									? "Certificates are batched. Use Repackage on the Batches page to regenerate."
									: lockActions
										? lockMessage
										: "Regenerate all certificates with the latest data"}
							</TooltipContent>
						</Tooltip>
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
							<Tooltip>
								<TooltipTrigger asChild>
									<span>
										<Button
											size="sm"
											variant="outline"
											onClick={handleRegenerateAll}
											disabled={
												lockActions || generatingFormIds.size > 0 || anyBatched
											}
										>
											{generatingFormIds.size > 0 ? (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											) : (
												<RefreshCw className="mr-2 h-4 w-4" />
											)}
											Regenerate All
										</Button>
									</span>
								</TooltipTrigger>
								<TooltipContent>
									{anyBatched
										? "Certificates are batched. Use Repackage on the Batches page to regenerate."
										: lockActions
											? lockMessage
											: "Regenerate all certificates with the latest data"}
								</TooltipContent>
							</Tooltip>
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
					const stale = isFormStale(form);

					return (
						<div
							key={form.id}
							className={cn(
								"rounded-lg border p-4 space-y-3 transition-colors duration-300",
								// A stale certificate takes visual priority so the row that
								// needs regenerating stands out even if it was marked ready.
								stale
									? "border-orange-300 bg-orange-50/60 dark:border-orange-700 dark:bg-orange-950/20"
									: isReady
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
									<Badge
										variant="outline"
										className="text-[10px] bg-gray-50 text-gray-700 dark:bg-gray-800 dark:text-gray-200"
									>
										{bagCount} bag{bagCount !== 1 ? "s" : ""}
									</Badge>
									{hasGenerated && cert?.needs_repackage && (
										<span className="inline-flex items-center gap-1 rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-semibold text-orange-900 dark:bg-orange-800 dark:text-orange-100">
											<AlertTriangle className="h-3 w-3" aria-hidden="true" />
											Needs re-package
										</span>
									)}
									{hasGenerated && !stale && !cert?.needs_repackage && (
										<Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px]">
											<CheckCircle2 className="mr-1 h-3 w-3" />
											Generated
										</Badge>
									)}
									{stale && (
										<motion.span
											animate={{ opacity: [1, 0.4, 1] }}
											transition={{
												duration: 1.4,
												repeat: Infinity,
												ease: "easeInOut",
											}}
											className="inline-flex items-center gap-1 rounded-full bg-orange-200 px-2 py-0.5 text-[10px] font-semibold text-orange-900 dark:bg-orange-800 dark:text-orange-100"
										>
											<AlertTriangle className="h-3 w-3" />
											Out of date
										</motion.span>
									)}
								</div>
								<div className="flex items-center gap-2">
									<Tooltip>
										<TooltipTrigger asChild>
											<span>
												<Button
													type="button"
													variant={hasGenerated ? "outline" : "default"}
													size="sm"
													onClick={() => handleGenerate(form.id)}
													disabled={
														isGenerating || lockActions || !!cert?.batch_id
													}
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
											</span>
										</TooltipTrigger>
										<TooltipContent>
											{cert?.batch_id
												? "This certificate is in a batch. Use Re-package on the batch in Batches to rebuild it."
												: lockActions
													? lockMessage
													: hasGenerated
														? "Regenerate certificate with latest data"
														: "Generate certificate PDF"}
										</TooltipContent>
									</Tooltip>
									{/* Readiness toggle — a labelled button so it's obvious it marks
									    this certificate ready, with a tick and colour change once set. */}
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												onClick={() => hasGenerated && toggleReady(form)}
												disabled={!hasGenerated}
												className={cn(
													"inline-flex items-center gap-1.5 h-8 px-3 rounded-md border-2 text-xs font-medium transition-all duration-200 cursor-pointer",
													isReady
														? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600"
														: hasGenerated
															? "border-amber-400 bg-amber-50 text-amber-700 hover:border-emerald-400 hover:bg-emerald-50 dark:bg-amber-950/30 dark:text-amber-300"
															: "border-muted bg-muted/40 text-muted-foreground cursor-not-allowed opacity-60"
												)}
												aria-pressed={isReady}
												aria-label={
													isReady
														? "Certificate marked ready — click to unmark"
														: "Mark this certificate ready"
												}
											>
												{isReady ? (
													<>
														<Check className="h-4 w-4 shrink-0 animate-in zoom-in-50 duration-200" />
														Ready
													</>
												) : (
													<>
														<Circle className="h-4 w-4 shrink-0" />
														Mark ready
													</>
												)}
											</button>
										</TooltipTrigger>
										<TooltipContent>
											{!hasGenerated
												? "Generate the certificate first"
												: isReady
													? "This certificate is ready — click to unmark"
													: "Mark this certificate ready for finalising"}
										</TooltipContent>
									</Tooltip>
								</div>
							</div>

							{hasGenerated && cert && (
								<div className="pl-6">
									<p className="text-xs text-muted-foreground mb-2">
										Certificate: {cert.certificate_number}
									</p>
									{/* A batched certificate is not regenerated here. When the
									    case has changed since it was packaged, say which batch
									    to re-package; otherwise say how it would be updated. */}
									{cert.batch_id != null && cert.needs_repackage && (
										<p
											className="mb-2 flex items-start gap-1.5 rounded-md border border-orange-300 bg-orange-50 px-2.5 py-2 text-xs text-orange-900 dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-100"
											role="status"
										>
											<AlertTriangle
												className="mt-0.5 h-3.5 w-3.5 shrink-0"
												aria-hidden="true"
											/>
											<span>
												<strong>Out of date.</strong> Something this certificate
												prints has changed since batch{" "}
												{cert.batch_number ?? "its batch"} was packaged. Use{" "}
												<Link
													to="/batches"
													className="font-medium underline underline-offset-2"
												>
													Re-package on that batch in Batches
												</Link>{" "}
												to rebuild it.
											</span>
										</p>
									)}
									{cert.batch_id != null && !cert.needs_repackage && (
										<p className="mb-2 flex items-start gap-1.5 text-xs text-sky-800 dark:text-sky-200">
											<Info
												className="mt-0.5 h-3.5 w-3.5 shrink-0"
												aria-hidden="true"
											/>
											<span>
												This certificate is in batch{" "}
												{cert.batch_number ?? "a batch"}. If you change anything
												it prints, use Re-package on that batch in Batches to
												rebuild its PDFs.
											</span>
										</p>
									)}
									<GeneratedCertificatesViewer
										caseId={caseId}
										certificates={[cert]}
										refreshKey={cert.updated_at}
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
