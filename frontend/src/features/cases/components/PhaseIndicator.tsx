/* eslint-disable react-refresh/only-export-components */
import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/utils/index";
import type { CasePhase } from "@/shared/types/backend-api.types";
import {
	PHASE_STEPS,
	PHASE_BADGE_COLOURS,
	type PhaseStepConfig,
} from "@/shared/constants/phases.config";

/**
 * UI phase type matching the backend CasePhase — used for the detail page stepper.
 */
export type UICasePhase = CasePhase;

// Re-export helpers that other components need from canonical config
export {
	getPhaseProgress,
	getNextPhase,
	isValidPhase,
} from "@/shared/constants/phases.config";

/**
 * Check if the current phase can be manually advanced by the given user role.
 * All non-complete phases can be advanced by botanists, finance officers, or admins.
 */
export const canAdvancePhase = (
	currentPhase: CasePhase,
	userRole: "botanist" | "finance" | "none" | null
): boolean => {
	if (currentPhase === "complete") return false;
	if (!userRole || userRole === "none") return false;
	return true;
};

interface PhaseIndicatorProps {
	currentPhase: CasePhase;
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
				{PHASE_STEPS.map((step: PhaseStepConfig, index: number) => {
					const status = getStepStatus(index);
					const Icon = step.icon;

					return (
						<div key={step.key} className="flex items-start gap-3">
							<div className="flex flex-col items-center">
								<div
									className={cn(
										"flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
										status === "complete" &&
											"border-emerald-500 bg-emerald-500 text-white",
										status === "current" &&
											"border-blue-500 bg-blue-500 text-white step-pulse",
										status === "upcoming" &&
											"border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500"
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
												? "bg-emerald-500"
												: "bg-gray-300 dark:bg-gray-600"
										)}
									/>
								)}
							</div>

							<div className="flex-1 pt-1">
								<div
									className={cn(
										"font-medium text-sm transition-colors",
										status === "complete" &&
											"text-emerald-600 dark:text-emerald-400",
										status === "current" && "text-blue-600 dark:text-blue-400",
										status === "upcoming" && "text-gray-500 dark:text-gray-400"
									)}
								>
									{step.label}
								</div>
								{showDescriptions && (
									<div className="mt-1 text-xs text-muted-foreground">
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
				{PHASE_STEPS.map((step: PhaseStepConfig, index: number) => {
					const status = getStepStatus(index);
					const Icon = step.icon;
					const isLast = index === PHASE_STEPS.length - 1;

					return (
						<React.Fragment key={step.key}>
							<div className="flex flex-col items-center">
								<div
									className={cn(
										"flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors",
										status === "complete" &&
											"border-emerald-500 bg-emerald-500 text-white",
										status === "current" &&
											"border-blue-500 bg-blue-500 text-white step-pulse",
										status === "upcoming" &&
											"border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500"
									)}
								>
									{status === "complete" ? (
										<Check className="h-5 w-5" />
									) : (
										<Icon className="h-5 w-5" />
									)}
								</div>

								{showLabels && (
									<div
										className={cn(
											"mt-2 text-center text-xs font-medium transition-colors whitespace-nowrap",
											status === "complete" &&
												"text-emerald-600 dark:text-emerald-400",
											status === "current" &&
												"text-blue-600 dark:text-blue-400",
											status === "upcoming" &&
												"text-gray-500 dark:text-gray-400"
										)}
									>
										{step.label}
									</div>
								)}

								{showDescriptions && (
									<div className="mt-1 text-center text-xs text-muted-foreground">
										{step.description}
									</div>
								)}
							</div>

							{!isLast && (
								<div
									className={cn(
										"mx-2 h-0.5 flex-1 transition-colors",
										index < currentIndex
											? "bg-emerald-500"
											: "bg-gray-300 dark:bg-gray-600"
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
	phase: CasePhase;
	className?: string;
}

export const PhaseBadge: React.FC<PhaseBadgeProps> = ({ phase, className }) => {
	const step = PHASE_STEPS.find((s) => s.key === phase);
	if (!step) return null;

	const Icon = step.icon;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
				PHASE_BADGE_COLOURS[phase],
				className
			)}
		>
			<Icon className="h-3 w-3" />
			{step.label}
		</span>
	);
};
