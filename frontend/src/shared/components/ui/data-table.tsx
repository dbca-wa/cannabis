import React, { useState } from "react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type SortingState,
	type VisibilityState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, Search, RefreshCw, X } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/utils";

// Enhanced filter interface
export interface DataTableFilter {
	id: string;
	label: string;
	options: Array<{ value: string; label: string }>;
	value: string;
	onChange: (value: string) => void;
}

// Action interface for table actions
export interface DataTableAction {
	label: string;
	icon?: React.ReactNode;
	onClick: () => void;
	variant?:
		| "default"
		| "outline"
		| "destructive"
		| "secondary"
		| "ghost"
		| "link";
}

// Main props interface
export interface DataTableProps<TData> {
	// Data and columns
	data: TData[];
	columns: ColumnDef<TData>[];

	// Loading and error states
	isLoading?: boolean;
	error?: string | null;

	// Search functionality
	searchable?: boolean;
	searchPlaceholder?: string;
	searchValue?: string;
	onSearchChange?: (value: string) => void;

	// Filtering
	filters?: DataTableFilter[];

	// Actions
	actions?: DataTableAction[];

	// Pagination
	pagination?: {
		pageIndex: number;
		pageSize: number;
		pageCount: number;
		total: number;
		onPageChange: (pageIndex: number) => void;
		onPageSizeChange: (pageSize: number) => void;
	};

	// Table configuration
	enableSorting?: boolean;
	enableColumnVisibility?: boolean;
	enableRowSelection?: boolean;

	// Empty state
	emptyStateTitle?: string;
	emptyStateDescription?: string;
	emptyStateAction?: DataTableAction;

	// Refresh functionality
	onRefresh?: () => void;
	isRefreshing?: boolean;

	// Custom styling
	className?: string;
	tableClassName?: string;

	// Results info
	showResultsCount?: boolean;
	resultsCountLabel?: (count: number, total: number) => string;
}

