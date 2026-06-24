import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft, Loader2, Undo2 } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";
import { DiscardWizardModal } from "./DiscardWizardModal";
import { SendBackDialog } from "./SendBackDialog";
import type { CasePhase } from "@/features/cases/types/cases.types";

interface WizardNavigationProps {
	currentStep: number;
	isLastStep: boolean;
	isSubmitting: boolean;
	onBack: () => void;
	onContinue: () => void;
	onDiscard: () => void;
	/** Label for the destructive action button. Defaults to "Discard" */
	discardLabel?: string;
	/** Title for the confirmation modal. Defaults to "Discard case?" */
	discardModalTitle?: string;
	/** Description for the confirmation modal. */
	discardModalDescription?: string;
	/** Current case phase — controls Send Back button visibility */
	casePhase?: CasePhase;
	/** Callback for the send-back action */
	onSendBack?: (targetPhase: CasePhase, reason: string) => Promise<void>;
	/** Whether the send-back mutation is pending */
	isSendingBack?: boolean;
}

/**
 * Navigation bar for the case wizard.
 *
 * Left side: Discard/Delete button (opens confirmation modal).
 * Right side: Back button + Continue/Finalise button.
 * Stacks vertically on mobile, side-by-side on sm+.
 */
export const WizardNavigation = ({
	currentStep,
	isLastStep,
	isSubmitting,
	onBack,
	onContinue,
	onDiscard,
	discardLabel = "Discard",
	discardModalTitle,
	discardModalDescription,
	casePhase,
	onSendBack,
	isSendingBack = false,
}: WizardNavigationProps) => {
	const [showDiscardModal, setShowDiscardModal] = useState(false);
	const [showSendBackDialog, setShowSendBackDialog] = useState(false);

	const canGoBack = currentStep > 0;
	const showSendBack =
		!!casePhase && casePhase !== "case_creation" && casePhase !== "complete";

	const handleDiscardConfirm = () => {
		setShowDiscardModal(false);
		onDiscard();
	};

	const handleSendBackSubmit = async (
		targetPhase: CasePhase,
		reason: string
	) => {
		if (!onSendBack) return;
		await onSendBack(targetPhase, reason);
		setShowSendBackDialog(false);
	};

	return (
		<>
			<nav
				aria-label="Wizard navigation"
				className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
			>
				{/* Left group: Discard + Send Back */}
				<div className="flex gap-2 sm:gap-3 order-2 sm:order-1">
					<Button
						variant="destructive"
						size="lg"
						onClick={() => setShowDiscardModal(true)}
						disabled={isSubmitting || isSendingBack}
						className="w-full sm:w-auto min-h-11"
					>
						{discardLabel}
					</Button>

					{showSendBack && onSendBack && (
						<Button
							variant="outline"
							size="lg"
							onClick={() => setShowSendBackDialog(true)}
							disabled={isSubmitting || isSendingBack}
							aria-label="Send case back to an earlier phase"
							className="w-full sm:w-auto min-h-11"
						>
							<Undo2 className="mr-2 h-4 w-4" />
							Send Back
						</Button>
					)}
				</div>

				{/* Right group: Back + Continue/Finalise */}
				<div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
					<Button
						variant="outline"
						size="lg"
						onClick={onBack}
						disabled={!canGoBack || isSubmitting || isSendingBack}
						aria-label="Go to previous step"
						className="flex-1 sm:flex-initial min-h-11"
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						<span className="hidden sm:inline">Back</span>
					</Button>

					<Button
						size="lg"
						onClick={onContinue}
						disabled={isSubmitting || isSendingBack}
						className={cn(
							"flex-1 sm:flex-initial min-h-11",
							isLastStep &&
								"bg-cannabis-green-dark hover:bg-cannabis-green-dark/90"
						)}
					>
						{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isLastStep ? "Finalise Case" : "Continue"}
					</Button>
				</div>
			</nav>

			<DiscardWizardModal
				open={showDiscardModal}
				onOpenChange={setShowDiscardModal}
				onConfirm={handleDiscardConfirm}
				title={discardModalTitle}
				description={discardModalDescription}
				confirmLabel={discardLabel}
			/>

			{showSendBack && casePhase && (
				<SendBackDialog
					open={showSendBackDialog}
					onOpenChange={setShowSendBackDialog}
					currentPhase={casePhase}
					onSubmit={handleSendBackSubmit}
					isPending={isSendingBack}
				/>
			)}
		</>
	);
};
