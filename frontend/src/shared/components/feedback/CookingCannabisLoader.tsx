import { useEffect, useState } from "react";
import CannabisLeaf from "./CannabisLeaf";
import type { LoaderProps } from "@/shared/types";

export const CookingCannabisLoader = ({
	progress = 0,
	message,
	isComplete,
	onComplete,
}: LoaderProps) => {
	const [animatedProgress, setAnimatedProgress] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setAnimatedProgress((prev) => {
				const diff = progress - prev;

				// If we're close, just snap to the target
				if (Math.abs(diff) < 1) {
					return progress;
				}

				const speed = Math.abs(diff) > 20 ? 0.3 : 0.15; // Faster catch up for big jumps
				return prev + diff * speed;
			});
		}, 30); // Faster update frequency

		return () => clearInterval(interval);
	}, [progress]);

	// Handle completion immediately when isComplete is true
	useEffect(() => {
		if (isComplete) {
			// Snap progress to 100% immediately when complete
			setAnimatedProgress(100);
			setTimeout(() => onComplete?.(), 800); // Shorter delay
		}
	}, [isComplete, onComplete]);

	// Also snap to 100% if progress reaches 100 (backup)
	useEffect(() => {
		if (progress >= 100) {
			setAnimatedProgress(100);
		}
	}, [progress]);

	// Generate fun messages based on progress (UI concern)
	const getFunMessage = (prog: number) => {
		if (prog < 20) return "Lighting up...";
		if (prog < 40) return "Feeling the vibes...";
		if (prog < 60) return "Getting warmed up...";
		if (prog < 80) return "Almost there, dude...";
		if (prog < 95) return "Whoa... so close...";
		return "Totally baked! 🍪";
	};

	return (
		<div className="flex flex-col items-center justify-center p-8">
			{/* Cannabis Animation */}
			<div className="relative w-48 h-48 mb-6">
				{/* Main wobbling leaf */}
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
					<div className="wobble rainbow-glow">
						<CannabisLeaf size={100} />
					</div>
				</div>

				{/* Orbiting smaller leaves - speed up when close to completion */}
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32">
					<div
						className="w-full h-full relative"
						style={{
							animation: `spin-slow ${Math.max(
								1.5,
								8 - (animatedProgress / 100) * 6
							)}s linear infinite`,
						}}
					>
						<div className="absolute -top-4 left-1/2 transform -translate-x-1/2 dizzy-spin">
							<CannabisLeaf size={30} />
						</div>
						<div
							className="absolute top-1/2 -right-4 transform -translate-y-1/2 dizzy-spin"
							style={{ animationDelay: "1s" }}
						>
							<CannabisLeaf size={25} />
						</div>
						<div
							className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 dizzy-spin"
							style={{ animationDelay: "2s" }}
						>
							<CannabisLeaf size={35} />
						</div>
						<div
							className="absolute top-1/2 -left-4 transform -translate-y-1/2 dizzy-spin"
							style={{ animationDelay: "3s" }}
						>
							<CannabisLeaf size={28} />
						</div>
					</div>
				</div>

				{/* Floating emojis - more active when loading */}
				<div
					className="absolute top-4 left-8 text-2xl float-animation"
					style={{
						animationDelay: "0.5s",
						opacity: animatedProgress < 90 ? 1 : 0.3,
					}}
				>
					😵‍💫
				</div>
				<div
					className="absolute top-8 right-12 text-xl float-animation"
					style={{
						animationDelay: "1s",
						opacity: animatedProgress > 25 ? 1 : 0.3,
					}}
				>
					🌈
				</div>
				<div
					className="absolute bottom-8 left-12 text-2xl float-animation"
					style={{
						animationDelay: "1.5s",
						opacity: animatedProgress > 50 ? 1 : 0.3,
					}}
				>
					✨
				</div>
				<div
					className="absolute bottom-4 right-8 text-xl float-animation"
					style={{
						animationDelay: "2s",
						opacity: animatedProgress > 75 ? 1 : 0.3,
					}}
				>
					🔥
				</div>
			</div>

			{/* Rainbow Progress Bar */}
			<div className="w-64 h-3 bg-gray-700 rounded-full overflow-hidden mb-2 shadow-inner">
				<div
					className="h-full bg-gradient-to-r from-purple-500 via-pink-500 via-red-500 via-yellow-500 via-green-500 to-blue-500 rounded-full slow-rainbow-pulse"
					style={{ width: `${animatedProgress}%` }}
				/>
			</div>

			{/* Loading Text */}
			<div className="text-center">
				<h3 className="py-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 text-2xl font-bold mb-1 wobble">
					{isComplete ? "🎉 Totally Baked! 🎉" : "🍃 Cooking... 🍃"}
				</h3>

				{/* Business message from context */}
				<p className="text-gray-400 text-sm rainbow-glow mb-2">
					{message}
				</p>

				{/* Progress percentage */}
				<p className="text-gray-400 text-sm mb-2">
					{animatedProgress.toFixed(0)}% complete
				</p>

				{/* Fun UI message */}
				<p className="text-xs text-purple-300 animate-pulse">
					{getFunMessage(animatedProgress)}
				</p>
			</div>
		</div>
	);
};

export default CookingCannabisLoader;
