import type { ReactNode } from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/shared/utils";

export interface BreadcrumbItem {
	label: string;
	href?: string;
	icon?: ReactNode;
	current?: boolean;
}

interface BreadcrumbProps {
	items: BreadcrumbItem[];
	className?: string;
	separator?: ReactNode;
	showHome?: boolean;
}

export function Breadcrumb({
	items,
	className,
	separator = <ChevronRight className="h-4 w-4" />,
	showHome = true,
}: BreadcrumbProps) {
	// Add home item if requested and not already present
	const breadcrumbItems: BreadcrumbItem[] =
		showHome && items[0]?.href !== "/"
			? [
					{
						label: "Home",
						href: "/",
						icon: <Home className="h-4 w-4" />,
					},
					...items,
			  ]
			: items;

	return (
		<nav className={cn("flex", className)} aria-label="Breadcrumb">
			<ol className="inline-flex items-center space-x-1 md:space-x-3">
				{breadcrumbItems.map((item, index) => {
					const isLast = index === breadcrumbItems.length - 1;
					const isCurrent = item.current || isLast;

					return (
						<li key={index} className="inline-flex items-center">
							{index > 0 && (
								<div className="flex items-center text-muted-foreground mx-1">
									{separator}
								</div>
							)}

							{item.href && !isCurrent ? (
								<Link
									to={item.href}
									className={cn(
										"inline-flex items-center gap-1 text-sm font-medium",
										"text-muted-foreground hover:text-foreground",
										"transition-colors duration-200"
									)}
								>
									{item.icon}
									{item.label}
								</Link>
							) : (
								<span
									className={cn(
										"inline-flex items-center gap-1 text-sm font-medium",
										isCurrent
											? "text-foreground"
											: "text-muted-foreground"
									)}
									aria-current={
										isCurrent ? "page" : undefined
									}
								>
									{item.icon}
									{item.label}
								</span>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}

// Hook to generate breadcrumbs from current route
export function useBreadcrumbs() {
	// This would be implemented based on your routing structure
	// For now, returning a simple implementation
	return {
		generateBreadcrumbs: (pathname: string): BreadcrumbItem[] => {
			const segments = pathname.split("/").filter(Boolean);
			const breadcrumbs: BreadcrumbItem[] = [];

			segments.forEach((segment, index) => {
				const href = "/" + segments.slice(0, index + 1).join("/");
				const label =
					segment.charAt(0).toUpperCase() + segment.slice(1);

				breadcrumbs.push({
					label,
					href: index === segments.length - 1 ? undefined : href,
					current: index === segments.length - 1,
				});
			});

			return breadcrumbs;
		},
	};
}
