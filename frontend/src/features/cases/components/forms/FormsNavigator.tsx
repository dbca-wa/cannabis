import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus, Trash2 } from "lucide-react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/utils/style.utils";
import { getCaseForms } from "../../services/forms.service";
import type { Priority3Form } from "../../types/cases.types";

/** Certificate-focused state styles for form badges */
const CERT_STATE_STYLES: Record<string, string> = {
	pending:
		"border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
	generated:
		"border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
	ready:
		"border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
	batched:
		"border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
};

interface FormsNavigatorProps {
	caseId: number;
	activeFormId: number | null;
	onFormSelect: (formId: number) => void;
	onAddForm?: () => void;
	isAddingForm?: boolean;
	onDeleteForm?: (formId: number) => void;
}

/**
 * Compact horizontal bar listing all Priority 3 forms on a case. Allows
 * switching between forms and adding new ones via callback props.
 */
export const FormsNavigator = ({
	caseId,
	activeFormId,
	onFormSelect,
	onAddForm,
	isAddingForm = false,
	onDeleteForm,
}: FormsNavigatorProps) => {
	const [deletePendingFormId, setDeletePendingFormId] = useState<number | null>(
		null
	);

	const { data, isLoading } = useQuery({
		queryKey: ["cases", caseId, "forms"],
		queryFn: () => getCaseForms(caseId),
		staleTime: 30_000,
	});

	const forms: Priority3Form[] = Array.isArray(data) ? data : [];

	const handleFormClick = (form: Priority3Form) => {
		if (form.id === activeFormId) return;
		onFormSelect(form.id);
	};

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 px-1 py-2">
				<Skeleton className="h-9 w-28" />
				<Skeleton className="h-9 w-28" />
			</div>
		);
	}

	if (!forms || forms.length === 0) return null;

	return (
		<>
			<nav
				aria-label="Priority 3 Forms"
				className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2"
			>
				<span className="text-xs font-medium text-muted-foreground mr-1">
					Forms:
				</span>
				{forms.map((form, index) => {
					const isActive = form.id === activeFormId;
					const bagCount = form.bags?.length ?? 0;
					const hasError = bagCount === 0;
					// Determine certificate-focused display state
					const isBatched = !!(
						form.certificate &&
						(form.certificate as unknown as Record<string, unknown>).batch_id
					);
					const hasCert = !!form.certificate;
					const isMarkedReady = form.marked_ready;
					const certState = isBatched
						? "batched"
						: isMarkedReady
							? "ready"
							: hasCert
								? "generated"
								: "pending";
					const certStateLabel =
						certState === "batched"
							? "Batched"
							: certState === "ready"
								? "Ready"
								: certState === "generated"
									? "Generated"
									: "Pending";
					return (
						<button
							key={form.id}
							type="button"
							onClick={() => handleFormClick(form)}
							aria-current={isActive ? "page" : undefined}
							className={cn(
								"group flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm transition-colors cursor-pointer",
								hasError
									? "border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/40 dark:text-red-200"
									: isActive
										? "border-blue-300 bg-blue-50 font-medium text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
										: "border-transparent bg-background hover:bg-accent hover:text-accent-foreground"
							)}
						>
							<FileText className="h-3.5 w-3.5" />
							<span>Form {index + 1}</span>
							<Badge
								variant="outline"
								className={cn(
									"ml-1 px-1.5 py-0 text-[10px]",
									CERT_STATE_STYLES[certState] ?? ""
								)}
							>
								{certStateLabel}
							</Badge>
							<span
								className={cn(
									"text-[10px]",
									hasError
										? "text-red-600 font-medium"
										: "text-muted-foreground"
								)}
							>
								({bagCount} bag{bagCount !== 1 ? "s" : ""})
							</span>
							{onDeleteForm && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										setDeletePendingFormId(form.id);
									}}
									className="ml-1 p-0.5 rounded cursor-pointer text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 opacity-0 group-hover:opacity-100 transition-opacity"
									aria-label={`Delete form ${index + 1}`}
									title="Delete this form"
								>
									<Trash2 className="h-3 w-3" />
								</button>
							)}
						</button>
					);
				})}
				{onAddForm && (
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={onAddForm}
						disabled={isAddingForm}
						className="h-8 text-xs"
					>
						<Plus className="mr-1 h-3.5 w-3.5" />
						Add Form
					</Button>
				)}
			</nav>

			<AlertDialog
				open={deletePendingFormId !== null}
				onOpenChange={(open) => {
					if (!open) setDeletePendingFormId(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this form?</AlertDialogTitle>
						<AlertDialogDescription>
							This will permanently remove the form and its drug bags. This
							action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (deletePendingFormId) onDeleteForm?.(deletePendingFormId);
								setDeletePendingFormId(null);
							}}
						>
							Delete Form
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};
