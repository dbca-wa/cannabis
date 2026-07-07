import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";
import { DiscardWizardModal } from "./DiscardWizardModal";

interface WizardNavigationProps {
	currentStep: number;
	isLastStep: boolean;
	isSubmitting: boolean;
	onBack: () => void;
	onContinue: () => void;
	onDiscard: () => void;
	/** Whether the Continue button is enabled. Defaults to true. When false,
	 * the button is disabled to gate progression on the current step's validity. */
	canContinue?: boolean;
	/** When true, the destructive (delete) and finalise actions are disabled —
	 * used to lock a completed case down for non-admins. */
	lockActions?: boolean;
	/** Tooltip shown on the locked delete/finalise buttons. */
	lockMessage?: string;
	/** Label for the destructive action button. Defaults to "Discard" */
	discardLabel?: string;
	/** Title for the confirmation modal. Defaults to "Discard case?" */
	discardModalTitle?: string;
	/** Description for the confirmation modal. */
	discardModalDescription?: string;
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
	canContinue = true,
	lockActions = false,
	lockMessage,
	discardLabel = "Discard",
	discardModalTitle,
	discardModalDescription,
}: WizardNavigationProps) => {
	const [showDiscardModal, setShowDiscardModal] = useState(false);

	const canGoBack = currentStep > 0;

	const handleDiscardConfirm = () => {
		setShowDiscardModal(false);
		onDiscard();
	};

	return (
		<>
			<nav
				aria-label="Wizard navigation"
				className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3"
			>
				{/* Left group: Discard */}
				<div className="flex gap-2 sm:gap-3 order-2 sm:order-1">
					<Button
						variant="destructive"
						size="lg"
						onClick={() => setShowDiscardModal(true)}
						disabled={isSubmitting || lockActions}
						title={lockActions ? lockMessage : undefined}
						className="w-full sm:w-auto min-h-11"
					>
						{discardLabel}
					</Button>
				</div>

				{/* Right group: Back + Continue/Finalise */}
				<div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
					<Button
						variant="outline"
						size="lg"
						onClick={onBack}
						disabled={!canGoBack || isSubmitting}
						aria-label="Go to previous step"
						className="flex-1 sm:flex-initial min-h-11"
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						<span className="hidden sm:inline">Back</span>
					</Button>

					<Button
						size="lg"
						onClick={onContinue}
						disabled={!canContinue || isSubmitting || lockActions}
						title={
							lockActions
								? lockMessage
								: !canContinue
									? isLastStep
										? "Mark all forms as ready before finalising"
										: "All forms must have at least one drug bag before proceeding"
									: undefined
						}
						className={cn(
							"flex-1 sm:flex-initial min-h-11",
							isLastStep &&
								"bg-cannabis-green-dark hover:bg-cannabis-green-dark/90"
						)}
					>
						{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						{isLastStep ? "Finalise Case" : "Save and Continue"}
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
		</>
	);
};
