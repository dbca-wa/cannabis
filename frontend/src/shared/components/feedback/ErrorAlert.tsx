import type { ReactNode } from "react";
import { AlertTriangle, X, RefreshCw } from "lucide-react";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/shared/components/ui/alert";
import { Button } from "@/shared/components/ui/button";
import {
	getErrorMessage,
	getAllErrorMessages,
} from "@/shared/utils/error.utils";

interface ErrorAlertProps {
	error: unknown;
	title?: string;
	showRetry?: boolean;
	onRetry?: () => void;
	onDismiss?: () => void;
	showDetails?: boolean;
	className?: string;
	children?: ReactNode;
}

export function ErrorAlert({
	error,
	title = "Error",
	showRetry = false,
	onRetry,
	onDismiss,
	showDetails = false,
	className,
	children,
}: ErrorAlertProps) {
	const primaryMessage = getErrorMessage(error);
	const allMessages = getAllErrorMessages(error);
	const hasMultipleMessages = allMessages.length > 1;

	return (
		<Alert variant="destructive" className={className}>
			<AlertTriangle className="h-4 w-4" />
			<div className="flex-1">
				<div className="flex items-start justify-between">
					<div className="flex-1">
						<AlertTitle>{title}</AlertTitle>
						<AlertDescription className="mt-2">
							{primaryMessage}

							{/* Show additional messages if available */}
							{hasMultipleMessages && showDetails && (
								<ul className="mt-2 list-disc list-inside space-y-1">
									{allMessages
										.slice(1)
										.map((message, index) => (
											<li key={index} className="text-sm">
												{message}
											</li>
										))}
								</ul>
							)}
						</AlertDescription>

						{/* Custom children content */}
						{children && <div className="mt-3">{children}</div>}

						{/* Action buttons */}
						{(showRetry || onDismiss) && (
							<div className="flex gap-2 mt-3">
								{showRetry && onRetry && (
									<Button
										variant="outline"
										size="sm"
										onClick={onRetry}
										className="h-8"
									>
										<RefreshCw className="mr-2 h-3 w-3" />
										Retry
									</Button>
								)}
							</div>
						)}
					</div>

					{/* Dismiss button */}
					{onDismiss && (
						<Button
							variant="ghost"
							size="sm"
							onClick={onDismiss}
							className="h-6 w-6 p-0 ml-2"
						>
							<X className="h-4 w-4" />
						</Button>
					)}
				</div>
			</div>
		</Alert>
	);
}
