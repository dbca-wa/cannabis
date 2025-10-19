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
	Keyboard,
	ChevronDown,
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { IndeterminateCheckbox } from "@/shared/components/ui/custom/indeterminate-checkbox";
import {
	BulkActions,
	commonBulkActions,
} from "@/shared/components/ui/custom/bulk-actions";
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import { TablePagination } from "@/shared/components/ui/custom/table-pagination";
import { useDebounce } from "@/shared/hooks/core";
import { useBulkSelection } from "@/shared/hooks/data";
import {
	useBreakpoint,
	useKeyboardShortcuts,
	commonShortcuts,
} from "@/shared/hooks/ui";
import { useOfficersTableFilters } from "@/shared/hooks/data/useTableFilterPersistence";
import { useServerPagination } from "@/shared/hooks/data/useServerPagination";
import { useExport } from "@/shared/hooks/data/useExport";
import { usePoliceOfficers } from "../../hooks/usePoliceOfficers";
import { useStations } from "../../hooks/usePoliceStations";
import { ENDPOINTS } from "@/shared/services/api";
import { officerRankOptions } from "../../schemas/policeOfficerSchemas";
import {
	exportToCSV,
	exportToJSON,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import { toast } from "sonner";

import type {
	PoliceOfficerTiny,
	OfficerRank,
} from "@/shared/types/backend-api.types";

// Stable default filters object to prevent re-renders
const DEFAULT_OFFICERS_FILTERS = {
	stationFilter: "all" as const,
	rankFilter: "all" as const,
	swornFilter: "all" as const,
	includeUnknown: true,
	unknownOnly: false,
	sortField: "last_name" as const,
	sortDirection: "asc" as const,
};

export const PoliceOfficersTable = () => {
	const navigate = useNavigate();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const { isMobile } = useBreakpoint();

	// Search state (not persisted)
	const [searchQuery, setSearchQuery] = useState("");
	const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

	// Persistent filter state
	const { filters, updateFilter, resetFilters } = useOfficersTableFilters(
		DEFAULT_OFFICERS_FILTERS
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
			station:
				filters.stationFilter && filters.stationFilter !== "all"
					? parseInt(filters.stationFilter)
					: undefined,
			rank:
				filters.rankFilter && filters.rankFilter !== "all"
					? (filters.rankFilter as OfficerRank)
					: undefined,
			is_sworn:
				filters.swornFilter && filters.swornFilter !== "all"
					? filters.swornFilter === "true"
					: undefined,
			include_unknown: filters.includeUnknown,
			unknown_only: filters.unknownOnly,
			ordering: ordering,
		}),
		[
			pagination.currentPage,
			pagination.pageSize,
			debouncedSearchQuery,
			filters,
			ordering,
		]
	);

	// Debug: Log search parameters (commented out to reduce noise)
	// console.log("🔍 Officers Search Params:", searchParams);

	// Fetch data
	const {
		data: officersResponse,
		isLoading,
		error,
	} = usePoliceOfficers(searchParams);
	const { data: stationsResponse } = useStations();

	const officers = useMemo(
		() => officersResponse?.results || [],
		[officersResponse?.results]
	);

	useEffect(() => {
		if (officersResponse) {
			// Update pagination total when data changes
			(pagination as any).updateTotalItems(officersResponse.count || 0);
		}
	}, [officersResponse, pagination]);
	const stations = stationsResponse?.results || [];

	// Bulk selection with database-wide support
	const bulkSelection = useBulkSelection({
		items: officers,
		getItemId: (officer) => officer.id,
		totalDatabaseCount: officersResponse?.count || 0,
	});

	// Centralized export functionality
	const exportHook = useExport({
		entityName: "police-officers",
		exportEndpoint: ENDPOINTS.POLICE.OFFICERS.EXPORT,
		getCurrentFilters: () => ({
			searchQuery: debouncedSearchQuery || undefined,
			ordering: ordering,
			additionalParams: {
				station:
					filters.stationFilter && filters.stationFilter !== "all"
						? parseInt(filters.stationFilter)
						: undefined,
				rank:
					filters.rankFilter && filters.rankFilter !== "all"
						? filters.rankFilter
						: undefined,
				is_sworn:
					filters.swornFilter && filters.swornFilter !== "all"
						? filters.swornFilter === "true"
						: undefined,
				include_unknown: filters.includeUnknown,
				unknown_only: filters.unknownOnly,
			},
		}),
	});

	// Export functions for selected items (local data)
	const handleExportSelectedCSV = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("police_officers_selected", "csv");

		exportToCSV(dataToExport, commonExportColumns.policeOfficer, {
			filename,
		});
		toast.success(`Exported ${dataToExport.length} officers to CSV`);
	}, [bulkSelection]);

	const handleExportSelectedJSON = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("police_officers_selected", "json");

		exportToJSON(dataToExport, commonExportColumns.policeOfficer, {
			filename,
		});
		toast.success(`Exported ${dataToExport.length} officers to JSON`);
	}, [bulkSelection]);

	// Handle actions
	const handleEdit = (officer: PoliceOfficerTiny) => {
		navigate(`/police/officers/${officer.id}`);
	};

	const handleDelete = (officer: PoliceOfficerTiny) => {
		navigate(`/police/officers/${officer.id}/delete`);
	};

	const handleResetFilters = () => {
		setSearchQuery("");
		resetFilters(); // This will reset all filters to defaults and persist to server
		pagination.firstPage(); // Reset to first page
		bulkSelection.clearSelection();
	};

	// Export functions

	// Bulk delete function
	const handleBulkDelete = () => {
		const selectedOfficers = bulkSelection.getSelectedItems();
		toast.info(
			`Would delete ${selectedOfficers.length} officers (confirmation dialog would appear)`
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

	// Handle unknown ranks checkbox interactions
	const handleIncludeUnknownChange = (checked: boolean) => {
		updateFilter("includeUnknown", checked);
		// If we're showing unknown only and user unchecks include unknown, turn off unknown only
		if (!checked && filters.unknownOnly) {
			updateFilter("unknownOnly", false);
		}
	};

	const handleUnknownOnlyChange = (checked: boolean) => {
		updateFilter("unknownOnly", checked);
		// If user wants to show unknown only, automatically enable include unknown
		if (checked && !filters.includeUnknown) {
			updateFilter("includeUnknown", true);
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
				action: () => navigate("/police/officers/add"),
				description: "Create new officer",
			},
		],
		[bulkSelection, exportHook.exportCSV, navigate]
	);

	useKeyboardShortcuts({ shortcuts });

	const hasActiveFilters =
		searchQuery ||
		(filters.stationFilter && filters.stationFilter !== "all") ||
		(filters.rankFilter && filters.rankFilter !== "all") ||
		(filters.swornFilter && filters.swornFilter !== "all");

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">
						Police Officers
					</h2>
					<p className="text-muted-foreground">
						Manage police officers and their information
					</p>
				</div>
				<Button
					onClick={() => navigate("/police/officers/add")}
					title="Add new officer (Ctrl+N)"
					className="flex-shrink-0"
				>
					<Plus className="mr-2 h-4 w-4" />
					{isMobile ? "Add" : "Add Officer"}
				</Button>
			</div>

			{/* Bulk Actions */}
			{(bulkSelection.selectedCount > 0 ||
				bulkSelection.isSelectAllInDatabase) && (
				<BulkActions
					selectedCount={bulkSelection.selectedCount}
					totalCount={officers.length}
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
					totalDatabaseCount={officersResponse?.count}
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
								? "Search officers..."
								: "Search officers by name, badge number..."
						}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>

				{/* Filters */}
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
										Export{" "}
										<ChevronDown className="ml-2 h-4 w-4" />
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

					{/* Station Filter */}
					<Select
						value={filters.stationFilter}
						onValueChange={(value) =>
							updateFilter("stationFilter", value)
						}
					>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue placeholder="All Stations" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Stations</SelectItem>
							{stations.map((station) => (
								<SelectItem
									key={station.id}
									value={station.id.toString()}
								>
									{station.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Rank Filter */}
					<Select
						value={filters.rankFilter}
						onValueChange={(value) =>
							updateFilter("rankFilter", value)
						}
					>
						<SelectTrigger className="w-full sm:w-[180px]">
							<SelectValue placeholder="All Ranks" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Ranks</SelectItem>
							{officerRankOptions.map((rank) => (
								<SelectItem key={rank.value} value={rank.value}>
									{rank.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					{/* Sworn Status Filter */}
					<Select
						value={filters.swornFilter}
						onValueChange={(value) =>
							updateFilter("swornFilter", value)
						}
					>
						<SelectTrigger className="w-full sm:w-[140px]">
							<SelectValue placeholder="All Officers" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All Officers</SelectItem>
							<SelectItem value="true">Sworn Only</SelectItem>
							<SelectItem value="false">Unsworn Only</SelectItem>
						</SelectContent>
					</Select>

					{/* Reset Filters */}
					<Button
						variant="outline"
						onClick={handleResetFilters}
						title="Reset all filters (Ctrl+R)"
						className="flex-shrink-0"
					>
						<RotateCcw className="mr-2 h-4 w-4" />
						{isMobile ? "Reset" : "Reset Filters"}
					</Button>
				</div>
			</div>

			{/* Results Count and Include Unknown Checkbox */}
			{officersResponse && (
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="text-sm text-muted-foreground">
						{officersResponse.count === 0
							? "No officers found"
							: `${officersResponse.count} officer${
									officersResponse.count === 1 ? "" : "s"
							  } found`}
						{bulkSelection.selectedCount > 0 && (
							<span className="ml-2 text-blue-600">
								({bulkSelection.selectedCount} selected)
							</span>
						)}
					</div>
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-6">
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-6">
							<div className="flex items-center space-x-2">
								<Checkbox
									id="include-unknown"
									checked={filters.includeUnknown}
									disabled={filters.unknownOnly}
									onCheckedChange={(checked) =>
										handleIncludeUnknownChange(
											checked as boolean
										)
									}
								/>
								<label
									htmlFor="include-unknown"
									className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${
										filters.unknownOnly
											? "opacity-50 cursor-not-allowed"
											: ""
									}`}
								>
									Include unknown ranks
								</label>
							</div>
							<div className="flex items-center space-x-2">
								<Checkbox
									id="unknown-only"
									checked={filters.unknownOnly}
									onCheckedChange={(checked) =>
										handleUnknownOnlyChange(
											checked as boolean
										)
									}
								/>
								<label
									htmlFor="unknown-only"
									className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-orange-600 dark:text-orange-400"
								>
									Show unknown/other ranks only
								</label>
							</div>
						</div>
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
					</div>
				</div>
			)}

			{/* Table */}
			<div className="rounded-md border overflow-hidden">
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-[50px]">
									<IndeterminateCheckbox
										checked={bulkSelection.isAllSelected}
										indeterminate={
											bulkSelection.isIndeterminate
										}
										onCheckedChange={
											bulkSelection.toggleAll
										}
										aria-label="Select all officers"
									/>
								</TableHead>
								<TableHead>Badge Number</TableHead>
								<TableHead>
									<Button
										variant="ghost"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() => handleSort("last_name")}
									>
										Name
										{getSortIcon("last_name")}
									</Button>
								</TableHead>
								<TableHead>
									<Button
										variant="ghost"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() => handleSort("rank")}
									>
										Rank
										{getSortIcon("rank")}
									</Button>
								</TableHead>
								<TableHead>
									<Button
										variant="ghost"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() => handleSort("station")}
									>
										Station
										{getSortIcon("station")}
									</Button>
								</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="w-[70px]">
									Actions
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
											<Skeleton className="h-4 w-20" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-32" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-24" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-28" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-16" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-8 w-8" />
										</TableCell>
									</TableRow>
								))
							) : error ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="text-center py-8"
									>
										<div className="text-muted-foreground">
											Error loading officers. Please try
											again.
										</div>
									</TableCell>
								</TableRow>
							) : officers.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={7}
										className="text-center py-8"
									>
										<div className="text-muted-foreground">
											{hasActiveFilters
												? "No officers match your search criteria."
												: "No officers found. Create your first officer to get started."}
										</div>
									</TableCell>
								</TableRow>
							) : (
								officers.map((officer) => (
									<TableRow key={officer.id}>
										<TableCell>
											<Checkbox
												checked={bulkSelection.isSelected(
													officer.id
												)}
												onCheckedChange={() =>
													bulkSelection.toggleItem(
														officer.id
													)
												}
												aria-label={`Select officer ${officer.full_name}`}
											/>
										</TableCell>
										<TableCell className="font-medium">
											{officer.badge_number || "—"}
										</TableCell>
										<TableCell>
											{officer.full_name}
										</TableCell>
										<TableCell>
											<div className="flex items-center gap-2">
												{officer.is_sworn && (
													<span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
														Sworn
													</span>
												)}
												{officer.rank_display}
											</div>
										</TableCell>
										<TableCell>
											{officer.station_name || "—"}
										</TableCell>
										<TableCell>
											<span
												className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
													officer.is_sworn
														? "bg-green-50 text-green-700 ring-green-600/20"
														: "bg-gray-50 text-gray-700 ring-gray-600/20"
												}`}
											>
												{officer.is_sworn
													? "Active"
													: "Unsworn"}
											</span>
										</TableCell>
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
															handleEdit(officer)
														}
													>
														Edit Officer
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() =>
															handleDelete(
																officer
															)
														}
														className="text-destructive"
													>
														Delete Officer
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
			</div>

			{/* Unified Pagination */}
			{officersResponse && (
				<TablePagination
					currentPage={pagination.currentPage}
					totalPages={pagination.totalPages}
					totalItems={officersResponse.count}
					itemsShown={officers.length}
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
				title="Officers Table Shortcuts"
				description="Use these keyboard shortcuts to work with the officers table more efficiently."
			/>
		</div>
	);
};