export function DataTable<TData>({
	data,
	columns,
	isLoading = false,
	error = null,
	searchable = true,
	searchPlaceholder = "Search...",
	searchValue = "",
	onSearchChange,
	filters = [],
	actions = [],
	pagination,
	enableSorting = true,
	enableColumnVisibility = true,
	enableRowSelection = false,
	emptyStateTitle = "No data found",
	emptyStateDescription = "No results match your current filters.",
	emptyStateAction,
	onRefresh,
	isRefreshing = false,
	className,
	tableClassName,
	showResultsCount = true,
	resultsCountLabel = (count, total) =>
		`Showing ${count} of ${total} results`,
}: DataTableProps<TData>) {
	// Internal state for table functionality
	const [sorting, setSorting] = useState<SortingState>([]);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
		{}
	);
	const [rowSelection, setRowSelection] = useState({});

	// Create table instance
	const table = useReactTable({
		data,
		columns,
		onSortingChange: enableSorting ? setSorting : undefined,
		onColumnFiltersChange: setColumnFilters,
		getCoreRowModel: getCoreRowModel(),
		getPaginationRowModel: pagination ? undefined : getPaginationRowModel(),
		getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
		getFilteredRowModel: getFilteredRowModel(),
		onColumnVisibilityChange: enableColumnVisibility
			? setColumnVisibility
			: undefined,
		onRowSelectionChange: enableRowSelection ? setRowSelection : undefined,
		state: {
			sorting: enableSorting ? sorting : undefined,
			columnFilters,
			columnVisibility: enableColumnVisibility
				? columnVisibility
				: undefined,
			rowSelection: enableRowSelection ? rowSelection : undefined,
		},
		initialState: {
			pagination: pagination
				? undefined
				: {
						pageSize: 10,
				  },
		},
	});

	// Check if any filters are active
	const hasActiveFilters = filters.some(
		(filter) => filter.value !== "all" && filter.value !== ""
	);
	const hasSearchQuery = searchValue.length > 0;

	// Clear all filters
	const clearAllFilters = () => {
		filters.forEach((filter) => filter.onChange("all"));
		if (onSearchChange) {
			onSearchChange("");
		}
	};

	// Error state
	if (error) {
		return (
			<div className={cn("space-y-4", className)}>
				<div className="flex items-center justify-center p-8 border rounded-lg">
					<div className="text-center space-y-4">
						<div className="text-red-600 font-medium">
							Error loading data
						</div>
						<p className="text-sm text-muted-foreground">{error}</p>
						{onRefresh && (
							<Button
								onClick={onRefresh}
								variant="outline"
								size="sm"
							>
								<RefreshCw className="mr-2 h-4 w-4" />
								Try Again
							</Button>
						)}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={cn("space-y-4", className)}>
			{/* Header with search, filters, and actions */}
			<div className="flex flex-col gap-4">
				{/* Top row: Search and main actions */}
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2 flex-1 max-w-md">
						{searchable && (
							<div className="relative flex-1">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
								<Input
									placeholder={searchPlaceholder}
									value={searchValue}
									onChange={(e) =>
										onSearchChange?.(e.target.value)
									}
									className="pl-10"
								/>
							</div>
						)}
					</div>

					<div className="flex gap-2">
						{/* Refresh button */}
						{onRefresh && (
							<Button
								variant="outline"
								onClick={onRefresh}
								disabled={isRefreshing}
								size="sm"
							>
								<RefreshCw
									className={cn(
										"h-4 w-4",
										isRefreshing && "animate-spin"
									)}
								/>
							</Button>
						)}

						{/* Column visibility dropdown */}
						{enableColumnVisibility && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										Columns{" "}
										<ChevronDown className="ml-2 h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									{table
										.getAllColumns()
										.filter((column) => column.getCanHide())
										.map((column) => (
											<DropdownMenuCheckboxItem
												key={column.id}
												className="capitalize"
												checked={column.getIsVisible()}
												onCheckedChange={(value) =>
													column.toggleVisibility(
														!!value
													)
												}
											>
												{column.id.replace("_", " ")}
											</DropdownMenuCheckboxItem>
										))}
								</DropdownMenuContent>
							</DropdownMenu>
						)}

						{/* Custom actions */}
						{actions.map((action, index) => (
							<Button
								key={index}
								variant={action.variant || "default"}
								onClick={action.onClick}
								size="sm"
							>
								{action.icon}
								{action.label}
							</Button>
						))}
					</div>
				</div>

				{/* Second row: Filters and clear button */}
				{filters.length > 0 && (
					<div className="flex items-center gap-4">
						{filters.map((filter) => (
							<div
								key={filter.id}
								className="flex items-center gap-2"
							>
								<span className="text-sm font-medium">
									{filter.label}:
								</span>
								<Select
									value={filter.value}
									onValueChange={filter.onChange}
								>
									<SelectTrigger className="w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{filter.options.map((option) => (
											<SelectItem
												key={option.value}
												value={option.value}
											>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						))}

						{/* Clear filters button */}
						{(hasActiveFilters || hasSearchQuery) && (
							<Button
								variant="outline"
								onClick={clearAllFilters}
								size="sm"
							>
								<X className="mr-2 h-4 w-4" />
								Clear Filters
							</Button>
						)}
					</div>
				)}

				{/* Results count */}
				{showResultsCount && !isLoading && (
					<div className="text-sm text-muted-foreground">
						{pagination
							? resultsCountLabel(data.length, pagination.total)
							: `${data.length} result${
									data.length === 1 ? "" : "s"
							  }`}
					</div>
				)}
			</div>

			{/* Table */}
			<div className={cn("rounded-md border", tableClassName)}>
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef
														.header,
													header.getContext()
											  )}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{isLoading ? (
							// Loading skeleton
							Array.from({ length: 5 }).map((_, index) => (
								<TableRow key={index}>
									{columns.map((_, colIndex) => (
										<TableCell key={colIndex}>
											<Skeleton className="h-4 w-full" />
										</TableCell>
									))}
								</TableRow>
							))
						) : table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={
										row.getIsSelected() && "selected"
									}
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext()
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center"
								>
									<div className="flex flex-col items-center gap-2">
										<div>
											<p className="text-sm font-medium text-gray-900">
												{emptyStateTitle}
											</p>
											<p className="text-sm text-muted-foreground">
												{emptyStateDescription}
											</p>
										</div>
										{emptyStateAction && (
											<Button
												onClick={
													emptyStateAction.onClick
												}
												variant={
													emptyStateAction.variant ||
													"outline"
												}
												size="sm"
											>
												{emptyStateAction.icon}
												{emptyStateAction.label}
											</Button>
										)}
									</div>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			{/* Pagination */}
			{pagination && (
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">
							Page {pagination.pageIndex + 1} of{" "}
							{pagination.pageCount}
						</span>
						<Select
							value={pagination.pageSize.toString()}
							onValueChange={(value) =>
								pagination.onPageSizeChange(Number(value))
							}
						>
							<SelectTrigger className="w-20">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="5">5</SelectItem>
								<SelectItem value="10">10</SelectItem>
								<SelectItem value="20">20</SelectItem>
								<SelectItem value="50">50</SelectItem>
							</SelectContent>
						</Select>
						<span className="text-sm text-muted-foreground">
							per page
						</span>
					</div>

					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={() => pagination.onPageChange(0)}
							disabled={pagination.pageIndex === 0}
						>
							First
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								pagination.onPageChange(
									pagination.pageIndex - 1
								)
							}
							disabled={pagination.pageIndex === 0}
						>
							Previous
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								pagination.onPageChange(
									pagination.pageIndex + 1
								)
							}
							disabled={
								pagination.pageIndex >= pagination.pageCount - 1
							}
						>
							Next
						</Button>
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								pagination.onPageChange(
									pagination.pageCount - 1
								)
							}
							disabled={
								pagination.pageIndex >= pagination.pageCount - 1
							}
						>
							Last
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
