import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import {
	MoreHorizontal,
	Plus,
	Search,
	Edit,
	Trash2,
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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
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
import { Checkbox } from "@/shared/components/ui/checkbox";
import { IndeterminateCheckbox } from "@/shared/components/ui/custom/indeterminate-checkbox";
import {
	BulkActions,
	commonBulkActions,
} from "@/shared/components/ui/custom/bulk-actions";
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import { TablePagination } from "@/shared/components/ui/custom/table-pagination";
import { useDebounce } from "@/shared/hooks/core";
import { useServerPagination, useBulkSelection, useStationsTableFilters, useExport } from "@/shared/hooks/data";
import { useBreakpoint, useKeyboardShortcuts, commonShortcuts } from "@/shared/hooks/ui";
import { useStations } from "../../hooks/usePoliceStations";
import { ENDPOINTS } from "@/shared/services/api";
import {
	exportToCSV,
	exportToJSON,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import { toast } from "sonner";

import type { PoliceStation } from "@/shared/types/backend-api.types";

// Stable default filters object to prevent re-renders
const DEFAULT_STATIONS_FILTERS = {
	sortField: "name" as const,
	sortDirection: "asc" as const,
};

interface PoliceStationsTableProps {
	searchQuery?: string;
	onSearchChange?: (query: string) => void;
}

export function PoliceStationsTable({
	searchQuery: externalSearchQuery,
	onSearchChange,
}: PoliceStationsTableProps) {
	const navigate = useNavigate();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const { isMobile } = useBreakpoint();
	const [internalSearchQuery, setInternalSearchQuery] = useState("");
	const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

	// Persistent filter state
	const { filters, updateFilter, resetFilters } = useStationsTableFilters(
		DEFAULT_STATIONS_FILTERS
	);

	// Server-side pagination
	const pagination = useServerPagination({
		initialPage: 1,
		enableGlobalPageSize: true,
	});

	// Use external search query if provided, otherwise use internal
	const searchQuery = externalSearchQuery ?? internalSearchQuery;
	const debouncedSearchQuery = useDebounce(searchQuery, 300);

	// Build ordering string from persistent sort state
	const ordering =
		filters.sortDirection === "desc"
			? `-${filters.sortField}`
			: filters.sortField;

	// Handle search change
	const handleSearchChange = (value: string) => {
		if (onSearchChange) {
			onSearchChange(value);
		} else {
			setInternalSearchQuery(value);
		}
		pagination.firstPage(); // Reset to first page when searching
	};

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

	// Fetch stations with search, pagination, and ordering
	const { data, isLoading, error } = useStations(searchParams);

	const stations = useMemo(() => data?.results || [], [data?.results]);

	useEffect(() => {
		if (data) {
			// Update pagination total when data changes
			(pagination as any).updateTotalItems(data.count || 0);
		}
	}, [data, pagination]);

	// Bulk selection with database-wide support
	const bulkSelection = useBulkSelection({
		items: stations,
		getItemId: (station) => station.id,
		totalDatabaseCount: data?.count || 0,
	});

	// Centralized export functionality
	const exportHook = useExport({
		entityName: "police-stations",
		exportEndpoint: ENDPOINTS.POLICE.STATIONS.EXPORT,
		getCurrentFilters: () => ({
			searchQuery: debouncedSearchQuery || undefined,
			ordering: ordering,
		}),
	});

	// Export functions for selected items (local data)
	const handleExportSelectedCSV = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("police_stations_selected", "csv");

		exportToCSV(dataToExport, commonExportColumns.policeStation, {
			filename,
		});
		toast.success(`Exported ${dataToExport.length} stations to CSV`);
	}, [bulkSelection]);

	const handleExportSelectedJSON = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("police_stations_selected", "json");

		exportToJSON(dataToExport, commonExportColumns.policeStation, {
			filename,
		});
		toast.success(`Exported ${dataToExport.length} stations to JSON`);
	}, [bulkSelection]);

	const handleEdit = (station: PoliceStation) => {
		navigate(`/police/stations/${station.id}`);
	};

	const handleDelete = (station: PoliceStation) => {
		navigate(`/police/stations/${station.id}/delete`);
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
		pagination.firstPage(); // Reset to first page when sorting changes
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

	// Reset filters function
	const handleResetFilters = () => {
		if (onSearchChange) {
			onSearchChange("");
		} else {
			setInternalSearchQuery("");
		}
		resetFilters(); // This will reset all filters to defaults and persist to server
		pagination.firstPage(); // Reset to first page
		bulkSelection.clearSelection();
	};

	// Bulk delete function
	const handleBulkDelete = () => {
		const selectedStations = bulkSelection.getSelectedItems();
		const stationsWithOfficers = selectedStations.filter(
			(station: PoliceStation) => (station.officer_count || 0) > 0
		);

		if (stationsWithOfficers.length > 0) {
			toast.error(
				`Cannot delete ${stationsWithOfficers.length} stations with assigned officers`
			);
			return;
		}

		toast.info(
			`Would delete ${selectedStations.length} stations (confirmation dialog would appear)`
		);
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
				action: () => navigate("/police/stations/add"),
				description: "Create new station",
			},
		],
		[bulkSelection, exportHook, navigate]
	);

	useKeyboardShortcuts({ shortcuts });

	if (error) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="text-center">
					<p className="text-red-600 mb-2">
						Failed to load police stations
					</p>
					<p className="text-sm text-gray-500">
						{error instanceof Error
							? error.message
							: "An unexpected error occurred"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* Bulk Actions */}
			{(bulkSelection.selectedCount > 0 ||
				bulkSelection.isSelectAllInDatabase) && (
				<BulkActions
					selectedCount={bulkSelection.selectedCount}
					totalCount={stations.length}
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
					totalDatabaseCount={data?.count}
					isSelectAllInDatabase={bulkSelection.isSelectAllInDatabase}
					onToggleSelectAllInDatabase={
						bulkSelection.toggleSelectAllInDatabase
					}
				/>
			)}

			{/* Header with search and create button */}
			<div className="space-y-4">
				{/* Search row */}
				<div className="relative">
					<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						ref={searchInputRef}
						placeholder={
							isMobile ? "Search..." : "Search stations..."
						}
						value={searchQuery}
						onChange={(e) => handleSearchChange(e.target.value)}
						className="pl-8 w-full"
					/>
				</div>

				{/* Controls row */}
				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
						{/* Action buttons */}
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								onClick={handleResetFilters}
								title="Reset all filters (Ctrl+R)"
								size="sm"
							>
								<RotateCcw className="mr-2 h-4 w-4" />
								{isMobile ? "Reset" : "Reset Filters"}
							</Button>

							{/* Add button on mobile - next to reset */}
							{isMobile && (
								<Button
									onClick={() =>
										navigate("/police/stations/add")
									}
									title="Add new station (Ctrl+N)"
									size="sm"
								>
									<Plus className="h-4 w-4 mr-2" />
									Add
								</Button>
							)}

							{/* Export button (when no selection) - hide on mobile */}
							{bulkSelection.selectedCount === 0 && !isMobile && (
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button variant="outline" size="sm">
											Export{" "}
											<ChevronDown className="ml-2 h-4 w-4" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem
											onClick={exportHook.exportCSV}
										>
											Export as CSV
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={exportHook.exportJSON}
										>
											Export as JSON
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</div>

						{/* Stats and shortcuts - wrap to new line on medium screens */}
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
							<div className="text-sm text-muted-foreground">
								{data?.count || 0} station
								{(data?.count || 0) !== 1 ? "s" : ""}
								{bulkSelection.selectedCount > 0 && (
									<span className="ml-2 text-blue-600">
										({bulkSelection.selectedCount} selected)
									</span>
								)}
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

					{/* Add button on desktop - separate from other controls */}
					{!isMobile && (
						<Button
							onClick={() => navigate("/police/stations/add")}
							title="Add new station (Ctrl+N)"
							className="flex-shrink-0"
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Station
						</Button>
					)}
				</div>
			</div>

			{/* Table */}
			<div className="border rounded-md overflow-hidden">
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
										aria-label="Select all stations"
									/>
								</TableHead>
								<TableHead>
									<Button
										variant="ghost"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() => handleSort("name")}
									>
										Name
										{getSortIcon("name")}
									</Button>
								</TableHead>
								<TableHead>Address</TableHead>
								<TableHead>Phone</TableHead>
								<TableHead className="text-center">
									<Button
										variant="ghost"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() =>
											handleSort("officer_count")
										}
									>
										Officers
										{getSortIcon("officer_count")}
									</Button>
								</TableHead>
								<TableHead className="w-[50px]"></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								// Loading skeleton
								Array.from({ length: 5 }).map((_, index) => (
									<TableRow key={index}>
										<TableCell>
											<div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
										</TableCell>
										<TableCell>
											<div className="h-4 bg-gray-200 rounded animate-pulse" />
										</TableCell>
										<TableCell>
											<div className="h-4 bg-gray-200 rounded animate-pulse" />
										</TableCell>
										<TableCell>
											<div className="h-4 bg-gray-200 rounded animate-pulse" />
										</TableCell>
										<TableCell>
											<div className="h-4 bg-gray-200 rounded animate-pulse mx-auto w-8" />
										</TableCell>
										<TableCell>
											<div className="h-8 w-8 bg-gray-200 rounded animate-pulse" />
										</TableCell>
									</TableRow>
								))
							) : stations.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={6}
										className="text-center py-8"
									>
										{debouncedSearchQuery ? (
											<div>
												<p className="text-muted-foreground">
													No stations found matching "
													{debouncedSearchQuery}"
												</p>
												<Button
													variant="link"
													onClick={() =>
														handleSearchChange("")
													}
													className="mt-2"
												>
													Clear search
												</Button>
											</div>
										) : (
											<div>
												<p className="text-muted-foreground mb-2">
													No police stations found
												</p>
												<Button
													onClick={() =>
														navigate(
															"/police/stations/add"
														)
													}
												>
													<Plus className="h-4 w-4 mr-2" />
													Add your first station
												</Button>
											</div>
										)}
									</TableCell>
								</TableRow>
							) : (
								stations.map((station) => (
									<TableRow key={station.id}>
										<TableCell>
											<Checkbox
												checked={bulkSelection.isSelected(
													station.id
												)}
												onCheckedChange={() =>
													bulkSelection.toggleItem(
														station.id
													)
												}
												aria-label={`Select station ${station.name}`}
											/>
										</TableCell>
										<TableCell className="font-medium">
											{station.name}
										</TableCell>
										<TableCell
											className="max-w-xs truncate"
											title={station.address || undefined}
										>
											{station.address}
										</TableCell>
										<TableCell>{station.phone}</TableCell>
										<TableCell className="text-center">
											<span className="inline-flex items-center justify-center w-8 h-6 text-xs bg-blue-100 text-blue-800 rounded-full">
												{station.officer_count || 0}
											</span>
										</TableCell>
										<TableCell>
											<DropdownMenu>
												<DropdownMenuTrigger asChild>
													<Button
														variant="ghost"
														size="sm"
													>
														<MoreHorizontal className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() =>
															handleEdit(station)
														}
													>
														<Edit className="h-4 w-4 mr-2" />
														Edit
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() =>
															handleDelete(
																station
															)
														}
														className="text-red-600"
													>
														<Trash2 className="h-4 w-4 mr-2" />
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
			</div>

			{/* Unified Pagination */}
			{data && (
				<TablePagination
					currentPage={pagination.currentPage}
					totalPages={pagination.totalPages}
					totalItems={data.count}
					itemsShown={stations.length}
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
				title="Stations Table Shortcuts"
				description="Use these keyboard shortcuts to work with the stations table more efficiently."
			/>
		</div>
	);
}
