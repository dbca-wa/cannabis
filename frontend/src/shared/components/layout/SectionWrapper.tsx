import { cn } from "@/shared/utils";
import * as React from "react";

export type SectionWrapperVariant =
	| "default"
	| "minimal"
	| "dark"
	| "card"
	| "sunset"
	| "ocean";

interface SectionWrapperProps {
	children: React.ReactNode;
	title?: string;
	icon?: React.ReactNode;
	variant?: SectionWrapperVariant;
	className?: string;
}

// Variant styles configuration
const sectionVariants = {
	default: {
		container:
			"bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 rounded-xl p-6 shadow-lg border border-gray-200",
		title: "text-xl font-bold text-green-800 flex items-center",
	},
	minimal: {
		container: "bg-white rounded-lg p-6 shadow-md border border-gray-100",
		title: "text-xl font-semibold text-gray-800 flex items-center",
	},
	dark: {
		container:
			"bg-gradient-to-br from-gray-900 via-gray-800 to-green-900 rounded-xl p-6 shadow-xl border border-gray-700",
		title: "text-xl font-bold text-green-400 flex items-center",
	},
	card: {
		container:
			"bg-white rounded-2xl p-6 shadow-xl border-l-4 border-green-500",
		title: "text-xl font-bold text-gray-800 flex items-center",
	},
	sunset: {
		container:
			"bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 rounded-xl p-6 shadow-lg border border-orange-200",
		title: "text-xl font-bold text-orange-800 flex items-center",
	},
	ocean: {
		container:
			"bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 rounded-xl p-6 shadow-lg border border-cyan-200",
		title: "text-xl font-bold text-cyan-800 flex items-center",
	},
};

const SectionWrapper = ({
	children,
	icon,
	title,
	variant = "default",
	className,
}: SectionWrapperProps) => {
	const styles = sectionVariants[variant];

	return (
		<div
			className={cn(
				styles.container,
				"overflow-hidden",
				"min-w-0", // Allows flex items to shrink below their minimum content size
				className
			)}
		>
			{title && (
				<div className="flex items-center justify-between mb-6 overflow-hidden min-w-0">
					<h3
						className={cn(
							styles.title,
							"truncate min-w-0 flex-1" // Prevents title from overflowing
						)}
					>
						{icon && (
							<span className="mr-2 flex-shrink-0">{icon}</span>
						)}
						<span className="truncate">{title}</span>
					</h3>
				</div>
			)}
			<div className="overflow-hidden min-w-0">{children}</div>
		</div>
	);
};

export default SectionWrapper;
