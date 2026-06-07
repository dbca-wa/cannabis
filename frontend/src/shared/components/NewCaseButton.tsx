import { Link } from "react-router";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { cn } from "@/shared/utils/index";

import type { LucideIcon } from "lucide-react";

interface PoliceButtonProps {
	to: string;
	label: string;
	icon?: LucideIcon;
	size?: "default" | "lg";
	siren?: boolean;
	className?: string;
}

/**
 * Animated button with police siren-style red/blue auras on hover.
 * Used for primary CTA actions across the app (New Case, Add Officer, etc.)
 * Set siren={false} for non-police routes to get the same look without hover effects.
 */
export const PoliceButton = ({
	to,
	label,
	icon: Icon = Plus,
	size = "default",
	siren = true,
	className,
}: PoliceButtonProps) => {
	const isLg = size === "lg";

	return (
		<Link to={to} className={cn("relative inline-flex group", className)}>
			{/* Twin emergency-light auras behind the button — only when siren is enabled */}
			{siren && (
				<motion.span
					aria-hidden
					className="pointer-events-none absolute -inset-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
				>
					<motion.span
						className="absolute left-[-10%] top-1/2 -translate-y-1/2 w-[70%] h-[180%] rounded-full blur-2xl"
						style={{
							background:
								"radial-gradient(closest-side, rgba(239,68,68,0.9), rgba(239,68,68,0) 70%)",
						}}
						animate={{ opacity: [0.12, 1, 0.12] }}
						transition={{ duration: 0.93, repeat: Infinity, ease: "easeInOut" }}
					/>
					<motion.span
						className="absolute right-[-10%] top-1/2 -translate-y-1/2 w-[70%] h-[180%] rounded-full blur-2xl"
						style={{
							background:
								"radial-gradient(closest-side, rgba(59,130,246,0.9), rgba(59,130,246,0) 70%)",
						}}
						animate={{ opacity: [1, 0.12, 1] }}
						transition={{ duration: 0.93, repeat: Infinity, ease: "easeInOut" }}
					/>
				</motion.span>
			)}

			<motion.span
				whileHover={{ y: -1 }}
				whileTap={{ scale: 0.97 }}
				transition={{ type: "spring", stiffness: 400, damping: 24 }}
				className={cn(
					"relative inline-flex items-center gap-2 rounded-xl text-white shadow-md ring-1 ring-white/10 overflow-hidden",
					"bg-gradient-to-b from-slate-600 to-slate-800 dark:from-slate-800 dark:to-slate-950",
					isLg
						? "px-6 py-3.5 text-base font-semibold"
						: "px-5 py-2.5 text-sm font-semibold"
				)}
			>
				{/* Internal sheen — left red, right blue — cross-pulses on hover */}
				{siren && (
					<motion.span
						aria-hidden
						className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
					>
						<motion.span
							className="absolute inset-0"
							style={{
								background:
									"radial-gradient(120% 180% at 0% 50%, rgba(239,68,68,0.55), rgba(239,68,68,0) 55%)",
							}}
							animate={{ opacity: [0.15, 0.9, 0.15] }}
							transition={{
								duration: 0.93,
								repeat: Infinity,
								ease: "easeInOut",
							}}
						/>
						<motion.span
							className="absolute inset-0"
							style={{
								background:
									"radial-gradient(120% 180% at 100% 50%, rgba(59,130,246,0.55), rgba(59,130,246,0) 55%)",
							}}
							animate={{ opacity: [0.9, 0.15, 0.9] }}
							transition={{
								duration: 0.93,
								repeat: Infinity,
								ease: "easeInOut",
							}}
						/>
						<span className="absolute inset-x-0 top-0 h-px bg-white/15" />
					</motion.span>
				)}

				<Icon
					className={cn(
						"relative",
						isLg ? "w-5 h-5 -ml-0.5" : "w-4 h-4 -ml-0.5"
					)}
				/>
				<span className="tracking-tight whitespace-nowrap relative">
					{label}
				</span>
			</motion.span>
		</Link>
	);
};

/** Shorthand for "New Case" button specifically */
export const NewCaseButton = ({
	size = "default",
	className,
}: {
	size?: "default" | "lg";
	className?: string;
}) => (
	<PoliceButton
		to="/cases/add"
		label="New Case"
		size={size}
		className={className}
	/>
);
