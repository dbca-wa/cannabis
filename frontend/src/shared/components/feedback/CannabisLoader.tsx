import { useEffect, useState } from "react";
import type { LoaderProps } from "@/shared/types";

export const CannabisLoader = ({
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

	// Dynamic animation speed based on progress
	const animationSpeed = Math.max(1, 4 - (animatedProgress / 100) * 2); // 4s to 2s

	return (
		<div className="flex flex-col items-center justify-center">
			{/* Main container with pulsing effect */}
			<div className="relative">
				{/* Outer glow ring - intensity based on progress */}
				<div
					className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400 via-emerald-500 to-green-600 blur-xl animate-pulse scale-150"
					style={{
						opacity: 0.2 + (animatedProgress / 100) * 0.3, // 0.2 to 0.5 opacity
					}}
				></div>

				{/* Main cannabis plant container */}
				<div className="relative w-24 h-24 flex items-center justify-center">
					{/* Rotating outer leaves - speed increases with progress */}
					<div
						className="absolute inset-0 animate-spin"
						style={{
							animationDuration: `${animationSpeed}s`,
							opacity: 0.6 + (animatedProgress / 100) * 0.4, // More visible as it loads
						}}
					>
						{[...Array(8)].map((_, i) => (
							<div
								key={i}
								className="absolute w-8 h-2 bg-gradient-to-r from-green-400 to-green-600 rounded-full"
								style={{
									transform: `rotate(${
										i * 45
									}deg) translateY(-32px)`,
									transformOrigin: "center 32px",
									animationDelay: `${i * 0.1}s`,
									opacity: 0.7,
								}}
							/>
						))}
					</div>

					{/* Counter-rotating inner leaves */}
					<div
						className="absolute inset-0 animate-spin"
						style={{
							animationDuration: `${animationSpeed * 0.75}s`,
							animationDirection: "reverse",
						}}
					>
						{[...Array(6)].map((_, i) => (
							<div
								key={i}
								className="absolute w-6 h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full opacity-80"
								style={{
									transform: `rotate(${
										i * 60
									}deg) translateY(-20px)`,
									transformOrigin: "center 20px",
									animationDelay: `${i * 0.15}s`,
								}}
							/>
						))}
					</div>

					{/* Central stem/core - pulses faster when complete */}
					<div className="relative">
						<div
							className="w-4 h-4 bg-gradient-to-br from-green-500 to-emerald-700 rounded-full shadow-lg"
							style={{
								animation: `pulse ${
									isComplete ? "0.5s" : "2s"
								} ease-in-out infinite`,
							}}
						></div>

						{/* Floating particles - more active as progress increases */}
						<div className="absolute inset-0">
							{[...Array(12)].map((_, i) => (
								<div
									key={i}
									className="absolute w-1 h-1 bg-green-400 rounded-full animate-ping"
									style={{
										left: `${
											Math.cos((i * 30 * Math.PI) / 180) *
												30 +
											6
										}px`,
										top: `${
											Math.sin((i * 30 * Math.PI) / 180) *
												30 +
											6
										}px`,
										animationDelay: `${i * 0.2}s`,
										animationDuration: "2s",
										opacity:
											(animatedProgress / 100) * 0.6 +
											0.2, // More visible with progress
									}}
								/>
							))}
						</div>
					</div>

					{/* Cannabis leaf silhouettes - bounce more energetically when complete */}
					<div
						className="absolute inset-0 animate-pulse"
						style={{ animationDuration: isComplete ? "1s" : "2s" }}
					>
						{/* Leaves with progress-based opacity */}
						{[
							{
								pos: "top-0 left-1/2 transform -translate-x-1/2",
								size: "w-3 h-8",
								delay: "0s",
							},
							{
								pos: "top-2 left-2",
								size: "w-6 h-3",
								delay: "0.3s",
								transform: "rotate-45",
							},
							{
								pos: "top-2 right-2",
								size: "w-6 h-3",
								delay: "0.6s",
								transform: "-rotate-45",
							},
							{
								pos: "bottom-2 left-3",
								size: "w-4 h-2",
								delay: "0.9s",
								transform: "rotate-12",
							},
							{
								pos: "bottom-2 right-3",
								size: "w-4 h-2",
								delay: "1.2s",
								transform: "-rotate-12",
							},
						].map((leaf, i) => (
							<div
								key={i}
								className={`absolute ${leaf.pos} ${
									leaf.size
								} bg-gradient-to-b from-green-400 to-green-600 rounded-full animate-bounce transform ${
									leaf.transform || ""
								}`}
								style={{
									animationDelay: leaf.delay,
									animationDuration: "2s",
									opacity: Math.min(
										0.8,
										0.3 + (animatedProgress / 100) * 0.5
									),
								}}
							></div>
						))}
					</div>
				</div>
			</div>

			{/* Animated text */}
			<div className="mt-14 text-center">
				<div className="flex items-center space-x-1">
					<span className="text-green-700 font-medium">
						{isComplete ? "Complete ✓" : "App initialising"}
					</span>
				</div>
				<div className="text-xs text-green-600 mt-1 opacity-75">
					{message}
				</div>
				<div className="text-xs text-green-500 mt-1">
					{animatedProgress.toFixed(0)}% complete
				</div>
			</div>

			{/* Progress bar */}
			<div className="mt-4 w-48 h-1 bg-green-100 rounded-full overflow-hidden">
				<div
					className="h-full bg-gradient-to-r from-green-400 to-emerald-600 rounded-full transition-all duration-300 ease-out"
					style={{ width: `${animatedProgress}%` }}
				></div>
			</div>
		</div>
	);
};
