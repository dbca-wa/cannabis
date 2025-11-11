import React, { useState } from "react";
import { ChevronRight, AlertCircle, Loader2 } from "lucide-react";
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
	type UISubmissionPhase,
	getNextPhase,
	canAdvancePhase,
	PhaseBadge,
} from "./PhaseIndicator";
import type { Submission } from "@/shared/types/backend-api.types";

interface WorkflowActionsProps {
	submission: Submission;
	userRole: "botanist" | "finance" | "none" | null;
	onAdvancePhase: (
		submissionId: number,
		targetPhase: UISubmissionPhase
	) => Promise<void>;
	className?: string;
}

export const WorkflowActions: React.FC<WorkflowActionsProps> = ({
	submission,
	userRole,
	onAdvancePhase,
	className,
}) => {
	const [isAdvancing, setIsAdvancing] = useState(false);
	const [showConfirmDialog, setShowConfirmDialog] = useState(false);

	const currentPhase = submission.phase as UISubmissionPhase;
	const nextPhase = getNextPhase(currentPhase);
	const canAdvance = canAdvancePhase(currentPhase, userRole);

	// Check if all required data is complete for advancement
	const getAdvancementBlockers = (): string[] => {
		const blockers: string[] = [];

		if (currentPhase === "data_entry_start") {
			if (!submission.approved_botanist) {
				blockers.push("Approved botanist must be assigned");
			}
			if (!submission.finance_officer) {
				blockers.push("Finance officer must be assigned");
			}
			if (submission.bags.length === 0) {
				blockers.push("At least one drug bag must be added");
			}
			if (submission.is_draft) {
				blockers.push("Submission must not be a draft");
			}
		}

		if (currentPhase === "botanist_approval_provided") {
			// Check if all bags have assessments
			const bagsWithoutAssessment = submission.bags.filter(
				(bag) =>
					!bag.assessment ||
					bag.assessment.determination === "pending"
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
			await onAdvancePhase(submission.id, nextPhase);
			toast.success("Phase advanced successfully", {
				description: `Submission moved to ${getPhaseLabel(nextPhase)}`,
			});
			setShowConfirmDialog(false);
		} catch (error) {
			toast.error("Failed to advance phase", {
				description:
					error instanceof Error
						? error.message
						: "Unknown error occurred",
			});
		} finally {
			setIsAdvancing(false);
		}
	};

	// Don't show actions if phase can't be advanced or no next phase
	if (!canAdvance || !nextPhase) {
		return null;
	}

	return (
		<>
			<div className={cn("flex items-center gap-4", className)}>
				{/* Current phase badge */}
				<div className="flex items-center gap-2">
					<span className="text-sm text-gray-600">Current:</span>
					<PhaseBadge phase={currentPhase} />
				</div>

				{/* Advance button */}
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

				{/* Blockers warning */}
				{hasBlockers && (
					<div className="flex items-center gap-2 text-sm text-amber-600">
						<AlertCircle className="h-4 w-4" />
						<span>{blockers.length} requirement(s) not met</span>
					</div>
				)}
			</div>

			{/* Confirmation dialog */}
			<AlertDialog
				open={showConfirmDialog}
				onOpenChange={setShowConfirmDialog}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Advance Submission Phase?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will move submission{" "}
							<strong>{submission.case_number}</strong> from{" "}
							<strong>{getPhaseLabel(currentPhase)}</strong> to{" "}
							<strong>{getPhaseLabel(nextPhase)}</strong>.
							{getAdvancementDescription(currentPhase, nextPhase)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={isAdvancing}>
							Cancel
						</AlertDialogCancel>
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

// Helper function to get phase label
function getPhaseLabel(phase: UISubmissionPhase): string {
	const labels: Record<UISubmissionPhase, string> = {
		data_entry_start: "Data Entry",
		finance_approval_provided: "Finance Approval",
		botanist_approval_provided: "Botanist Approval",
		in_review: "Review",
		certificate_generation_start: "Certificate Generation",
		invoice_generation_start: "Invoice Generation",
		sending_emails: "Sending Emails",
		complete: "Complete",
	};
	return labels[phase] || phase;
}

// Helper function to get advancement description
function getAdvancementDescription(
	currentPhase: UISubmissionPhase,
	nextPhase: UISubmissionPhase
): string {
	const descriptions: Record<string, string> = {
		"data_entry_start->finance_approval_provided":
			" This indicates that data entry is complete and the submission is ready for finance approval.",
		"finance_approval_provided->botanist_approval_provided":
			" This confirms finance approval and moves the submission to botanist approval.",
		"botanist_approval_provided->in_review":
			" This confirms botanist approval and moves the submission to final review.",
		"in_review->certificate_generation_start":
			" This will trigger automatic certificate generation.",
	};

	const key = `${currentPhase}->${nextPhase}`;
	return descriptions[key] || "";
}

// Compact version for inline use
interface WorkflowActionsCompactProps {
	submission: Submission;
	userRole: "botanist" | "finance" | "none" | null;
	onAdvancePhase: (
		submissionId: number,
		targetPhase: UISubmissionPhase
	) => Promise<void>;
}

export const WorkflowActionsCompact: React.FC<WorkflowActionsCompactProps> = ({
	submission,
	userRole,
	onAdvancePhase,
}) => {
	const [isAdvancing, setIsAdvancing] = useState(false);

	const currentPhase = submission.phase as UISubmissionPhase;
	const nextPhase = getNextPhase(currentPhase);
	const canAdvance = canAdvancePhase(currentPhase, userRole);

	if (!canAdvance || !nextPhase) {
		return <PhaseBadge phase={currentPhase} />;
	}

	const handleAdvance = async () => {
		setIsAdvancing(true);
		try {
			await onAdvancePhase(submission.id, nextPhase);
			toast.success("Phase advanced");
		} catch (error) {
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
