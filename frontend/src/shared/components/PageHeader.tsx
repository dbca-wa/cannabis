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
		<div className="flex items-center justify-between gap-4 mb-6">
			<div>
				<h1 className={titleClassName || "tracking-tight"}>{title}</h1>
				{subtitle && (
					<p className="text-muted-foreground text-[14px] mt-1">{subtitle}</p>
				)}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	);
};
