import { Button } from "@/shared/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";

interface WizardNavigationProps {
	currentStep: number;
	isLastStep: boolean;
	isSubmitting: boolean;
	onBack: () => void;
	onContinue: () => void;
	onDiscard: () => void;
	canContinue?: boolean;
	lockActions?: boolean;
	lockMessage?: string;
	discardLabel?: string;
	discardModalTitle?: string;
	discardModalDescription?: string;
}

/**
 * Navigation bar for the case processing wizard.
 *
 * Simple layout: Back (left) and Save and Continue (right).
 * Back is greyed out on the first step.
 */
export const WizardNavigation = ({
	currentStep,
	isLastStep,
	isSubmitting,
	onBack,
	onContinue,
	canContinue = true,
	lockActions = false,
	lockMessage,
}: WizardNavigationProps) => {
	const canGoBack = currentStep > 0;

	return (
		<nav
			aria-label="Wizard navigation"
			className="flex items-center justify-between gap-3"
		>
			{/* Left: Back button — greyed out on step 0 */}
			<Button
				variant="outline"
				size="lg"
				onClick={onBack}
				disabled={!canGoBack || isSubmitting}
				aria-label="Go to previous step"
				className="min-h-11"
			>
				<ArrowLeft className="mr-2 h-4 w-4" />
				Back
			</Button>

			{/* Right: Save and Continue / Finalise */}
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
					"min-h-11",
					isLastStep && "bg-cannabis-green-dark hover:bg-cannabis-green-dark/90"
				)}
			>
				{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
				{isLastStep ? "Finalise Case" : "Save and Continue"}
			</Button>
		</nav>
	);
};
