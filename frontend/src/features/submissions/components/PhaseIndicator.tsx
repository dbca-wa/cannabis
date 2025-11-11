import React from "react";
import {
	Check,
	Clock,
	FileText,
	DollarSign,
	Mail,
	CheckCircle2,
} from "lucide-react";
import { cn } from "@/shared/utils/index";

// UI-only phase type for visual workflow display (does not match backend phases)
// Backend uses: data_entry, finance_approval, botanist_review, documents, send_emails, complete
export type UISubmissionPhase =
	| "data_entry_start"
	| "finance_approval_provided"
	| "botanist_approval_provided"
	| "in_review"
	| "certificate_generation_start"
	| "invoice_generation_start"
	| "sending_emails"
	| "complete";

interface PhaseStep {
	key: UISubmissionPhase;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	description: string;
}

const PHASE_STEPS: PhaseStep[] = [
	{
		key: "data_entry_start",
		label: "Data Entry",
		icon: FileText,
		description: "Initial data entry and submission creation",
	},
	{
		key: "finance_approval_provided",
		label: "Finance Approval",
		icon: DollarSign,
		description: "Finance officer approval",
	},
	{
		key: "botanist_approval_provided",
		label: "Botanist Approval",
		icon: Check,
		description: "Botanist approval and assessment",
	},
	{
		key: "in_review",
		label: "Review",
		icon: Clock,
		description: "Final review before generation",
	},
	{
		key: "certificate_generation_start",
		label: "Certificate Generation",
		icon: FileText,
		description: "Generating certificates",
	},
	{
		key: "invoice_generation_start",
		label: "Invoice Generation",
		icon: DollarSign,
		description: "Generating invoices",
	},
	{
		key: "sending_emails",
		label: "Sending Emails",
		icon: Mail,
		description: "Sending notifications",
	},
	{
		key: "complete",
		label: "Complete",
		icon: CheckCircle2,
		description: "Submission complete",
	},
];

interface PhaseIndicatorProps {
	currentPhase: UISubmissionPhase;
	className?: string;
	variant?: "horizontal" | "vertical";
	showLabels?: boolean;
	showDescriptions?: boolean;
}

export const PhaseIndicator: React.FC<PhaseIndicatorProps> = ({
	currentPhase,
	className,
	variant = "horizontal",
	showLabels = true,
	showDescriptions = false,
}) => {
	const currentIndex = PHASE_STEPS.findIndex(
		(step) => step.key === currentPhase
	);

	const getStepStatus = (
		index: number
	): "complete" | "current" | "upcoming" => {
		if (index < currentIndex) return "complete";
		if (index === currentIndex) return "current";
		return "upcoming";
	};

	if (variant === "vertical") {
		return (
			<div className={cn("space-y-4", className)}>
				{PHASE_STEPS.map((step, index) => {
					const status = getStepStatus(index);
					const Icon = step.icon;

					return (
						<div key={step.key} className="flex items-start gap-3">
							{/* Icon and connector */}
							<div className="flex flex-col items-center">
								<div
									className={cn(
										"flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
										status === "complete" &&
											"border-green-500 bg-green-500 text-white",
										status === "current" &&
											"border-blue-500 bg-blue-500 text-white",
										status === "upcoming" &&
											"border-gray-300 bg-white text-gray-400"
									)}
								>
									{status === "complete" ? (
										<Check className="h-5 w-5" />
									) : (
										<Icon className="h-5 w-5" />
									)}
								</div>
								{index < PHASE_STEPS.length - 1 && (
									<div
										className={cn(
											"mt-2 h-12 w-0.5 transition-colors",
											index < currentIndex
												? "bg-green-500"
												: "bg-gray-300"
										)}
									/>
								)}
							</div>

							{/* Content */}
							<div className="flex-1 pt-1">
								<div
									className={cn(
										"font-medium transition-colors",
										status === "complete" &&
											"text-green-700",
										status === "current" && "text-blue-700",
										status === "upcoming" && "text-gray-500"
									)}
								>
									{step.label}
								</div>
								{showDescriptions && (
									<div className="mt-1 text-sm text-gray-600">
										{step.description}
									</div>
								)}
							</div>
						</div>
					);
				})}
			</div>
		);
	}

	// Horizontal variant
	return (
		<div className={cn("w-full", className)}>
			<div className="flex items-center justify-between">
				{PHASE_STEPS.map((step, index) => {
					const status = getStepStatus(index);
					const Icon = step.icon;
					const isLast = index === PHASE_STEPS.length - 1;

					return (
						<React.Fragment key={step.key}>
							<div className="flex flex-col items-center">
								{/* Icon */}
								<div
									className={cn(
										"flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
										status === "complete" &&
											"border-green-500 bg-green-500 text-white",
										status === "current" &&
											"border-blue-500 bg-blue-500 text-white",
										status === "upcoming" &&
											"border-gray-300 bg-white text-gray-400"
									)}
								>
									{status === "complete" ? (
										<Check className="h-5 w-5" />
									) : (
										<Icon className="h-5 w-5" />
									)}
								</div>

								{/* Label */}
								{showLabels && (
									<div
										className={cn(
											"mt-2 text-center text-xs font-medium transition-colors",
											status === "complete" &&
												"text-green-700",
											status === "current" &&
												"text-blue-700",
											status === "upcoming" &&
												"text-gray-500"
										)}
									>
										{step.label}
									</div>
								)}

								{/* Description */}
								{showDescriptions && (
									<div className="mt-1 text-center text-xs text-gray-600">
										{step.description}
									</div>
								)}
							</div>

							{/* Connector line */}
							{!isLast && (
								<div
									className={cn(
										"mx-2 h-0.5 flex-1 transition-colors",
										index < currentIndex
											? "bg-green-500"
											: "bg-gray-300"
									)}
								/>
							)}
						</React.Fragment>
					);
				})}
			</div>
		</div>
	);
};

