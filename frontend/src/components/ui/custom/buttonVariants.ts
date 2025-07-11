import { cn } from "@/lib/utils";
import { cva } from "class-variance-authority";

export const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
				destructive:
					"bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
				outline:
					"border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
				secondary:
					"bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
				ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
				cancel: "bg-accent hover:bg-gray-200/80 hover:text-accent-foreground dark:hover:bg-accent/50",
				link: "text-primary underline-offset-4 hover:underline",
				cannabis:
					"bg-cannabis-green text-white shadow-xs hover:bg-cannabis-green-dark",
				cannabisLight:
					"bg-cannabis-light text-white shadow-xs hover:bg-cannabis-green",
				cannabisEarth:
					"bg-cannabis-earth text-white shadow-xs hover:bg-cannabis-earth/80",
				cannabisPurple:
					"bg-cannabis-purple text-white shadow-xs hover:bg-cannabis-purple/80",
				police: cn(
					// Base police styling (when not hovered)
					"relative overflow-hidden text-white font-semibold shadow-lg",
					"bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800",
					// "border-2 border-white/20",
					"transition-all duration-75", // Super fast transition
					// Hover effects with fast animation
					"hover:shadow-lg hover:scale-101",
					// Fast siren animation on hover - matches the always-animating speed
					"hover:bg-gradient-to-r hover:from-red-600 hover:via-blue-600 hover:to-red-600",
					"hover:bg-[length:200%_100%]",
					"hover:animate-[police-siren_.5s_linear_infinite]" // Linear for consistent speed
				),

				sidebarButton: cn(
					"!size-10 cannabis-green !p-2",
					"cursor-pointer",
					"z-[999] hover-cannabis-button"
				),
			},
			size: {
				default: "h-9 px-4 py-2 has-[>svg]:px-3",
				sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
				lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
				icon: "size-9",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);
