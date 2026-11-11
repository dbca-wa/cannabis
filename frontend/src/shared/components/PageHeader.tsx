import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	subtitle?: string;
	actions?: ReactNode;
	titleClassName?: string;
}

/** Page header with title, optional subtitle, and action buttons. */
export const PageHeader = ({
	title,
	subtitle,
	actions,
	titleClassName,
}: PageHeaderProps) => {
	return (
		// On a phone the actions drop below the title instead of running off the
		// right edge of the screen.
		<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="min-w-0">
				<h1 className={titleClassName || "tracking-tight"}>{title}</h1>
				{subtitle && (
					<p className="text-muted-foreground text-[14px] mt-1">{subtitle}</p>
				)}
			</div>
			{actions && (
				<div className="flex flex-wrap items-center gap-2">{actions}</div>
			)}
		</div>
	);
};
