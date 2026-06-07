/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/utils";

const inputVariants = cva(
	"flex h-9 w-full rounded-md border px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
	{
		variants: {
			variant: {
				default:
					"border-border/80 bg-muted/30 dark:bg-muted/20 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-ring",
				search:
					"bg-blue-50 dark:bg-blue-950/30 border-2 border-blue-200 dark:border-blue-800 focus-visible:border-blue-400 dark:focus-visible:border-blue-600 focus-visible:ring-blue-400/50 dark:focus-visible:ring-blue-600/50 focus-visible:ring-[3px]",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

export interface InputProps
	extends React.ComponentProps<"input">, VariantProps<typeof inputVariants> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
	({ className, type, variant, ...props }, ref) => {
		return (
			<input
				type={type}
				className={cn(inputVariants({ variant }), className)}
				ref={ref}
				{...props}
			/>
		);
	}
);
Input.displayName = "Input";

export { Input, inputVariants };
