import { Suspense, lazy } from "react";
import { observer } from "mobx-react-lite";
import { AlertCircle, Clock } from "lucide-react";
import {
	type SubmissionPhase,
	type Submission,
} from "@/shared/types/backend-api.types";
import { SubmissionsService } from "@/features/submissions/services/submissions.service";

// Lazy load phase-specific content components
const DataEntryPhaseContent = lazy(() =>
	import("./phase-content/DataEntryPhaseContent").then((m) => ({
		default: m.DataEntryPhaseContent,
	}))
);

const FinanceApprovalPhaseContent = lazy(() =>
	import("./phase-content/FinanceApprovalPhaseContent").then((m) => ({
		default: m.FinanceApprovalPhaseContent,
	}))
);

const BotanistReviewPhaseContent = lazy(() =>
	import("./phase-content/BotanistReviewPhaseContent").then((m) => ({
		default: m.BotanistReviewPhaseContent,
	}))
);

const DocumentsPhaseContent = lazy(() =>
	import("./phase-content/DocumentsPhaseContent").then((m) => ({
		default: m.DocumentsPhaseContent,
	}))
);

const SendEmailsPhaseContent = lazy(() =>
	import("./phase-content/SendEmailsPhaseContent").then((m) => ({
		default: m.SendEmailsPhaseContent,
	}))
);

const CompletePhaseContent = lazy(() =>
	import("./phase-content/CompletePhaseContent").then((m) => ({
		default: m.CompletePhaseContent,
	}))
);

interface PhaseContentProps {
	submission: Submission;
	phase: SubmissionPhase;
	isCurrentPhase: boolean;
	canEdit: boolean;
	onUpdate?: (data: Partial<Submission>) => Promise<void>;
	className?: string;
}

/**
 * PhaseContent Wrapper Component
 *
 * Dynamically loads and displays phase-specific content based on the current phase.
 * Supports both read-only mode (for completed phases) and editable mode (for current phase with permissions).
 *
 * Features:
 * - Dynamic phase content loading with lazy loading for performance
 * - Read-only mode for completed phases
 * - Editable mode for current phase with permissions
 * - Historical data viewing indicator
 * - Smooth transitions between phases
 *
 * Requirements: 2.2, 2.3, 2.4, 2.6
 */
export const PhaseContent = observer<PhaseContentProps>(
	({
		submission,
		phase,
		isCurrentPhase,
		canEdit,
		onUpdate,
		className = "",
	}) => {
		// Determine if we're viewing historical data
		const isHistoricalView = !isCurrentPhase;

		// Get phase display name
		const phaseDisplayName = SubmissionsService.getPhaseDisplay(phase);

		// Render the appropriate phase content component
		const renderPhaseContent = () => {
			const commonProps = {
				submission,
				isCurrentPhase,
				canEdit,
				onUpdate,
			};

			switch (phase) {
				case "data_entry":
					return <DataEntryPhaseContent {...commonProps} />;
				case "finance_approval":
					return <FinanceApprovalPhaseContent {...commonProps} />;
				case "botanist_review":
					return <BotanistReviewPhaseContent {...commonProps} />;
				case "documents":
					return <DocumentsPhaseContent {...commonProps} />;
				case "send_emails":
					return <SendEmailsPhaseContent {...commonProps} />;
				case "complete":
					return <CompletePhaseContent {...commonProps} />;
				default:
					return (
						<div className="p-8 text-center">
							<AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
							<p className="text-gray-600">
								Unknown phase: {phase}
							</p>
						</div>
					);
			}
		};

		return (
			<div
				className={`phase-content-wrapper transition-all duration-300 ease-in-out ${className}`}
			>
				{/* Historical Data Indicator */}
				{isHistoricalView && (
					<div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/20 border-l-4 border-blue-500 rounded-r-lg">
						<div className="flex items-center gap-2">
							<Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
							<div>
								<p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
									Viewing Historical Data
								</p>
								<p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
									You are viewing the {phaseDisplayName} phase
									as it was completed. This data is read-only.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Read-Only Mode Indicator (for current phase without edit permission) */}
				{isCurrentPhase && !canEdit && (
					<div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border-l-4 border-amber-500 rounded-r-lg">
						<div className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
							<div>
								<p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
									Read-Only View
								</p>
								<p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
									You do not have permission to edit this
									phase.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Phase Content with Suspense for Lazy Loading */}
				<div className="phase-content-container">
					<Suspense
						fallback={
							<div className="p-8 text-center">
								<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
								<p className="mt-4 text-gray-600">
									Loading {phaseDisplayName} content...
								</p>
							</div>
						}
					>
						{renderPhaseContent()}
					</Suspense>
				</div>
			</div>
		);
	}
);

PhaseContent.displayName = "PhaseContent";
