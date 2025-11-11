import { Loader2 } from "lucide-react";
import { cn } from "@/shared/utils";
import { CannabisLoader } from "./CannabisLoader";
import { MinimalCannabisLoader } from "./MinimalCannabisLoader";
import { CookingCannabisLoader } from "./CookingCannabisLoader";

interface LoadingSpinnerProps {
	size?: "sm" | "md" | "lg";
	className?: string;
	text?: string;
	variant?: "default" | "cannabis" | "minimal" | "cooking";
	progress?: number;
	isComplete?: boolean;
	onComplete?: () => void;
}

const sizeClasses = {
	sm: "h-4 w-4",
	md: "h-6 w-6",
	lg: "h-8 w-8",
};

export function LoadingSpinner({
	size = "md",
	className,
	text,
	variant = "default",
	progress,
	isComplete,
	onComplete,
}: LoadingSpinnerProps) {
	// For themed variants, use the specialized components
	if (variant === "cannabis") {
		return (
			<CannabisLoader
				progress={progress ?? 0}
				message={text ?? "Loading..."}
				isComplete={isComplete ?? false}
				onComplete={onComplete}
			/>
		);
	}

	if (variant === "minimal") {
		return (
			<MinimalCannabisLoader
				progress={progress ?? 0}
				message={text ?? "Loading..."}
				isComplete={isComplete ?? false}
				onComplete={onComplete}
			/>
		);
	}

	if (variant === "cooking") {
		return (
			<CookingCannabisLoader
				progress={progress ?? 0}
				message={text ?? "Loading..."}
				isComplete={isComplete ?? false}
				onComplete={onComplete}
			/>
		);
	}

	// Default spinner variant
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Loader2 className={cn("animate-spin", sizeClasses[size])} />
			{text && (
				<span className="text-sm text-muted-foreground">{text}</span>
			)}
		</div>
	);
}

// Full page loading component
export function PageLoading({
	text = "Loading...",
	variant = "default",
	progress,
	isComplete,
	onComplete,
}: {
	text?: string;
	variant?: "default" | "cannabis" | "minimal" | "cooking";
	progress?: number;
	isComplete?: boolean;
	onComplete?: () => void;
}) {
	return (
		<div className="flex items-center justify-center min-h-[400px]">
			<LoadingSpinner
				size="lg"
				text={text}
				variant={variant}
				progress={progress}
				isComplete={isComplete}
				onComplete={onComplete}
			/>
		</div>
	);
}

// Inline loading component for buttons
export function ButtonLoading({ text }: { text?: string }) {
	return (
		<div className="flex items-center gap-2">
			<Loader2 className="h-4 w-4 animate-spin" />
			{text && <span>{text}</span>}
		</div>
	);
}
