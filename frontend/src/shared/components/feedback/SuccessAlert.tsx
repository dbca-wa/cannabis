import type { ReactNode } from "react";
import { CheckCircle, X } from "lucide-react";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils";

interface SuccessAlertProps {
	title?: string;
	message: string;
	onDismiss?: () => void;
	className?: string;
	children?: ReactNode;
	actions?: Array<{
		label: string;
		onClick: () => void;
		variant?: "default" | "outline" | "secondary";
	}>;
}

export function SuccessAlert({
	title = "Success",
	message,
	onDismiss,
	className,
	children,
	actions = [],
}: SuccessAlertProps) {
	return (
		<Alert
			variant="default"
			className={cn(
				"border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
				className
			)}
		>
			<CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
			<div className="flex-1">
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<AlertTitle className="text-green-800 dark:text-green-200">
							{title}
						</AlertTitle>
						<AlertDescription className="mt-2 text-green-700 dark:text-green-300">
							{message}
						</AlertDescription>

						{/* Custom children content */}
						{children && <div className="mt-3">{children}</div>}

						{/* Action buttons */}
						{actions.length > 0 && (
							<div className="flex gap-2 mt-3">
								{actions.map((action, index) => (
									<Button
										key={index}
										variant={action.variant || "outline"}
										size="sm"
										onClick={action.onClick}
										className="h-8"
									>
										{action.label}
									</Button>
								))}
							</div>
						)}
					</div>

					{/* Dismiss button */}
					{onDismiss && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onDismiss}
							className="h-6 w-6 p-0 ml-2 text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-200"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>
		</Alert>
	);
}
