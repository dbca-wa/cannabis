import React from "react";
import { observer } from "mobx-react-lite";
import { Monitor, Layout, FileText } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";
import type { ViewMode } from "@/features/submissions/stores/submissionForm.store";

interface ViewSwitcherProps {
	currentView: ViewMode;
	onViewChange: (view: ViewMode) => void;
	disabled?: boolean;
	disableDualView?: boolean; // New prop to disable only dual-view on mobile/tablet
	className?: string;
}

const viewOptions: Array<{
	value: ViewMode;
	label: string;
	icon: React.ReactNode;
	description: string;
}> = [
	{
		value: "data-entry",
		label: "Data",
		icon: <FileText className="h-4 w-4" />,
		description: "Focus on form input",
	},
	{
		value: "dual-view",
		label: "Both",
		icon: <Layout className="h-4 w-4" />,
		description: "Form and preview side-by-side",
	},
	{
		value: "preview-only",
		label: "Preview",
		icon: <Monitor className="h-4 w-4" />,
		description: "Certificate preview",
	},
];

export const ViewSwitcher: React.FC<ViewSwitcherProps> = observer(
	({
		currentView,
		onViewChange,
		disabled = false,
		disableDualView = false,
		className,
	}) => {
		// Filter out dual-view option if disabled
		const availableOptions = disableDualView
			? viewOptions.filter((opt) => opt.value !== "dual-view")
			: viewOptions;

		return (
			<div
				className={cn(
					"inline-flex items-center gap-2 w-full",
					disabled && "opacity-50 pointer-events-none",
					className
				)}
				role="tablist"
				aria-label="View mode selector"
			>
				{availableOptions.map((option) => {
					const isActive = currentView === option.value;

					return (
						<button
							key={option.value}
							type="button"
							role="tab"
							aria-selected={isActive}
							aria-label={option.description}
							disabled={disabled}
							onClick={() => onViewChange(option.value)}
							className={cn(
								"flex-1 inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								"disabled:pointer-events-none disabled:opacity-50",
								isActive
									? "bg-primary text-primary-foreground shadow-sm dark:text-white"
									: "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
							)}
							title={option.description}
						>
							{option.icon}
							<span className="hidden sm:inline">
								{option.label}
							</span>
							<span className="sm:hidden">
								{option.value === "data-entry"
									? "Form"
									: option.value === "dual-view"
									? "Both"
									: "Preview"}
							</span>
						</button>
					);
				})}
			</div>
		);
	}
);

ViewSwitcher.displayName = "ViewSwitcher";
