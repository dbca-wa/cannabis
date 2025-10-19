import React from "react";
import { Button } from "../button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
} from "../dropdown-menu";
import { Badge } from "../badge";
import { Checkbox } from "../checkbox";
import {
	ChevronDown,
	Download,
	Trash2,
	Edit,
	X,
	FileText,
	FileSpreadsheet,
	Database,
	Loader2,
	AlertTriangle,
} from "lucide-react";
import { cn } from "@/shared/utils";

export interface BulkAction {
	id: string;
	label: string;
	icon?: React.ReactNode;
	variant?: "default" | "destructive" | "secondary" | "outline";
	onClick: () => void;
	disabled?: boolean;
}

export interface BulkActionsProps {
	selectedCount: number;
	totalCount: number;
	onClearSelection: () => void;
	actions?: BulkAction[];
	className?: string;
	// Export functionality - centralized
	onExportSelectedCSV?: () => void;
	onExportSelectedJSON?: () => void;
	onExportAllCSV?: () => void;
	onExportAllJSON?: () => void;
	isExporting?: boolean;
	// New props for "Select All in Database" functionality
	totalDatabaseCount?: number;
	isSelectAllInDatabase?: boolean;
	onToggleSelectAllInDatabase?: () => void;
}

/**
 * Bulk actions toolbar for tables with selection
 * Shows when items are selected and provides bulk operations
 */
