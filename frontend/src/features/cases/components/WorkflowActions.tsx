import React, { useState } from "react";
import { ChevronRight, AlertCircle, Loader2, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
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
import { toast } from "sonner";
import { cn } from "@/shared/utils/index";
import {
	type UICasePhase,
	getNextPhase,
	canAdvancePhase,
	PhaseBadge,
} from "./PhaseIndicator";
import type { Case } from "@/shared/types/backend-api.types";
import { useDocumentGeneration } from "../hooks/useDocumentGeneration";
import { getPhaseLabel, getAdvancementDescription } from "../utils/cases.utils";

interface WorkflowActionsProps {
	caseObj: Case;
	userRole: "botanist" | "finance" | "none" | null;
	onAdvancePhase: (
		submissionId: number,
		targetPhase: UICasePhase
	) => Promise<void>;
	className?: string;
}

export const WorkflowActions: React.FC<WorkflowActionsProps> = ({
	caseObj,
	userRole,
	onAdvancePhase,
	className,
}) => {
	const [isAdvancing, setIsAdvancing] = useState(false);
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);

	const {
		generateCertificate,
		generateInvoice,
		isGeneratingCertificate,
		isGeneratingInvoice,
	} = useDocumentGeneration(caseObj.id);

	const isDocumentsPhase = caseObj.phase === "documents";
	const showGenerateCertificate =
		isDocumentsPhase && !caseObj.certificates?.length;
	const showGenerateInvoice = isDocumentsPhase && !caseObj.invoices?.length;

	const currentPhase = caseObj.phase as UICasePhase;
	const nextPhase = getNextPhase(currentPhase);
	const canAdvance = canAdvancePhase(currentPhase, userRole);

	// Check if all required data is complete for advancement
	const getAdvancementBlockers = (): string[] => {
		const blockers: string[] = [];

		if (currentPhase === "data_entry_start") {
			if (!caseObj.approved_botanist) {
				blockers.push("Approved botanist must be assigned");
			}
			if (!caseObj.finance_officer) {
				blockers.push("Finance officer must be assigned");
			}
			if (caseObj.bags.length === 0) {
				blockers.push("At least one drug bag must be added");
			}
		}

		if (currentPhase === "botanist_approval_provided") {
			// Check if all bags have assessments
			const bagsWithoutAssessment = caseObj.bags.filter(
				(bag) => !bag.assessment || bag.assessment.determination === "pending"
			);
			if (bagsWithoutAssessment.length > 0) {
				blockers.push(
					`${bagsWithoutAssessment.length} bag(s) still need botanical assessment`
				);
			}
		}

		return blockers;
	};

	const blockers = getAdvancementBlockers();
	const hasBlockers = blockers.length > 0;

	const handleAdvanceClick = () => {
		if (hasBlockers) {
			toast.error("Cannot advance phase", {
				description: blockers.join(". "),
			});
			return;
		}
		setShowConfirmDialog(true);
	};

	const handleConfirmAdvance = async () => {
		if (!nextPhase) return;

		setIsAdvancing(true);
		try {
			await onAdvancePhase(caseObj.id, nextPhase);
			toast.success("Phase advanced successfully", {
				description: `Case moved to ${getPhaseLabel(nextPhase)}`,
			});
			setShowConfirmDialog(false);
		} catch (err: unknown) {
			toast.error("Failed to advance phase", {
				description:
					err instanceof Error ? err.message : "Unknown error occurred",
			});
		} finally {
			setIsAdvancing(false);
		}
	};

	// Don't show actions if phase can't be advanced or no next phase,
	// AND there are no generation buttons to show
	if (
		(!canAdvance || !nextPhase) &&
		!showGenerateCertificate &&
		!showGenerateInvoice
	) {
		return null;
	}

	return (
		<>
			<div className={cn("flex items-center gap-4 flex-wrap", className)}>
				{/* Current phase badge */}
				<div className="flex items-center gap-2">
					<span className="text-sm text-gray-600">Current:</span>
					<PhaseBadge phase={currentPhase} />
				</div>

				{/* Advance button */}
				{canAdvance && nextPhase && (
					<Button
						onClick={handleAdvanceClick}
						disabled={hasBlockers || isAdvancing}
						className="gap-2"
					>
						{isAdvancing ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Advancing...
							</>
						) : (
							<>
								Advance to {getPhaseLabel(nextPhase)}
								<ChevronRight className="h-4 w-4" />
							</>
						)}
					</Button>
				)}

				{/* Generate Certificate button */}
				{showGenerateCertificate && (
					<Button
						variant="outline"
						onClick={() => generateCertificate()}
						disabled={isGeneratingCertificate}
						className="gap-2"
					>
						{isGeneratingCertificate ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<FileText className="h-4 w-4" />
								Generate Certificate
							</>
						)}
					</Button>
				)}

				{/* Generate Invoice button */}
				{showGenerateInvoice && (
					<Button
						variant="outline"
						onClick={() => generateInvoice(caseObj.case_number)}
						disabled={isGeneratingInvoice}
						className="gap-2"
					>
						{isGeneratingInvoice ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" />
								Generating...
							</>
						) : (
							<>
								<FileText className="h-4 w-4" />
								Generate Invoice
							</>
						)}
					</Button>
				)}

				{/* Blockers warning */}
				{hasBlockers && (
					<div className="flex items-center gap-2 text-sm text-amber-600">
						<AlertCircle className="h-4 w-4" />
						<span>{blockers.length} requirement(s) not met</span>
					</div>
				)}
			</div>

			{/* Confirmation dialog */}
			<AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Advance Case Phase?</AlertDialogTitle>
						<AlertDialogDescription>
							This will move case <strong>{caseObj.case_number}</strong> from{" "}
							<strong>{getPhaseLabel(currentPhase)}</strong> to{" "}
							<strong>{getPhaseLabel(nextPhase!)}</strong>.
							{getAdvancementDescription(currentPhase, nextPhase!)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isAdvancing}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirmAdvance}
							disabled={isAdvancing}
							className="gap-2"
						>
							{isAdvancing ? (
								<>
									<Loader2 className="h-4 w-4 animate-spin" />
									Advancing...
								</>
							) : (
								<>
									Confirm Advancement
									<ChevronRight className="h-4 w-4" />
								</>
							)}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
};

