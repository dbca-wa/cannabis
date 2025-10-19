import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/shared/utils/index";

export interface IndeterminateCheckboxProps
	extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
	indeterminate?: boolean;
}

const IndeterminateCheckbox = React.forwardRef<
	React.ElementRef<typeof CheckboxPrimitive.Root>,
	IndeterminateCheckboxProps
>(({ className, indeterminate, checked, ...props }, ref) => {
	// Handle indeterminate state

	return (
		<CheckboxPrimitive.Root
			ref={ref}
			className={cn(
				"peer h-4 w-4 shrink-0 rounded-sm border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
				indeterminate && "bg-primary text-primary-foreground",
				className
			)}
			checked={indeterminate ? false : checked}
			{...props}
		>
			<CheckboxPrimitive.Indicator
				className={cn("flex items-center justify-center text-current")}
			>
				{indeterminate ? (
					<Minus className="h-4 w-4" />
				) : (
					<Check className="h-4 w-4" />
				)}
			</CheckboxPrimitive.Indicator>
		</CheckboxPrimitive.Root>
	);
});

IndeterminateCheckbox.displayName = "IndeterminateCheckbox";

export { IndeterminateCheckbox };
