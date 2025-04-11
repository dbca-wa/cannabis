import React, { useState, useEffect } from "react";

const CannabisLogo = ({
	shouldAnimate = false,
}: {
	shouldAnimate: boolean;
}) => {
	const [isVisible, setIsVisible] = useState(!shouldAnimate);

	useEffect(() => {
		// If animation is enabled, start with invisible text then fade it in
		if (shouldAnimate) {
			setIsVisible(false);
			const timer = setTimeout(() => {
				setIsVisible(true);
			}, 300); // Small delay before starting animation

			return () => clearTimeout(timer);
		} else {
			setIsVisible(true);
		}
	}, [shouldAnimate]);

	return (
		<div
			className={`flex flex-row items-center transition-all duration-1000`}
		>
			{/* Element square */}
			<div className="relative border-2 border-white bg-cannabis-green-dark p-1 size-22 flex items-center justify-center">
				{/* Atomic Mass (tl) */}
				<div
					className="absolute top-0.5 left-0.5 text-gray-300"
					style={{ fontSize: "8px" }}
				>
					12.011
				</div>

				{/* Oxidation states (tr) */}
				<div
					className="absolute top-0.5 right-0.5 text-gray-300 leading-tight"
					style={{ fontSize: "8px" }}
				>
					<div>-4</div>
					<div>+2</div>
					<div>+4</div>
				</div>

				{/* Atomic number and electron configuration (bl) */}
				<div className="absolute bottom-0.5 left-0.5 text-gray-300 flex flex-col">
					<div style={{ fontSize: "16px" }} className="-ml-0.5">
						6
					</div>
					<div style={{ fontSize: "8px" }} className="ml-0.5">
						2-4
					</div>
				</div>

				{/* Element Symbol */}
				<div className="text-6xl font-bold text-white">C</div>
			</div>

			{/* Adjacent text to complete "Cannabis" with animation */}
			<div
				className={`text-4xl text-white font-bold ml-1 mt-1 transition-all duration-1000 ${
					isVisible ? "opacity-100 blur-none" : "opacity-0 blur-md"
				}`}
				style={{
					textShadow:
						"2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000",
				}}
			>
				annabis
			</div>
		</div>
	);
};

export default CannabisLogo;
