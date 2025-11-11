import React from "react";
import { FileText, DollarSign, Check, Mail, CheckCircle2 } from "lucide-react";
import { type SubmissionPhase } from "@/shared/types/backend-api.types";
import { SubmissionsService } from "@/features/submissions/services/submissions.service";

// Phase descriptions for tooltips
const PHASE_DESCRIPTIONS: Record<SubmissionPhase, string> = {
	data_entry:
		"Complete the initial form submission with all required information",
	finance_approval: "Finance team reviews budget and cost implications",
	botanist_review:
		"Expert botanist reviews and approves the submission details",
	documents:
		"Generate certificates and invoices for the approved application",
	send_emails: "Send notifications and documents to relevant parties",
	complete: "Workflow completed successfully. All documents sent",
};

interface PhaseProgressIndicatorProps {
	currentPhase: SubmissionPhase;
	completedPhases: SubmissionPhase[];
	viewingPhase?: SubmissionPhase;
	onPhaseClick: (phase: SubmissionPhase) => void;
	className?: string;
}

// Phase configuration with icons and labels
const PHASES: Array<{
	key: SubmissionPhase;
	label: string;
	shortLabel: string;
	icon: React.ComponentType<{ className?: string }>;
}> = [
	{
		key: "data_entry",
		label: "Data Entry",
		shortLabel: "Data Entry",
		icon: FileText,
	},
	{
		key: "finance_approval",
		label: "Finance Approval",
		shortLabel: "Finance",
		icon: DollarSign,
	},
	{
		key: "botanist_review",
		label: "Botanist Review",
		shortLabel: "Botanist",
		icon: Check,
	},
	{
		key: "documents",
		label: "Documents",
		shortLabel: "Documents",
		icon: FileText,
	},
	{
		key: "send_emails",
		label: "Send Emails",
		shortLabel: "Emails",
		icon: Mail,
	},
	{
		key: "complete",
		label: "Complete",
		shortLabel: "Complete",
		icon: CheckCircle2,
	},
];

export const PhaseProgressIndicator: React.FC<PhaseProgressIndicatorProps> = ({
	currentPhase,
	completedPhases,
	viewingPhase,
	onPhaseClick,
	className = "",
}) => {
	// Calculate progress percentage based on current phase
	const currentPhaseIndex = PHASES.findIndex((p) => p.key === currentPhase);
	const progressPercent = (currentPhaseIndex / (PHASES.length - 1)) * 100;

	// Determine phase status
	const getPhaseStatus = (
		phaseKey: SubmissionPhase
	): "completed" | "current" | "future" => {
		if (completedPhases.includes(phaseKey)) return "completed";
		if (phaseKey === currentPhase) return "current";
		return "future";
	};

	// Check if phase is clickable (completed or current)
	const isPhaseClickable = (phaseKey: SubmissionPhase): boolean => {
		return completedPhases.includes(phaseKey) || phaseKey === currentPhase;
	};

	// Get phase step classes based on status
	const getPhaseStepClasses = (
		phaseKey: SubmissionPhase,
		status: "completed" | "current" | "future"
	): string => {
		const baseClasses =
			"w-12 h-12 rounded-full border-4 flex items-center justify-center shadow-lg z-20 relative transition-all duration-300";

		// Viewing indicator
		const isViewing = viewingPhase === phaseKey;
		const viewingRing = isViewing
			? "ring-4 ring-blue-300 ring-offset-2"
			: "";

		if (status === "completed") {
			return `${baseClasses} border-emerald-500 bg-emerald-500 text-white ${viewingRing}`;
		}

		if (status === "current") {
			// Slower pulse animation with custom class
			return `${baseClasses} border-blue-500 bg-blue-500 text-white phase-pulse ${viewingRing}`;
		}

		return `${baseClasses} border-gray-300 bg-white text-gray-400 ${viewingRing}`;
	};

	// Get container classes for hover effect
	const getContainerClasses = (phaseKey: SubmissionPhase): string => {
		const baseClasses =
			"flex flex-col items-center transition-all duration-300";
		const clickable = isPhaseClickable(phaseKey);

		if (clickable) {
			return `${baseClasses} cursor-pointer hover:-translate-y-1`;
		}

		return `${baseClasses} cursor-not-allowed opacity-60`;
	};

	return (
		<div
			className={`bg-white rounded-xl shadow-lg p-6 md:p-8 ${className}`}
		>
			{/* Custom CSS for slower pulse animation */}
			<style>{`
				@keyframes phase-pulse {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.7; }
				}
				.phase-pulse {
					animation: phase-pulse 3s ease-in-out infinite;
				}
			`}</style>

			{/* Phase Steps */}
			<div className="relative">
				{/* Progress Line Background */}
				<div className="absolute top-6 left-6 right-6 h-1 bg-gray-200 rounded-full z-0">
					{/* Animated Progress Line */}
					<div
						className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
						style={{ width: `${progressPercent}%` }}
						aria-label={`Progress: ${Math.round(progressPercent)}%`}
					/>
				</div>

				{/* Phase Steps Container */}
				<div className="relative flex justify-between items-start">
					{PHASES.map((phase) => {
						const status = getPhaseStatus(phase.key);
						const Icon = phase.icon;
						const clickable = isPhaseClickable(phase.key);

						return (
							<div
								key={phase.key}
								className={getContainerClasses(phase.key)}
								onClick={() => {
									if (clickable) {
										onPhaseClick(phase.key);
									}
								}}
								role="button"
								tabIndex={clickable ? 0 : -1}
								title={PHASE_DESCRIPTIONS[phase.key]}
								aria-label={`${phase.label}: ${
									status === "completed"
										? "Completed"
										: status === "current"
										? "Current phase"
										: "Not started"
								}`}
								aria-current={
									phase.key === currentPhase
										? "step"
										: undefined
								}
								onKeyDown={(e) => {
									if (
										clickable &&
										(e.key === "Enter" || e.key === " ")
									) {
										e.preventDefault();
										onPhaseClick(phase.key);
									}
								}}
							>
								{/* Phase Circle with White Background */}
								<div className="relative">
									<div className="absolute inset-0 w-16 h-16 bg-white rounded-full z-10 -m-2" />
									<div
										className={getPhaseStepClasses(
											phase.key,
											status
										)}
									>
										{status === "completed" ? (
											<Check className="w-6 h-6" />
										) : (
											<Icon className="w-6 h-6" />
										)}
									</div>
								</div>

								{/* Phase Label */}
								<div className="mt-3 text-center max-w-24">
									<div className="text-sm font-semibold text-gray-900 hidden md:block">
										{phase.label}
									</div>
									<div className="text-sm font-semibold text-gray-900 md:hidden">
										{phase.shortLabel}
									</div>
									<div className="text-xs text-gray-500 mt-1">
										{status === "completed"
											? "✓ Done"
											: status === "current"
											? "Active"
											: "Pending"}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Mobile-friendly phase indicator */}
			<div className="mt-4 md:hidden text-center">
				<p className="text-sm text-gray-600">
					Current Phase:{" "}
					<span className="font-semibold text-gray-900">
						{SubmissionsService.getPhaseDisplay(currentPhase)}
					</span>
				</p>
			</div>
		</div>
	);
};
