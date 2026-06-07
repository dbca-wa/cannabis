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
}: SectionCardProps) => {
	return (
		<Card
			className={cn(
				"relative transition-colors",
				isInvalid &&
					"bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-700",
				!isInvalid && isComplete && "bg-emerald-50/50 dark:bg-emerald-950/20"
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

				{isComplete && !isInvalid && (
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
