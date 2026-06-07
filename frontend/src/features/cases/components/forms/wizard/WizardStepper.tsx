import { Check, AlertTriangle } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";

export type StepState = "active" | "completed" | "invalid" | "future";

interface WizardStepperProps {
	currentStep: number;
	stepStates: StepState[];
	onStepClick: (stepIndex: number) => void;
}

const STEPS = ["Case Details", "Officers", "Assessment"] as const;

/**
 * Visual progress indicator for the case creation wizard.
 *
 * Horizontal layout on desktop (≥768px), vertical on mobile (<768px).
 * Each step renders in one of four visual states:
 *  - active: blue background with pulse animation ring
 *  - completed: emerald background with white Check icon
 *  - invalid: red background with AlertTriangle icon
 *  - future: gray background with reduced opacity
 *
 * Navigation constraint: clicking past an invalid step is blocked.
 */
export const WizardStepper = ({
	currentStep,
	stepStates,
	onStepClick,
}: WizardStepperProps) => {
	/**
	 * Determine whether a step can be navigated to.
	 * Blocked if any prior step is invalid, or if the step is the current one.
	 */
	const isStepClickable = (index: number): boolean => {
		if (index === currentStep) return false;

		// Cannot click past an invalid step
		for (let i = 0; i < index; i++) {
			if (stepStates[i] === "invalid") return false;
		}

		// Future steps that haven't been reached yet are not clickable
		if (stepStates[index] === "future") return false;

		return true;
	};

	const handleStepClick = (index: number) => {
		if (isStepClickable(index)) {
			onStepClick(index);
		}
	};

	return (
		<nav aria-label="Wizard progress" className="w-full">
			{/* Desktop: Horizontal layout */}
			<div
				className="hidden md:grid w-full items-start"
				style={{ gridTemplateColumns: `repeat(${STEPS.length}, 1fr)` }}
			>
				{STEPS.map((label, index) => {
					const state = stepStates[index] ?? "future";
					const clickable = isStepClickable(index);
					const isFirst = index === 0;
					const isLast = index === STEPS.length - 1;

					// Alignment: first left-aligned, last right-aligned, middle centred
					const stepAlignment = isFirst
						? "items-start"
						: isLast
							? "items-end"
							: "items-center";

					// Connector line positioning relative to the grid cell
					const connectorLeft = isFirst
						? "calc(0% + 40px)"
						: "calc(50% + 20px)";
					const isSecondToLast = index === STEPS.length - 2;
					const connectorRight = isSecondToLast
						? "calc(-100% + 40px)"
						: "calc(-50% + 20px)";

					// Text alignment matching step position
					const textAlignment = isFirst
						? "text-left"
						: isLast
							? "text-right"
							: "text-center";

					// Connector is emerald if this step is completed
					const connectorCompleted = state === "completed";

					return (
						<div
							key={label}
							className={cn("relative flex flex-col", stepAlignment)}
						>
							{/* Connector line between steps */}
							{!isLast && (
								<div
									className={cn(
										"absolute h-0.5 transition-colors duration-300",
										connectorCompleted ? "bg-emerald-500" : "bg-gray-300"
									)}
									style={{
										top: "20px",
										left: connectorLeft,
										right: connectorRight,
									}}
									aria-hidden="true"
								/>
							)}

							{/* Step circle button — min 44x44 touch target via padding */}
							<button
								type="button"
								onClick={() => handleStepClick(index)}
								disabled={!clickable}
								className={cn(
									"relative z-10 flex-shrink-0 p-0.5",
									"focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-full",
									clickable && "cursor-pointer",
									state === "future" && "cursor-not-allowed opacity-50",
									!clickable && state !== "future" && "cursor-default"
								)}
								aria-label={`${clickable ? "Go to " : ""}Step ${index + 1}: ${label}`}
							>
								{/* White background to mask the connector line */}
								<div className="absolute inset-0 w-12 h-12 bg-white dark:bg-gray-900 rounded-full z-0 -m-1" />

								<div
									className={cn(
										"relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-4 font-semibold shadow-lg",
										state !== "active" &&
											"transition-[border-color,background-color,color,box-shadow] duration-300",
										state === "active" &&
											"border-blue-500 bg-blue-500 text-white step-pulse",
										state === "completed" &&
											"border-emerald-500 bg-emerald-500 text-white",
										state === "invalid" &&
											"border-red-500 bg-red-500 text-white",
										state === "future" &&
											"border-gray-300 bg-white text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500",
										clickable && "hover:scale-110 hover:shadow-xl"
									)}
									aria-current={state === "active" ? "step" : undefined}
								>
									{state === "invalid" ? (
										<AlertTriangle className="h-5 w-5 animate-in zoom-in-50 duration-300" />
									) : state === "completed" ? (
										<Check className="h-6 w-6 animate-in zoom-in-50 duration-300" />
									) : (
										<span className="text-sm font-bold">{index + 1}</span>
									)}
								</div>
							</button>

							{/* Label */}
							<div className={cn("mt-2", textAlignment)}>
								<div
									className={cn(
										"text-sm font-semibold transition-colors duration-300 whitespace-nowrap",
										state === "active" && "text-blue-600 dark:text-blue-400",
										state === "invalid" && "text-red-600 dark:text-red-400",
										state === "completed" &&
											"text-emerald-600 dark:text-emerald-400",
										state === "future" && "text-gray-400 dark:text-gray-500"
									)}
								>
									{label}
								</div>
							</div>
						</div>
					);
				})}
			</div>

			{/* Mobile: Vertical layout */}
			<div className="md:hidden">
				<div className="flex flex-col gap-4">
					{STEPS.map((label, index) => {
						const state = stepStates[index] ?? "future";
						const clickable = isStepClickable(index);

						return (
							<div key={label} className="flex items-start">
								{/* Step indicator column */}
								<div className="flex flex-col items-center mr-4">
									{/* 44x44 touch target via explicit sizing */}
									<button
										type="button"
										onClick={() => handleStepClick(index)}
										disabled={!clickable}
										className={cn(
											"relative flex items-center justify-center w-11 h-11",
											"focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded-full",
											clickable && "cursor-pointer",
											state === "future" && "cursor-not-allowed",
											!clickable && state !== "future" && "cursor-default"
										)}
										aria-label={`${clickable ? "Go to " : ""}Step ${index + 1}: ${label}`}
									>
										<div
											className={cn(
												"flex h-9 w-9 items-center justify-center rounded-full border-4 font-semibold shadow-lg",
												state !== "active" &&
													"transition-[border-color,background-color,color,box-shadow] duration-300",
												state === "active" &&
													"border-blue-500 bg-blue-500 text-white step-pulse",
												state === "completed" &&
													"border-emerald-500 bg-emerald-500 text-white",
												state === "invalid" &&
													"border-red-500 bg-red-500 text-white",
												state === "future" &&
													"border-gray-300 bg-white text-gray-400 opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500",
												clickable && "hover:scale-110 hover:shadow-xl"
											)}
											aria-current={state === "active" ? "step" : undefined}
										>
											{state === "invalid" ? (
												<AlertTriangle className="h-3.5 w-3.5 animate-in zoom-in-50 duration-300" />
											) : state === "completed" ? (
												<Check className="h-4 w-4 animate-in zoom-in-50 duration-300" />
											) : (
												<span className="text-xs font-bold">{index + 1}</span>
											)}
										</div>
									</button>

									{/* Vertical connector line */}
									{index < STEPS.length - 1 && (
										<div
											className={cn(
												"w-0.5 h-8 mt-1 transition-colors duration-300",
												state === "completed" ? "bg-emerald-500" : "bg-gray-300"
											)}
											aria-hidden="true"
										/>
									)}
								</div>

								{/* Step label */}
								<div className="flex-1 pt-2.5">
									<div
										className={cn(
											"text-sm font-semibold transition-colors duration-300",
											state === "active" && "text-blue-600 dark:text-blue-400",
											state === "invalid" && "text-red-600 dark:text-red-400",
											state === "completed" &&
												"text-emerald-600 dark:text-emerald-400",
											state === "future" && "text-gray-400 dark:text-gray-500"
										)}
									>
										{label}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Screen-reader live region announcing step changes */}
			<div
				className="sr-only"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep]}
			</div>
		</nav>
	);
};
