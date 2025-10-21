import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import {
	MoreHorizontal,
	Plus,
	Search,
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
	RotateCcw,
	ChevronDown,
	User,
	Keyboard,
	Loader2,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Badge } from "@/shared/components/ui/badge";
import { IndeterminateCheckbox } from "@/shared/components/ui/custom/indeterminate-checkbox";
import {
	BulkActions,
	commonBulkActions,
} from "@/shared/components/ui/custom/bulk-actions";
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import { TablePagination } from "@/shared/components/ui/custom/table-pagination";
import { useDebounce } from "@/shared/hooks/core/useDebounce";
import { useBulkSelection } from "@/shared/hooks/data/useBulkSelection";
import { useBreakpoint } from "@/shared/hooks/ui/useResponsive";
import {
	useKeyboardShortcuts,
	commonShortcuts,
} from "@/shared/hooks/ui/useKeyboardShortcuts";
import { useDefendantsTableFilters } from "@/shared/hooks/data/useTableFilterPersistence";
import { useServerPagination } from "@/shared/hooks/data/useServerPagination";
import { useExport } from "@/shared/hooks/data/useExport";
import { useDefendants } from "../hooks/useDefendants";
import { DefendantsService } from "../services/defendants.service";
import { ENDPOINTS } from "@/shared/services/api";
import {
	exportToCSV,
	exportToJSON,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import { toast } from "sonner";

import type { DefendantTiny } from "@/shared/types/backend-api.types";

// Stable default filters object to prevent re-renders
const DEFAULT_DEFENDANTS_FILTERS = {
	sortField: "last_name" as const,
	sortDirection: "asc" as const,
};

export const DefendantsTable = () => {
	const navigate = useNavigate();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const { isMobile } = useBreakpoint();

	// Search state (not persisted)
	const [searchQuery, setSearchQuery] = useState("");
	const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

	// Persistent filter state
	const { filters, updateFilter, resetFilters } = useDefendantsTableFilters(
		DEFAULT_DEFENDANTS_FILTERS
	);

	// Server-side pagination
	const pagination = useServerPagination({
		initialPage: 1,
		enableGlobalPageSize: true,
	});

	// Debounce search query for better performance
	const debouncedSearchQuery = useDebounce(searchQuery, 300);

	// Build ordering string from persistent sort state
	const ordering =
		filters.sortDirection === "desc"
			? `-${filters.sortField}`
			: filters.sortField;

	// Build search parameters for server-side pagination
	const searchParams = useMemo(
		() => ({
			page: pagination.currentPage,
			limit: pagination.pageSize,
			search: debouncedSearchQuery || undefined,
			ordering: ordering,
		}),
		[
			pagination.currentPage,
			pagination.pageSize,
			debouncedSearchQuery,
			ordering,
		]
	);

	// Fetch data
	const {
		data: defendantsResponse,
		isLoading,
		error,
	} = useDefendants(searchParams);

	const defendants = useMemo(
		() => defendantsResponse?.results || [],
		[defendantsResponse?.results]
	);

	useEffect(() => {
		if (defendantsResponse) {
			// Update pagination total when data changes
			(pagination as any).updateTotalItems(defendantsResponse.count || 0);
		}
	}, [defendantsResponse, pagination]);

	// Bulk selection with database-wide support
	const bulkSelection = useBulkSelection<DefendantTiny>({
		items: defendants,
		getItemId: (defendant) => defendant.id,
		totalDatabaseCount: defendantsResponse?.count || 0,
	});

	// Delete mutation is handled by route-based modals

	// Handle actions
	const handleEdit = (defendant: DefendantTiny) => {
		navigate(`/defendants/${defendant.id}`);
	};

	const handleDelete = (defendant: DefendantTiny) => {
		navigate(`/defendants/${defendant.id}/delete`);
	};

	const handleResetFilters = useCallback(() => {
		setSearchQuery("");
		resetFilters(); // This will reset all filters to defaults and persist to server
		pagination.firstPage(); // Reset to first page
		bulkSelection.clearSelection();
	}, [resetFilters, bulkSelection, pagination]);

	// Centralized export functionality
	const exportHook = useExport({
		entityName: "defendants",
		exportEndpoint: ENDPOINTS.DEFENDANTS.EXPORT,
		getCurrentFilters: () => ({
			searchQuery: debouncedSearchQuery || undefined,
			ordering: ordering,
		}),
	});

	// Export functions for selected items (local data)
	const handleExportSelectedCSV = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("defendants_selected", "csv");

		exportToCSV(dataToExport, commonExportColumns.defendant, {
			filename,
		});
		toast.success(`Exported ${dataToExport.length} defendants to CSV`);
	}, [bulkSelection]);

	const handleExportSelectedJSON = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("defendants_selected", "json");

		exportToJSON(dataToExport, commonExportColumns.defendant, {
			filename,
		});
		toast.success(`Exported ${dataToExport.length} defendants to JSON`);
	}, [bulkSelection]);

	// Bulk delete function
	const handleBulkDelete = () => {
		const selectedDefendants = bulkSelection.getSelectedItems();
		const cannotDelete = selectedDefendants.filter(
			(defendant) => !DefendantsService.canDeleteDefendant(defendant)
		);

		if (cannotDelete.length > 0) {
			toast.error(
				`Cannot delete ${cannotDelete.length} defendant(s) with associated cases`
			);
			return;
		}

		toast.info(
			`Would delete ${selectedDefendants.length} defendants (confirmation dialog would appear)`
		);
	};

	// Sorting functionality
	const handleSort = (field: string) => {
		if (filters.sortField === field) {
			// If already sorting by this field, toggle direction
			const newDirection =
				filters.sortDirection === "asc" ? "desc" : "asc";
			updateFilter("sortDirection", newDirection);
		} else {
			// If sorting by different field, start with ascending
			updateFilter("sortField", field);
			updateFilter("sortDirection", "asc");
		}
		// Reset to first page when sorting changes
		pagination.firstPage();
	};

	// Get sort icon for a field
	const getSortIcon = (field: string) => {
		if (filters.sortField === field) {
			return filters.sortDirection === "asc" ? (
				<ArrowUp className="h-4 w-4" />
			) : (
				<ArrowDown className="h-4 w-4" />
			);
		} else {
			return <ArrowUpDown className="h-4 w-4 opacity-50" />;
		}
	};

	// Keyboard shortcuts
	const shortcuts = useMemo(
		() => [
			commonShortcuts.table.selectAll(() => bulkSelection.toggleAll()),
			commonShortcuts.table.clearSelection(() =>
				bulkSelection.clearSelection()
			),
			commonShortcuts.table.search(() => searchInputRef.current?.focus()),
			commonShortcuts.table.export(() => exportHook.exportCSV()),
			commonShortcuts.general.help(() => setShowShortcutsHelp(true)),
			{
				key: "n",
				ctrlKey: true,
				action: () => navigate("/defendants/add"),
				description: "Create new defendant",
			},
			{
				key: "r",
				ctrlKey: true,
				action: handleResetFilters,
				description: "Reset filters",
			},
		],
		[bulkSelection, exportHook.exportCSV, navigate, handleResetFilters]
	);

	useKeyboardShortcuts({ shortcuts });

	const hasActiveFilters = searchQuery;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">
						Defendants
					</h2>
					<p className="text-muted-foreground">
						Manage defendants and their case associations
					</p>
				</div>
				<div className="flex items-center gap-2">
					{/* Keyboard shortcuts help button (top right) */}
					{!isMobile && (
						<button
							onClick={() => setShowShortcutsHelp(true)}
							className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
							title="Show keyboard shortcuts (Shift + ?)"
						>
							<Keyboard className="h-3 w-3" />
							Shortcuts
						</button>
					)}

					<Button
						onClick={() => navigate("/defendants/add")}
						title="Add new defendant (Ctrl+N)"
						className="flex-shrink-0"
					>
						<Plus className="mr-2 h-4 w-4" />
						{isMobile ? "Add" : "Add Defendant"}
					</Button>
				</div>
			</div>

			{/* Bulk Actions */}
			{(bulkSelection.selectedCount > 0 ||
				bulkSelection.isSelectAllInDatabase) && (
				<BulkActions
					selectedCount={bulkSelection.selectedCount}
					totalCount={defendants.length}
					onClearSelection={bulkSelection.clearSelection}
					// Centralized export functions
					onExportSelectedCSV={handleExportSelectedCSV}
					onExportSelectedJSON={handleExportSelectedJSON}
					onExportAllCSV={exportHook.exportCSV}
					onExportAllJSON={exportHook.exportJSON}
					isExporting={exportHook.isExporting}
					actions={[
						commonBulkActions.delete(handleBulkDelete, false),
					]}
					// Enhanced props for "Select All in Database"
					totalDatabaseCount={defendantsResponse?.count}
					isSelectAllInDatabase={bulkSelection.isSelectAllInDatabase}
					onToggleSelectAllInDatabase={
						bulkSelection.toggleSelectAllInDatabase
					}
				/>
			)}

			{/* Search and Filters */}
			<div className="flex flex-col gap-4">
				{/* Search */}
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						ref={searchInputRef}
						placeholder={
							isMobile
								? "Search defendants..."
								: "Search defendants by name..."
						}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>

				{/* Filters and Actions */}
				<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
					{/* Export button (when no selection) - hide on mobile */}
					{bulkSelection.selectedCount === 0 &&
						!bulkSelection.isSelectAllInDatabase &&
						!isMobile && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button
										variant="outline"
										size="sm"
										disabled={exportHook.isExporting}
									>
										{exportHook.isExporting ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Exporting...
											</>
										) : (
											<>
												Export{" "}
												<ChevronDown className="ml-2 h-4 w-4" />
											</>
										)}
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={exportHook.exportCSV}
										disabled={exportHook.isExporting}
									>
										Export All as CSV
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={exportHook.exportJSON}
										disabled={exportHook.isExporting}
									>
										Export All as JSON
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						)}

					{/* Reset Filters Button */}
					{hasActiveFilters && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleResetFilters}
							title="Reset all filters (Ctrl+R)"
						>
							<RotateCcw className="mr-2 h-4 w-4" />
							Reset Filters
						</Button>
					)}
				</div>
			</div>

			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							{/* Bulk selection header */}
							<TableHead className="w-12">
								<IndeterminateCheckbox
									checked={bulkSelection.isAllSelected}
									indeterminate={
										bulkSelection.selectedCount > 0 &&
										!bulkSelection.isAllSelected
									}
									onCheckedChange={bulkSelection.toggleAll}
									aria-label="Select all defendants"
								/>
							</TableHead>

							{/* ID Column */}
							<TableHead className="w-20">
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 font-semibold hover:bg-transparent"
									onClick={() => handleSort("id")}
								>
									ID
									{getSortIcon("id")}
								</Button>
							</TableHead>

							{/* First Name Column */}
							<TableHead>
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 font-semibold hover:bg-transparent"
									onClick={() => handleSort("first_name")}
								>
									First Name
									{getSortIcon("first_name")}
								</Button>
							</TableHead>

							{/* Last Name Column */}
							<TableHead>
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 font-semibold hover:bg-transparent"
									onClick={() => handleSort("last_name")}
								>
									Last Name
									{getSortIcon("last_name")}
								</Button>
							</TableHead>

							{/* Cases Count Column */}
							<TableHead className="w-32">
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 font-semibold hover:bg-transparent"
									onClick={() => handleSort("cases_count")}
								>
									Cases
									{getSortIcon("cases_count")}
								</Button>
							</TableHead>

							{/* Actions Column */}
							<TableHead className="w-16">
								<span className="sr-only">Actions</span>
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isLoading ? (
							// Loading skeleton
							Array.from({ length: 5 }).map((_, index) => (
								<TableRow key={index}>
									<TableCell>
										<Skeleton className="h-4 w-4" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-8" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-32" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-6 w-16" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-8 w-8" />
									</TableCell>
								</TableRow>
							))
						) : error ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="h-24 text-center"
								>
									<div className="text-muted-foreground">
										<p>Error loading defendants</p>
										<p className="text-sm">
											{(error as Error)?.message ||
												"Please try again"}
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : defendants.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={6}
									className="h-24 text-center"
								>
									<div className="text-muted-foreground">
										<User className="mx-auto h-12 w-12 opacity-50" />
										<p className="mt-2">
											{searchQuery
												? "No defendants found"
												: "No defendants yet"}
										</p>
										<p className="text-sm">
											{searchQuery
												? "Try adjusting your search"
												: "Add your first defendant to get started"}
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							defendants.map((defendant) => (
								<TableRow key={defendant.id}>
									{/* Bulk selection checkbox */}
									<TableCell>
										<Checkbox
											checked={bulkSelection.isSelected(
												defendant.id
											)}
											onCheckedChange={() =>
												bulkSelection.toggleItem(
													defendant.id
												)
											}
											aria-label={`Select defendant ${defendant.full_name}`}
										/>
									</TableCell>

									{/* ID */}
									<TableCell className="font-mono text-sm">
										{defendant.id}
									</TableCell>

									{/* First Name */}
									<TableCell>
										{defendant.first_name || (
											<span className="text-muted-foreground italic">
												—
											</span>
										)}
									</TableCell>

									{/* Last Name */}
									<TableCell className="font-medium">
										{defendant.last_name}
									</TableCell>

									{/* Cases Count */}
									<TableCell>
										<Badge
											variant={"secondary"}
											className="font-mono"
										>
											{DefendantsService.getDefendantCasesBadge(
												defendant
											)}
										</Badge>
									</TableCell>

									{/* Actions */}
									<TableCell>
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													className="h-8 w-8 p-0"
												>
													<span className="sr-only">
														Open menu
													</span>
													<MoreHorizontal className="h-4 w-4" />
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												<DropdownMenuItem
													onClick={() =>
														handleEdit(defendant)
													}
												>
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														handleDelete(defendant)
													}
													className={
														!DefendantsService.canDeleteDefendant(
															defendant
														)
															? "text-muted-foreground"
															: "text-destructive"
													}
													disabled={
														!DefendantsService.canDeleteDefendant(
															defendant
														)
													}
												>
													Delete
												</DropdownMenuItem>
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			{/* Unified Pagination */}
			{defendantsResponse && (
				<TablePagination
					currentPage={pagination.currentPage}
					totalPages={pagination.totalPages}
					totalItems={defendantsResponse.count}
					itemsShown={defendants.length}
					onPageChange={pagination.setPage}
					onPageSizeChange={pagination.setPageSize}
					isLoading={isLoading}
				/>
			)}

			{/* Keyboard Shortcuts Help */}
			<KeyboardShortcutsHelp
				open={showShortcutsHelp}
				onOpenChange={setShowShortcutsHelp}
				shortcuts={shortcuts}
				title="Defendants Table Shortcuts"
				description="Use these keyboard shortcuts to work with the defendants table more efficiently."
			/>
		</div>
	);
};