export function BulkActions({
	selectedCount,
	totalCount,
	onClearSelection,
	actions = [],
	className,
	// Export functionality - centralized
	onExportSelectedCSV,
	onExportSelectedJSON,
	onExportAllCSV,
	onExportAllJSON,
	isExporting = false,
	// New props for "Select All in Database" functionality
	totalDatabaseCount,
	isSelectAllInDatabase = false,
	onToggleSelectAllInDatabase,
}: BulkActionsProps) {
	if (selectedCount === 0 && !isSelectAllInDatabase) {
		return null;
	}

	const hasSelectedExportActions =
		onExportSelectedCSV || onExportSelectedJSON;
	const hasFullExportActions = onExportAllCSV || onExportAllJSON;
	const hasExportActions = hasSelectedExportActions || hasFullExportActions;
	const hasSelectAllInDatabase =
		totalDatabaseCount && onToggleSelectAllInDatabase;

	// Filter out delete actions when "Select All in Database" is active
	const filteredActions = isSelectAllInDatabase
		? actions.filter((action) => action.id !== "delete")
		: actions;

	return (
		<div
			className={cn(
				"flex flex-col gap-3 p-3 rounded-lg border",
				isSelectAllInDatabase
					? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
					: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
				className
			)}
		>
			{/* Main selection info and actions */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Badge
						variant="secondary"
						className={cn(
							isSelectAllInDatabase
								? "bg-orange-100 text-orange-800"
								: "bg-blue-100 text-blue-800"
						)}
					>
						{isSelectAllInDatabase ? (
							<>
								<Database className="h-3 w-3 mr-1" />
								All {totalDatabaseCount} in database selected
							</>
						) : (
							<>
								{selectedCount} of {totalCount} selected
							</>
						)}
					</Badge>

					<Button
						variant="ghost"
						size="sm"
						onClick={onClearSelection}
						className={cn(
							"h-7 px-2",
							isSelectAllInDatabase
								? "text-orange-700 hover:text-orange-900 hover:bg-orange-100"
								: "text-blue-700 hover:text-blue-900 hover:bg-blue-100"
						)}
					>
						<X className="h-3 w-3 mr-1" />
						Clear
					</Button>
				</div>

				<div className="flex items-center gap-2">
					{/* Export Actions */}
					{(hasExportActions || hasFullExportActions) && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									disabled={isExporting}
								>
									{isExporting ? (
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									) : (
										<Download className="h-4 w-4 mr-2" />
									)}
									Export
									<ChevronDown className="h-4 w-4 ml-2" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{isSelectAllInDatabase ? (
									<>
										{/* Full database export options */}
										{onExportAllCSV && (
											<DropdownMenuItem
												onClick={onExportAllCSV}
												disabled={isExporting}
											>
												<FileSpreadsheet className="h-4 w-4 mr-2" />
												Export All as CSV
											</DropdownMenuItem>
										)}
										{onExportAllJSON && (
											<DropdownMenuItem
												onClick={onExportAllJSON}
												disabled={isExporting}
											>
												<FileText className="h-4 w-4 mr-2" />
												Export All as JSON
											</DropdownMenuItem>
										)}
									</>
								) : (
									<>
										{/* Selected items export options */}
										{onExportSelectedCSV && (
											<DropdownMenuItem
												onClick={onExportSelectedCSV}
												disabled={isExporting}
											>
												<FileSpreadsheet className="h-4 w-4 mr-2" />
												Export Selected as CSV
											</DropdownMenuItem>
										)}
										{onExportSelectedJSON && (
											<DropdownMenuItem
												onClick={onExportSelectedJSON}
												disabled={isExporting}
											>
												<FileText className="h-4 w-4 mr-2" />
												Export Selected as JSON
											</DropdownMenuItem>
										)}
										{hasFullExportActions && (
											<>
												<DropdownMenuSeparator />
												{onExportAllCSV && (
													<DropdownMenuItem
														onClick={onExportAllCSV}
														disabled={isExporting}
													>
														<Database className="h-4 w-4 mr-2" />
														Export All as CSV
													</DropdownMenuItem>
												)}
												{onExportAllJSON && (
													<DropdownMenuItem
														onClick={
															onExportAllJSON
														}
														disabled={isExporting}
													>
														<Database className="h-4 w-4 mr-2" />
														Export All as JSON
													</DropdownMenuItem>
												)}
											</>
										)}
									</>
								)}
							</DropdownMenuContent>
						</DropdownMenu>
					)}

					{/* Custom Actions */}
					{filteredActions.length > 0 && (
						<>
							{(hasExportActions || hasFullExportActions) && (
								<div className="h-4 w-px bg-gray-300 dark:bg-gray-600" />
							)}

							{filteredActions.map((action) => (
								<Button
									key={action.id}
									variant={action.variant || "outline"}
									size="sm"
									onClick={action.onClick}
									disabled={action.disabled || isExporting}
								>
									{action.icon && (
										<span className="mr-2">
											{action.icon}
										</span>
									)}
									{action.label}
								</Button>
							))}
						</>
					)}
				</div>
			</div>

			{/* Select All in Database toggle */}
			{hasSelectAllInDatabase && (
				<div className="flex items-center gap-2 pt-2 border-t border-current/20">
					<Checkbox
						id="select-all-database"
						checked={isSelectAllInDatabase}
						onCheckedChange={onToggleSelectAllInDatabase}
						className="data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
					/>
					<label
						htmlFor="select-all-database"
						className="text-sm font-medium cursor-pointer flex items-center gap-2"
					>
						<Database className="h-4 w-4" />
						Select all {totalDatabaseCount} items in database
					</label>
					{isSelectAllInDatabase && (
						<div className="flex items-center gap-1 text-xs text-orange-700 dark:text-orange-400">
							<AlertTriangle className="h-3 w-3" />
							Bulk delete disabled
						</div>
					)}
				</div>
			)}
		</div>
	);
}

/**
 * Common bulk actions for different entity types
 */
export const commonBulkActions = {
	delete: (onDelete: () => void, disabled?: boolean): BulkAction => ({
		id: "delete",
		label: "Delete Selected",
		icon: <Trash2 className="h-4 w-4" />,
		variant: "destructive" as const,
		onClick: onDelete,
		disabled,
	}),

	edit: (onEdit: () => void, disabled?: boolean): BulkAction => ({
		id: "edit",
		label: "Edit Selected",
		icon: <Edit className="h-4 w-4" />,
		variant: "outline" as const,
		onClick: onEdit,
		disabled,
	}),
};
