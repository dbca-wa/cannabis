import { Slot } from "@radix-ui/react-slot";
import { type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/shared/utils/index";
import { buttonVariants } from "./custom/buttonVariants";

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : "button";

	return (
		<Comp
			data-slot="button"
			className={cn(
				"cursor-pointer",
				buttonVariants({ variant, size, className })
			)}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
