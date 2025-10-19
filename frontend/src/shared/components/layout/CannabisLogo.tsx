import { cn } from "@/shared/utils/index";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useSidebarItem } from "@/shared/hooks/ui/useSidebarItem";

const CannabisLogo = ({
	shouldAnimate = false,
	size = "md",
	variant = "none",
}: {
	shouldAnimate: boolean;
	size?: "sm" | "md" | "lg";
	variant?:
		| "none"
		| "gentle-leaf-glow"
		| "soft-organic-bloom"
		| "flowing-leaf-aura"
		| "dreamy-cloud-aura"
		| "subtle-leaf-embrace"
		| "organic-whisper";
}) => {
	const [elementVisible, setElementVisible] = useState(!shouldAnimate);
	const navigate = useNavigate();
	const { isActiveSidebarItem } = useSidebarItem();

	const isHomeActive = isActiveSidebarItem("Home");

	useEffect(() => {
		if (shouldAnimate) {
			setElementVisible(false);
			const elementTimer = setTimeout(() => {
				setElementVisible(true);
			}, 300);
			return () => clearTimeout(elementTimer);
		} else {
			setElementVisible(true);
		}
	}, [shouldAnimate]);

	// Get SVG size based on component size
	const getSvgSize = () => {
		switch (size) {
			case "sm":
				return { width: 60, height: 60 };
			case "md":
				return { width: 70, height: 70 };
			case "lg":
				return { width: 80, height: 80 };
			default:
				return { width: 60, height: 60 };
		}
	};

	const svgSize = getSvgSize();

	const handleClick = () => {
		// Prevent navigation if already on home
		if (isHomeActive) {
			return;
		}
		navigate("/");
	};

	return (
		<>
			{/* Inline keyframe animations */}
			<style
				dangerouslySetInnerHTML={{
					__html: `
					@keyframes gentle-pulse {
						0%, 100% { opacity: 0.4; transform: scale(1); }
						50% { opacity: 0.7; transform: scale(1.05); }
					}

					@keyframes float {
						0%, 100% { transform: translateY(0px); }
						50% { transform: translateY(-3px); }
					}

					@keyframes ease-back {
						0% { transform: translateY(-3px); }
						100% { transform: translateY(0px); }
					}
					
					@keyframes flowing-energy {
						0% { opacity: 0.5; transform: scale(1) rotate(0deg); }
						33% { opacity: 0.7; transform: scale(1.08) rotate(1deg); }
						66% { opacity: 0.8; transform: scale(1.12) rotate(-1deg); }
						100% { opacity: 0.5; transform: scale(1) rotate(0deg); }
					}

					.cannabis-aura-container {
						position: relative;
						z-index: 10;
						display: flex;
						align-items: center;
						justify-content: center;
						cursor: pointer;
					}

					/* Cannabis Logo should float when Home is active (like sidebar buttons) */
					.cannabis-logo-active {
						animation: float 2s ease-in-out infinite !important;
					}

					/* Cannabis Logo should float on hover */
					.cannabis-aura-container:hover {
						animation: float 2s ease-in-out infinite;
					}

					/* Smooth return when not hovering (unless active) */
					.cannabis-aura-container:not(:hover):not(.cannabis-logo-active) {
						animation: ease-back 0.6s ease-out forwards;
					}

					/* Prevent jumping during click */
					.cannabis-aura-container:active {
						animation: none !important;
						transform: none !important;
					}

					/* Dark theme cannabis aura */
					.dark .cannabis-aura {
						content: '';
						position: absolute;
						width: 60px;
						height: 60px;
						background: radial-gradient(circle, rgba(255,200,0,0.5), rgba(200,255,0,0.4), rgba(0,255,200,0.4), rgba(0,200,255,0.4), rgba(200,0,255,0.3), rgba(255,0,200,0.3), transparent);
						border-radius: 35% 65% 55% 45% / 25% 55% 45% 75%;
						filter: blur(8px);
						pointer-events: none;
						z-index: 0;
						opacity: 0;
						transition: opacity 0.3s ease;
					}

					/* Light theme cannabis aura */
					.light .cannabis-aura {
						content: '';
						position: absolute;
						width: 60px;
						height: 60px;
						background: radial-gradient(circle, rgba(67,56,202,0.4), rgba(99,102,241,0.3), rgba(139,92,246,0.3), rgba(168,85,247,0.3), rgba(192,132,252,0.2), rgba(217,70,239,0.2), transparent);
						border-radius: 35% 65% 55% 45% / 25% 55% 45% 75%;
						filter: blur(8px);
						pointer-events: none;
						z-index: 0;
						opacity: 0;
						transition: opacity 0.3s ease;
					}

					/* Default light theme */
					.cannabis-aura {
						content: '';
						position: absolute;
						width: 60px;
						height: 60px;
						background: radial-gradient(circle, rgba(67,56,202,0.4), rgba(99,102,241,0.3), rgba(139,92,246,0.3), rgba(168,85,247,0.3), rgba(192,132,252,0.2), rgba(217,70,239,0.2), transparent);
						border-radius: 35% 65% 55% 45% / 25% 55% 45% 75%;
						filter: blur(8px);
						pointer-events: none;
						z-index: 0;
						opacity: 0;
						transition: opacity 0.3s ease;
					}

					.cannabis-aura-active {
						opacity: 1;
						animation: gentle-pulse 2.5s ease-in-out infinite;
					}

					.cannabis-aura-container:hover .cannabis-aura {
						opacity: 0.6;
					}

					.aura-container {
						position: relative;
						z-index: 10;
					}

					.aura-container::before {
						content: '';
						position: absolute;
						opacity: 0;
						transition: opacity 0.3s ease;
						z-index: -1;
						pointer-events: none;
					}

					.aura-whisper::before {
						top: -8px;
						left: -8px;
						right: -8px;
						bottom: -8px;
						background: radial-gradient(ellipse 55% 70% at center, rgba(255,255,200,0.6), rgba(200,255,255,0.5), rgba(255,200,255,0.4), rgba(200,200,255,0.3), rgba(255,200,200,0.2), transparent);
						border-radius: 30% 70% 60% 40% / 20% 60% 40% 80%;
						filter: blur(8px);
					}

					.aura-whisper:hover::before {
						opacity: 1;
						animation: gentle-pulse 3.8s ease-in-out infinite;
					}

					.aura-gentle::before {
						top: -10px;
						left: -10px;
						right: -10px;
						bottom: -10px;
						background: radial-gradient(ellipse 70% 85% at center, rgba(255,0,0,0.4), rgba(255,128,0,0.4), rgba(255,255,0,0.4), rgba(128,255,0,0.4), rgba(0,255,0,0.4), rgba(0,255,128,0.4), rgba(0,255,255,0.4), rgba(0,128,255,0.4), rgba(0,0,255,0.4), rgba(128,0,255,0.4), rgba(255,0,255,0.4), transparent);
						border-radius: 45% 55% 60% 40% / 35% 45% 55% 65%;
						filter: blur(8px);
					}

					.aura-gentle:hover::before {
						opacity: 1;
						animation: gentle-pulse 3s ease-in-out infinite;
					}

					.aura-bloom::before {
						top: -12px;
						left: -12px;
						right: -12px;
						bottom: -12px;
						background: radial-gradient(ellipse 75% 90% at center, rgba(255,0,128,0.4), rgba(255,128,0,0.4), rgba(255,255,0,0.5), rgba(128,255,0,0.5), rgba(0,255,128,0.4), rgba(0,255,255,0.4), rgba(128,0,255,0.3), rgba(255,0,255,0.3), transparent);
						border-radius: 50% 40% 65% 35% / 40% 60% 40% 60%;
						filter: blur(8px);
					}

					.aura-bloom:hover::before {
						opacity: 1;
						animation: gentle-pulse 3.5s ease-in-out infinite;
					}

					.aura-flowing::before {
						top: -10px;
						left: -10px;
						right: -10px;
						bottom: -10px;
						background: radial-gradient(ellipse 65% 80% at center, rgba(255,255,0,0.5), rgba(128,255,0,0.4), rgba(0,255,0,0.4), rgba(0,255,128,0.4), rgba(0,255,255,0.4), rgba(0,128,255,0.3), rgba(128,0,255,0.3), transparent);
						border-radius: 40% 60% 50% 50% / 30% 50% 70% 50%;
						filter: blur(8px);
					}

					.aura-flowing:hover::before {
						opacity: 1;
						animation: flowing-energy 4s ease-in-out infinite;
					}

					.aura-cloud::before {
						top: -12px;
						left: -12px;
						right: -12px;
						bottom: -12px;
						background: radial-gradient(ellipse 80% 95% at center, rgba(255,128,255,0.3), rgba(128,255,255,0.4), rgba(255,255,128,0.5), rgba(128,255,128,0.4), rgba(255,128,128,0.3), rgba(128,128,255,0.3), transparent);
						border-radius: 60% 40% 40% 60% / 50% 30% 70% 50%;
						filter: blur(8px);
					}

					.aura-cloud:hover::before {
						opacity: 1;
						animation: gentle-pulse 4s ease-in-out infinite;
					}

					.aura-embrace::before {
						top: -9px;
						left: -9px;
						right: -9px;
						bottom: -9px;
						background: radial-gradient(ellipse 60% 75% at center, rgba(255,200,0,0.5), rgba(200,255,0,0.4), rgba(0,255,200,0.4), rgba(0,200,255,0.4), rgba(200,0,255,0.3), rgba(255,0,200,0.3), transparent);
						border-radius: 35% 65% 55% 45% / 25% 55% 45% 75%;
						filter: blur(8px);
					}

					.aura-embrace:hover::before {
						opacity: 1;
						animation: gentle-pulse 2.5s ease-in-out infinite;
					}
				`,
				}}
			/>

			<div className="flex items-center justify-center px-4">
				{/* Cannabis leaf with navigation and aura */}
				<div
					onClick={handleClick}
					className={cn(
						"cannabis-aura-container relative flex items-center justify-center transition-all duration-300",
						elementVisible
							? "opacity-100 blur-none scale-100"
							: "opacity-0 blur-md scale-95",
						// Add float animation when Home is active
						isHomeActive && "cannabis-logo-active",
						variant === "gentle-leaf-glow" && "aura-gentle",
						variant === "soft-organic-bloom" && "aura-bloom",
						variant === "flowing-leaf-aura" && "aura-flowing",
						variant === "dreamy-cloud-aura" && "aura-cloud",
						variant === "subtle-leaf-embrace" && "aura-embrace",
						variant === "organic-whisper" && "aura-whisper"
					)}
				>
					{/* Cannabis Logo Aura - always present, controlled by active state */}
					<div
						className={cn(
							"cannabis-aura absolute inset-0 m-auto",
							isHomeActive && "cannabis-aura-active"
						)}
					/>

					<svg
						width={svgSize.width}
						height={svgSize.height}
						viewBox="0 0 100 100"
						className="relative z-10 transition-all duration-300 hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
					>
						<defs>
							<linearGradient
								id="leafGradient"
								x1="0%"
								y1="0%"
								x2="100%"
								y2="100%"
							>
								<stop offset="0%" stopColor="#22c55e" />
								<stop offset="50%" stopColor="#16a34a" />
								<stop offset="100%" stopColor="#15803d" />
							</linearGradient>
						</defs>
						<g transform="translate(50,50)">
							{/* Main center leaf */}
							<path
								d="M0,-35 Q-3,-25 -2,-10 Q-1,0 0,5 Q1,0 2,-10 Q3,-25 0,-35 Z"
								fill="url(#leafGradient)"
							/>

							{/* Left side leaves */}
							<path
								d="M-8,-30 Q-12,-22 -10,-8 Q-8,0 -6,3 Q-4,-2 -5,-12 Q-6,-22 -8,-30 Z"
								fill="url(#leafGradient)"
								transform="rotate(-15)"
							/>
							<path
								d="M-15,-25 Q-18,-18 -16,-6 Q-14,0 -12,2 Q-10,-3 -11,-10 Q-13,-18 -15,-25 Z"
								fill="url(#leafGradient)"
								transform="rotate(-30)"
							/>
							<path
								d="M-20,-18 Q-22,-12 -20,-4 Q-18,0 -16,1 Q-14,-2 -15,-6 Q-17,-12 -20,-18 Z"
								fill="url(#leafGradient)"
								transform="rotate(-50)"
							/>

							{/* Right side leaves */}
							<path
								d="M8,-30 Q12,-22 10,-8 Q8,0 6,3 Q4,-2 5,-12 Q6,-22 8,-30 Z"
								fill="url(#leafGradient)"
								transform="rotate(15)"
							/>
							<path
								d="M15,-25 Q18,-18 16,-6 Q14,0 12,2 Q10,-3 11,-10 Q13,-18 15,-25 Z"
								fill="url(#leafGradient)"
								transform="rotate(30)"
							/>
							<path
								d="M20,-18 Q22,-12 20,-4 Q18,0 16,1 Q14,-2 15,-6 Q17,-12 20,-18 Z"
								fill="url(#leafGradient)"
								transform="rotate(50)"
							/>
						</g>
					</svg>
				</div>
			</div>
		</>
	);
};

export default CannabisLogo;
