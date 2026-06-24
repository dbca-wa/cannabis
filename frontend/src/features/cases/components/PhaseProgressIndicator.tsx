import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/shared/utils/index";
import type { CasePhase } from "@/shared/types/backend-api.types";
import {
	PHASE_STEPS,
	type PhaseStepConfig,
} from "@/shared/constants/phases.config";
import { getPhaseDisplay } from "@/features/cases/utils/cases.utils";

interface PhaseProgressIndicatorProps {
	currentPhase: CasePhase;
	completedPhases: CasePhase[];
	viewingPhase?: CasePhase;
	onPhaseClick: (phase: CasePhase) => void;
	className?: string;
}

export const PhaseProgressIndicator: React.FC<PhaseProgressIndicatorProps> = ({
	currentPhase,
	completedPhases,
	viewingPhase,
	onPhaseClick,
	className = "",
}) => {
	const currentPhaseIndex = PHASE_STEPS.findIndex(
		(p) => p.key === currentPhase
	);
	const progressPercent = (currentPhaseIndex / (PHASE_STEPS.length - 1)) * 100;

	const getPhaseStatus = (
		phaseKey: CasePhase
	): "completed" | "current" | "future" => {
		if (completedPhases.includes(phaseKey)) return "completed";
		if (phaseKey === currentPhase) return "current";
		return "future";
	};

	const isPhaseClickable = (phaseKey: CasePhase): boolean => {
		return completedPhases.includes(phaseKey) || phaseKey === currentPhase;
	};

	const getPhaseStepClasses = (
		phaseKey: CasePhase,
		status: "completed" | "current" | "future"
	): string => {
		const baseClasses =
			"w-12 h-12 rounded-full border-4 flex items-center justify-center shadow-lg z-20 relative transition-all duration-300";

		const isViewing = viewingPhase === phaseKey;
		const viewingRing = isViewing ? "ring-4 ring-blue-300 ring-offset-2" : "";

		if (status === "completed") {
			return `${baseClasses} border-emerald-500 bg-emerald-500 text-white ${viewingRing}`;
		}

		if (status === "current") {
			return `${baseClasses} border-blue-500 bg-blue-500 text-white phase-pulse ${viewingRing}`;
		}

		return `${baseClasses} border-gray-300 bg-white text-gray-400 ${viewingRing}`;
	};

	const getContainerClasses = (phaseKey: CasePhase): string => {
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
			className={cn(
				"bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 md:p-8",
				className
			)}
		>
			<style>{`
				@keyframes phase-pulse {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.7; }
				}
				.phase-pulse {
					animation: phase-pulse 3s ease-in-out infinite;
				}
			`}</style>

			<div className="relative">
				{/* Progress line background */}
				<div className="absolute top-6 left-6 right-6 h-1 bg-gray-200 dark:bg-gray-700 rounded-full z-0">
					<div
						className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
						style={{ width: `${progressPercent}%` }}
						aria-label={`Progress: ${Math.round(progressPercent)}%`}
					/>
				</div>

				{/* Phase steps */}
				<div className="relative flex justify-between items-start">
					{PHASE_STEPS.map((phase: PhaseStepConfig) => {
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
								title={phase.description}
								aria-label={`${phase.label}: ${
									status === "completed"
										? "Completed"
										: status === "current"
											? "Current phase"
											: "Not started"
								}`}
								aria-current={phase.key === currentPhase ? "step" : undefined}
								onKeyDown={(e) => {
									if (clickable && (e.key === "Enter" || e.key === " ")) {
										e.preventDefault();
										onPhaseClick(phase.key);
									}
								}}
							>
								{/* Phase circle */}
								<div className="relative">
									<div className="absolute inset-0 w-16 h-16 bg-white dark:bg-gray-900 rounded-full z-10 -m-2" />
									<div className={getPhaseStepClasses(phase.key, status)}>
										{status === "completed" ? (
											<Check className="w-6 h-6" />
										) : (
											<Icon className="w-6 h-6" />
										)}
									</div>
								</div>

								{/* Phase label */}
								<div className="mt-3 text-center max-w-24">
									<div className="text-sm font-semibold text-gray-900 dark:text-gray-100 hidden md:block">
										{phase.label}
									</div>
									<div className="text-sm font-semibold text-gray-900 dark:text-gray-100 md:hidden">
										{phase.shortLabel}
									</div>
									<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
										{status === "completed"
											? "Done"
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

			{/* Mobile phase indicator */}
			<div className="mt-4 md:hidden text-center">
				<p className="text-sm text-gray-600 dark:text-gray-400">
					Current Phase:{" "}
					<span className="font-semibold text-gray-900 dark:text-gray-100">
						{getPhaseDisplay(currentPhase)}
					</span>
				</p>
			</div>
		</div>
	);
};