// Compact version for inline use
interface WorkflowActionsCompactProps {
	caseObj: Case;
	userRole: "botanist" | "finance" | "none" | null;
	onAdvancePhase: (
		submissionId: number,
		targetPhase: UICasePhase
	) => Promise<void>;
}

export const WorkflowActionsCompact: React.FC<WorkflowActionsCompactProps> = ({
	caseObj,
	userRole,
	onAdvancePhase,
}) => {
	const [isAdvancing, setIsAdvancing] = useState(false);

	const currentPhase = caseObj.phase as UICasePhase;
	const nextPhase = getNextPhase(currentPhase);
	const canAdvance = canAdvancePhase(currentPhase, userRole);

	if (!canAdvance || !nextPhase) {
		return <PhaseBadge phase={currentPhase} />;
	}

	const handleAdvance = async () => {
		setIsAdvancing(true);
		try {
			await onAdvancePhase(caseObj.id, nextPhase);
			toast.success("Phase advanced");
		} catch {
			toast.error("Failed to advance phase");
		} finally {
			setIsAdvancing(false);
		}
	};

	return (
		<div className="flex items-center gap-2">
			<PhaseBadge phase={currentPhase} />
			<Button
				size="sm"
				variant="outline"
				onClick={handleAdvance}
				disabled={isAdvancing}
				className="h-6 gap-1 px-2 text-xs"
			>
				{isAdvancing ? (
					<Loader2 className="h-3 w-3 animate-spin" />
				) : (
					<ChevronRight className="h-3 w-3" />
				)}
			</Button>
		</div>
	);
};
