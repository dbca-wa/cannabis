import { Check, X } from "lucide-react";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { cn } from "@/shared/utils";

interface SectionCardProps {
	title: string;
	children: React.ReactNode;
	isComplete: boolean;
	isInvalid?: boolean;
	completionLabel?: string;
	/**
	 * Marks the section as not required for the form to be complete. An empty
	 * optional section shows an "Optional" badge instead of reading as unfinished
	 * work, so it never contradicts the page-level completion summary.
	 */
	optional?: boolean;
	/** Extra classes for the outer card, e.g. grid column spans. */
	className?: string;
}

/**
 * Groups related form fields within a card container
 * with animated completion/invalid state indicators.
 */
export const SectionCard = ({
	title,
	children,
	isComplete,
	isInvalid = false,
	completionLabel,
	optional = false,
	className,
}: SectionCardProps) => {
	// An optional section that has not been filled in wears a calm blue with a
	// blue tick, so a glance reads "empty here, and that's fine" rather than
	// unfinished or wrong. Once it holds data it switches to the same green as a
	// required complete section — background and tick — so filled always reads
	// green whether the section was optional or not.
	const optionalEmpty = optional && !isComplete && !isInvalid;
	const showGreen = isComplete && !isInvalid;

	return (
		<Card
			className={cn(
				"relative transition-colors",
				isInvalid &&
					"bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-700",
				optionalEmpty &&
					"bg-blue-50/60 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/60",
				showGreen && "bg-emerald-50/50 dark:bg-emerald-950/20",
				className
			)}
		>
			<CardHeader className="relative">
				<CardTitle className="text-base">{title}</CardTitle>

				{isInvalid && (
					<div
						className="absolute top-4 right-4 animate-in zoom-in-50 fade-in duration-300 flex items-center justify-center h-6 w-6 rounded-full bg-red-100 dark:bg-red-900/40"
						aria-label={`${title} section has errors`}
					>
						<X className="h-4 w-4 text-red-600 dark:text-red-400" />
					</div>
				)}

				{/* Optional and empty: the tag plus an ever-present blue tick. */}
				{optionalEmpty && (
					<div className="absolute top-4 right-4 flex items-center gap-1.5">
						<span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
							Optional
						</span>
						<span
							className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50"
							aria-label={`${title} section is optional`}
						>
							<Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
						</span>
					</div>
				)}

				{/* Complete (optional or required): green tick. */}
				{showGreen && (
					<div
						className="absolute top-4 right-4 animate-in zoom-in-50 fade-in duration-300 flex items-center justify-center h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40"
						aria-label={completionLabel ?? `${title} section complete`}
					>
						<Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
					</div>
				)}
			</CardHeader>

			<CardContent>{children}</CardContent>
		</Card>
	);
};
