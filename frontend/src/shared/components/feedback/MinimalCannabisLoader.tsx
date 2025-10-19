import { useEffect, useState } from "react";
import CannabisLeaf from "./CannabisLeaf";
import type { LoaderProps } from "@/shared/types";

export const MinimalCannabisLoader = ({
	progress = 0,
	message,
	isComplete,
	onComplete,
}: LoaderProps) => {
	const [animatedProgress, setAnimatedProgress] = useState(0);

	// Smooth progress animation
	useEffect(() => {
		const interval = setInterval(() => {
			setAnimatedProgress((prev) => {
				const diff = progress - prev;
				if (Math.abs(diff) < 1) return progress;
				const speed = Math.abs(diff) > 20 ? 0.3 : 0.15;
				return prev + diff * speed;
			});
		}, 30);
		return () => clearInterval(interval);
	}, [progress]);

	// Handle completion
	useEffect(() => {
		if (isComplete) {
			setAnimatedProgress(100);
			setTimeout(() => onComplete?.(), 800);
		}
	}, [isComplete, onComplete]);

	useEffect(() => {
		if (progress >= 100) setAnimatedProgress(100);
	}, [progress]);

	// Dynamic animation speed - faster as progress increases
	const spinSpeed = Math.max(2, 8 - (animatedProgress / 100) * 6); // 8s to 2s

	return (
		<div className="flex flex-col items-center justify-center p-6">
			<div className="relative">
				{/* Rotating cannabis leaf with dynamic speed */}
				<div
					className="transition-all duration-500"
					style={{
						animation: `spin-slow ${spinSpeed}s linear infinite`,
						filter: `brightness(${
							1 + (animatedProgress / 100) * 0.5
						}) saturate(${1 + (animatedProgress / 100) * 0.5})`,
					}}
				>
					<CannabisLeaf
						size={60}
						className="pulse-glow"
						style={{
							opacity: 0.7 + (animatedProgress / 100) * 0.3, // More opaque as it loads
						}}
					/>
				</div>

				{/* Progress ring around the leaf */}
				<div className="absolute inset-0 flex items-center justify-center">
					<svg
						className="w-20 h-20 transform -rotate-90"
						viewBox="0 0 32 32"
					>
						{/* Background circle */}
						<circle
							cx="16"
							cy="16"
							r="14"
							fill="none"
							stroke="rgb(34 197 94 / 0.2)"
							strokeWidth="2"
						/>
						{/* Progress circle */}
						<circle
							cx="16"
							cy="16"
							r="14"
							fill="none"
							stroke="rgb(34 197 94)"
							strokeWidth="2"
							strokeLinecap="round"
							strokeDasharray="87.96"
							strokeDashoffset={
								87.96 - (animatedProgress / 100) * 87.96
							}
							className="transition-all duration-300 ease-out"
						/>
					</svg>
				</div>
			</div>

			{/* Status text */}
			<div className="text-center mt-4">
				<p className="text-green-400 text-sm animate-pulse">
					{isComplete ? "Ready!" : "Loading..."}
				</p>
				<p className="text-green-500 text-xs mt-1 opacity-75">
					{message}
				</p>
				<p className="text-green-500 text-xs mt-1">
					{animatedProgress.toFixed(0)}%
				</p>
			</div>
		</div>
	);
};

export default MinimalCannabisLoader;
