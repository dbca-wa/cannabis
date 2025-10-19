import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils";

interface CommandInputWithLoadingProps
	extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> {
	// Whether to show loading spinner instead of search icon
	isLoading?: boolean;
	// Loading text to show as aria-label when loading
	loadingText?: string;
}

/**
 * CommandInputWithLoading extends the standard CommandInput to show a loading spinner
 * on the right side when searching, providing better UX feedback
 */
const CommandInputWithLoading = React.forwardRef<
	React.ElementRef<typeof CommandPrimitive.Input>,
	CommandInputWithLoadingProps
>(
	(
		{
			className,
			isLoading = false,
			loadingText = "Searching...",
			...props
		},
		ref
	) => (
		<div className="flex items-center border-b px-3" cmdk-input-wrapper="">
			<Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
			<CommandPrimitive.Input
				ref={ref}
				className={cn(
					"flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
					className
				)}
				{...props}
			/>
			{isLoading && (
				<div
					className="ml-2 flex items-center"
					aria-label={loadingText}
				>
					<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
				</div>
			)}
		</div>
	)
);

CommandInputWithLoading.displayName = "CommandInputWithLoading";

export { CommandInputWithLoading };
