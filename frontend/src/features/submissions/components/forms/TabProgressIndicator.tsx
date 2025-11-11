import React, { useEffect, useState } from "react";

interface TabProgressIndicatorProps {
	progress: number; // 0-100
	className?: string;
}

export const TabProgressIndicator: React.FC<TabProgressIndicatorProps> = ({
	progress,
	className = "",
}) => {
	const [isComplete, setIsComplete] = useState(false);
	const [wasComplete, setWasComplete] = useState(false);

	// Track completion state changes
	useEffect(() => {
		const newIsComplete = progress === 100;
		setWasComplete(isComplete);
		setIsComplete(newIsComplete);
	}, [progress]);

	// Calculate SVG circle properties
	const radius = 8;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (progress / 100) * circumference;

	return (
		<div className={`relative inline-block ${className}`}>
			{/* Donut Progress Circle */}
			<svg
				className="transition-all duration-600 ease-in-out"
				width="20"
				height="20"
				viewBox="0 0 20 20"
				style={{ transform: "rotate(-90deg)" }}
			>
				{/* Background circle */}
				<circle
					cx="10"
					cy="10"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					className="text-gray-300 dark:text-gray-600"
				/>

				{/* Progress circle */}
				<circle
					cx="10"
					cy="10"
					r={radius}
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					className={`transition-all duration-800 ease-in-out ${
						isComplete
							? "text-green-500 dark:text-green-400"
							: "text-yellow-500 dark:text-yellow-400"
					}`}
					style={{
						strokeDasharray: circumference,
						strokeDashoffset: offset,
					}}
				/>
			</svg>

			{/* Checkmark (shown at 100%) */}
			<svg
				className={`absolute top-1/2 left-1/2 transition-all duration-400 ${
					isComplete ? "scale-100 opacity-100" : "scale-0 opacity-0"
				}`}
				style={{
					transform: `translate(-50%, -50%) ${
						isComplete ? "scale(1)" : "scale(0)"
					}`,
					transitionTimingFunction:
						"cubic-bezier(0.175, 0.885, 0.32, 1.275)",
				}}
				width="12"
				height="12"
				viewBox="0 0 12 12"
			>
				<path
					d="M2 6 L5 9 L10 3"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className="text-green-500 dark:text-green-400"
					style={{
						strokeDasharray: 15,
						strokeDashoffset: isComplete && !wasComplete ? 15 : 0,
						animation:
							isComplete && !wasComplete
								? "checkmark-draw 0.6s ease-out 0.2s forwards"
								: "none",
					}}
				/>
			</svg>

			<style>{`
				@keyframes checkmark-draw {
					to {
						stroke-dashoffset: 0;
					}
				}
			`}</style>
		</div>
	);
};
