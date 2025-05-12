import { cn } from "@/lib/utils";
import React, { useState, useEffect } from "react";

const CannabisLogo = ({
	shouldAnimate = false,
	size = "md",
	logoOnly = false,
}: {
	shouldAnimate: boolean;
	size?: "sm" | "md" | "lg";
	logoOnly?: boolean;
}) => {
	const [isVisible, setIsVisible] = useState(!shouldAnimate);
	const [elementVisible, setElementVisible] = useState(!shouldAnimate);

	useEffect(() => {
		// If animation is enabled, start with invisible text and element then fade them in
		if (shouldAnimate) {
			setIsVisible(false);
			setElementVisible(false);

			// First animate the element square
			const elementTimer = setTimeout(() => {
				setElementVisible(true);
			}, 300);

			// Then animate the text with a slight delay
			const textTimer = setTimeout(() => {
				setIsVisible(true);
			}, 600);

			return () => {
				clearTimeout(elementTimer);
				clearTimeout(textTimer);
			};
		} else {
			setIsVisible(true);
			setElementVisible(true);
		}
	}, [shouldAnimate]);

	return (
		<div className="flex flex-row items-center transition-all duration-1000 select-none">
			{/* Element square with its own animation */}
			<div
				className={cn(
					`relative border-2 border-white bg-cannabis-green-dark p-1 flex items-center justify-center transition-all duration-1000 ${
						elementVisible
							? "opacity-100 blur-none scale-100"
							: "opacity-0 blur-md scale-95"
					}`,
					size === "md"
						? "size-22"
						: size === "sm"
						? "size-14"
						: "size-30"
				)}
			>
				{/* Atomic Mass (tl) */}
				<div
					className="absolute top-0.5 left-0.5 text-gray-300"
					style={{
						fontSize:
							size === "md"
								? "8px"
								: size === "sm"
								? "6px"
								: "12px",
					}}
				>
					12.011
				</div>

				{/* Oxidation states (tr) */}
				<div
					className="absolute top-0.5 right-0.5 text-gray-300 leading-tight"
					style={{
						fontSize:
							size === "md"
								? "8px"
								: size === "sm"
								? "6px"
								: "12px",
					}}
				>
					<div>-4</div>
					<div>+2</div>
					<div>+4</div>
				</div>

				{/* Atomic number and electron configuration (bl) */}
				<div className="absolute bottom-0.5 left-0.5 text-gray-300 flex flex-col">
					<div
						style={{
							fontSize:
								size === "md"
									? "16px"
									: size === "sm"
									? "10px"
									: "20px",
						}}
						className={cn(
							size === "md"
								? "-ml-0.5"
								: size === "sm"
								? "-ml-0"
								: "-ml-1"
						)}
					>
						6
					</div>
					<div
						style={{
							fontSize:
								size === "md"
									? "8px"
									: size === "sm"
									? "6px"
									: "12px",
						}}
						className="ml-0.5"
					>
						2-4
					</div>
				</div>

				{/* Element Symbol */}
				<div
					className={cn(
						"text-6xl font-bold text-white",
						size === "md"
							? "text-6xl"
							: size === "sm"
							? "text-4xl"
							: "text-9xl"
					)}
				>
					C
				</div>
			</div>

			{/* Adjacent text to complete "Cannabis" with animation */}
			{logoOnly ? null : (
				<div
					className={cn(
						`text-white font-bold ml-1 mt-1 transition-all duration-1000 ${
							isVisible
								? "opacity-100 blur-none"
								: "opacity-0 blur-md"
						}`,
						size === "md"
							? "text-4xl"
							: size === "sm"
							? "text-2xl"
							: "text-5xl"
					)}
					style={{
						textShadow:
							"2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
					}}
				>
					annabis
				</div>
			)}
		</div>
	);
};

export default CannabisLogo;