// Compact badge version for tables
interface PhaseBadgeProps {
	phase: UISubmissionPhase;
	className?: string;
}

export const PhaseBadge: React.FC<PhaseBadgeProps> = ({ phase, className }) => {
	const step = PHASE_STEPS.find((s) => s.key === phase);
	if (!step) return null;

	const Icon = step.icon;

	const colorClasses: Record<UISubmissionPhase, string> = {
		data_entry_start: "bg-gray-100 text-gray-800 border-gray-300",
		finance_approval_provided: "bg-blue-100 text-blue-800 border-blue-300",
		botanist_approval_provided:
			"bg-green-100 text-green-800 border-green-300",
		in_review: "bg-yellow-100 text-yellow-800 border-yellow-300",
		certificate_generation_start:
			"bg-purple-100 text-purple-800 border-purple-300",
		invoice_generation_start:
			"bg-indigo-100 text-indigo-800 border-indigo-300",
		sending_emails: "bg-orange-100 text-orange-800 border-orange-300",
		complete: "bg-emerald-100 text-emerald-800 border-emerald-300",
	};

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
				colorClasses[phase],
				className
			)}
		>
			<Icon className="h-3 w-3" />
			{step.label}
		</span>
	);
};

// Progress percentage calculation
export const getPhaseProgress = (phase: UISubmissionPhase): number => {
	const index = PHASE_STEPS.findIndex((step) => step.key === phase);
	if (index === -1) return 0;
	return Math.round(((index + 1) / PHASE_STEPS.length) * 100);
};

// Get next phase in workflow
export const getNextPhase = (
	currentPhase: UISubmissionPhase
): UISubmissionPhase | null => {
	const index = PHASE_STEPS.findIndex((step) => step.key === currentPhase);
	if (index === -1 || index === PHASE_STEPS.length - 1) return null;
	return PHASE_STEPS[index + 1].key;
};

// Check if phase can be manually advanced
export const canAdvancePhase = (
	currentPhase: UISubmissionPhase,
	userRole: "botanist" | "finance" | "none" | null
): boolean => {
	// Only certain phases can be manually advanced
	const manualPhases: UISubmissionPhase[] = [
		"data_entry_start",
		"finance_approval_provided",
		"botanist_approval_provided",
		"in_review",
	];

	if (!manualPhases.includes(currentPhase)) return false;

	// Role-based restrictions
	if (currentPhase === "data_entry_start") {
		// Both botanist and finance can advance from data entry
		return userRole === "botanist" || userRole === "finance";
	}

	if (currentPhase === "finance_approval_provided") {
		// Only finance officer can provide finance approval
		return userRole === "finance";
	}

	if (currentPhase === "botanist_approval_provided") {
		// Only botanist can provide botanist approval
		return userRole === "botanist";
	}

	if (currentPhase === "in_review") {
		// Both can advance from review
		return userRole === "botanist" || userRole === "finance";
	}

	return false;
};
