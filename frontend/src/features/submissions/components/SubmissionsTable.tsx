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
	FileText,
	Keyboard,
	Filter,
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
import { useServerPagination } from "@/shared/hooks/data/useServerPagination";
import { useSubmissionsTableFilters } from "@/shared/hooks/data/useTableFilterPersistence";
import { useSubmissions } from "../hooks/useSubmissions";
import { SubmissionsService } from "../services/submissions.service";
import {
	exportToCSV,
	exportToJSON,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import { toast } from "sonner";
import { UserSearchCombobox } from "@/features/user/components/forms/UserSearchCombobox";
import { OfficerSearchComboBox } from "@/features/police/components/officers/OfficerSearchComboBox";

import type {
	SubmissionTiny,
	SubmissionPhase,
} from "@/shared/types/backend-api.types";
import { cn } from "@/shared";

// Stable default filters object to prevent re-renders
const DEFAULT_SUBMISSIONS_FILTERS = {
	sortField: "received" as const,
	sortDirection: "desc" as const,
	phase: "all" as const,
	botanist: "all" as const,
	finance: "all" as const,
	requestingOfficer: "all" as const,
	draftOnly: false as const,
};

// Phase options for filtering (must match backend PhaseChoices)
const PHASE_OPTIONS = [
	{ value: "all", label: "All Phases" },
	{ value: "data_entry", label: "Data Entry" },
	{ value: "finance_approval", label: "Finance Approval" },
	{ value: "botanist_review", label: "Botanist Review" },
	{ value: "documents", label: "Documents" },
	{ value: "send_emails", label: "Send Emails" },
	{ value: "complete", label: "Complete" },
];

export const SubmissionsTable = () => {
	const navigate = useNavigate();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const { isMobile } = useBreakpoint();

	// Search state (not persisted)
	const [searchQuery, setSearchQuery] = useState("");
	const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

	// Persistent filter state
	const { filters, updateFilter, resetFilters } = useSubmissionsTableFilters(
		DEFAULT_SUBMISSIONS_FILTERS
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
	const searchParams = useMemo(() => {
		const params = {
			page: pagination.currentPage,
			limit: pagination.pageSize,
			search: debouncedSearchQuery || undefined,
			ordering: ordering,
			phase: filters.phase !== "all" ? filters.phase : undefined,
			botanist:
				filters.botanist !== "all"
					? (filters.botanist as number)
					: undefined,
			finance:
				filters.finance !== "all"
					? (filters.finance as number)
					: undefined,
			requesting_officer:
				filters.requestingOfficer !== "all"
					? (filters.requestingOfficer as number)
					: undefined,
			draft_only: filters.draftOnly ? true : undefined,
		};
		return params;
	}, [
		pagination.currentPage,
		pagination.pageSize,
		debouncedSearchQuery,
		ordering,
		filters.phase,
		filters.botanist,
		filters.finance,
		filters.requestingOfficer,
		filters.draftOnly,
	]);

	// Fetch data
	const { submissions, totalCount, isLoading, error } =
		useSubmissions(searchParams);

	useEffect(() => {
		if (totalCount !== undefined) {
			// Update pagination total when data changes
			(pagination as any).updateTotalItems(totalCount);
		}
	}, [totalCount, pagination]);

	// Bulk selection with database-wide support
	const bulkSelection = useBulkSelection<SubmissionTiny>({
		items: submissions,
		getItemId: (submission) => submission.id,
		totalDatabaseCount: totalCount || 0,
	});

	// Handle actions
	const handleEdit = (submission: SubmissionTiny) => {
		navigate(`/submissions/${submission.id}`);
	};

	const handleDelete = (submission: SubmissionTiny) => {
		navigate(`/submissions/${submission.id}/delete`);
	};

	const handleResetFilters = useCallback(() => {
		setSearchQuery("");
		resetFilters(); // This will reset all filters to defaults and persist to server
		pagination.firstPage(); // Reset to first page
		bulkSelection.clearSelection();
	}, [resetFilters, bulkSelection, pagination]);

	// Export functions for selected items (local data)
	const handleExportSelectedCSV = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("submissions_selected", "csv");

		exportToCSV(dataToExport, commonExportColumns.submission, {
			filename,
		});
		toast.success(`Exported ${dataToExport.length} submissions to CSV`);
	}, [bulkSelection]);

	const handleExportSelectedJSON = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("submissions_selected", "json");

		exportToJSON(dataToExport, commonExportColumns.submission, {
			filename,
		});
		toast.success(`Exported ${dataToExport.length} submissions to JSON`);
	}, [bulkSelection]);

	// Export all data (server-side)
	const handleExportAllCSV = useCallback(() => {
		// For now, export current page data - will implement server export later
		const filename = generateFilename("submissions_all", "csv");
		exportToCSV(submissions, commonExportColumns.submission, {
			filename,
		});
		toast.success(`Exported ${submissions.length} submissions to CSV`);
	}, [submissions]);

	const handleExportAllJSON = useCallback(() => {
		// For now, export current page data - will implement server export later
		const filename = generateFilename("submissions_all", "json");
		exportToJSON(submissions, commonExportColumns.submission, {
			filename,
		});
		toast.success(`Exported ${submissions.length} submissions to JSON`);
	}, [submissions]);

	// Bulk delete function
	const handleBulkDelete = () => {
		const selectedSubmissions = bulkSelection.getSelectedItems();
		// TODO: Add validation for submissions that cannot be deleted
		toast.info(
			`Would delete ${selectedSubmissions.length} submissions (confirmation dialog would appear)`
		);
	};

	// View submission details
	const handleViewDetails = (submission: SubmissionTiny) => {
		navigate(`/submissions/${submission.id}/detail`);
	};

	// Sorting functionality
	const handleSort = (field: string) => {
		if (filters.sortField === field) {
			// If already sorting by this field, toggle direction
			const newDirection =
				filters.sortDirection === "asc" ? "desc" : "asc";
			updateFilter("sortDirection", newDirection);
		} else {
			// If sorting by different field, start with descending for dates, ascending for others
			updateFilter("sortField", field);
			updateFilter(
				"sortDirection",
				field === "received" ? "desc" : "asc"
			);
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

	// Format date for display
	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleDateString();
	};

	// Keyboard shortcuts
	const shortcuts = useMemo(
		() => [
			commonShortcuts.table.selectAll(() => bulkSelection.toggleAll()),
			commonShortcuts.table.clearSelection(() =>
				bulkSelection.clearSelection()
			),
			commonShortcuts.table.search(() => searchInputRef.current?.focus()),
			commonShortcuts.table.export(() => handleExportAllCSV()),
			commonShortcuts.general.help(() => setShowShortcutsHelp(true)),
			{
				key: "n",
				ctrlKey: true,
				action: () => navigate("/submissions/add"),
				description: "Create new submission",
			},
			{
				key: "r",
				ctrlKey: true,
				action: handleResetFilters,
				description: "Reset filters",
			},
		],
		[bulkSelection, handleExportAllCSV, navigate, handleResetFilters]
	);

	useKeyboardShortcuts({ shortcuts });

	const hasActiveFilters =
		searchQuery ||
		filters.phase !== "all" ||
		filters.botanist !== "all" ||
		filters.finance !== "all" ||
		filters.requestingOfficer !== "all" ||
		filters.draftOnly;

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight">
						Submissions
					</h2>
					<p className="text-muted-foreground">
						Manage cannabis sample submissions and botanical
						assessments
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
						onClick={() => navigate("/submissions/add")}
						title="Add new submission (Ctrl+N)"
						className="flex-shrink-0"
					>
						<Plus className="mr-2 h-4 w-4" />
						{isMobile ? "Add" : "Add Submission"}
					</Button>
				</div>
			</div>

			{/* Bulk Actions */}
			{(bulkSelection.selectedCount > 0 ||
				bulkSelection.isSelectAllInDatabase) && (
					<BulkActions
						selectedCount={bulkSelection.selectedCount}
						totalCount={submissions.length}
						onClearSelection={bulkSelection.clearSelection}
						onExportSelectedCSV={handleExportSelectedCSV}
						onExportSelectedJSON={handleExportSelectedJSON}
						onExportAllCSV={handleExportAllCSV}
						onExportAllJSON={handleExportAllJSON}
						isExporting={false}
						actions={[
							commonBulkActions.delete(handleBulkDelete, false),
						]}
						totalDatabaseCount={totalCount}
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
								? "Search submissions..."
								: "Search by case number, officer, botanist, finance officer, or defendant..."
						}
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="pl-10"
					/>
				</div>

				{/* Filters */}
				<div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
					{/* Phase Filter */}
					<div className="flex items-center gap-2">
						<Filter className="h-4 w-4 text-muted-foreground" />
						<Select
							value={filters.phase}
							onValueChange={(value) =>
								updateFilter(
									"phase",
									value as SubmissionPhase | "all"
								)
							}
						>
							<SelectTrigger className="w-[180px]">
								<SelectValue placeholder="Filter by phase" />
							</SelectTrigger>
							<SelectContent>
								{PHASE_OPTIONS.map((option) => (
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

					{/* Botanist Filter */}
					<div className="w-[200px]">
						<UserSearchCombobox
							value={
								filters.botanist !== "all"
									? (filters.botanist as number)
									: null
							}
							onValueChange={(userId) =>
								updateFilter("botanist", userId || "all")
							}
							placeholder="Filter by botanist..."
							allowCreate={false}
						/>
					</div>

					{/* Finance Officer Filter */}
					<div className="w-[200px]">
						<UserSearchCombobox
							value={
								filters.finance !== "all"
									? (filters.finance as number)
									: null
							}
							onValueChange={(userId) =>
								updateFilter("finance", userId || "all")
							}
							placeholder="Filter by finance..."
							allowCreate={false}
						/>
					</div>

					{/* Requesting Officer Filter */}
					<div className="w-[200px]">
						<OfficerSearchComboBox
							value={
								filters.requestingOfficer !== "all"
									? (filters.requestingOfficer as number)
									: null
							}
							onValueChange={(officerId) =>
								updateFilter(
									"requestingOfficer",
									officerId || "all"
								)
							}
							placeholder="Filter by officer..."
							allowCreate={false}
						/>
					</div>

					{/* Draft Only Filter */}
					<div className="flex items-center space-x-2">
						<Checkbox
							id="draft-only"
							checked={filters.draftOnly}
							onCheckedChange={(checked) => {
								updateFilter("draftOnly", !!checked);
								pagination.firstPage();
							}}
						/>
						<label
							htmlFor="draft-only"
							className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
						>
							Draft only
						</label>
					</div>

					{/* Export button (when no selection) - hide on mobile */}
					{bulkSelection.selectedCount === 0 &&
						!bulkSelection.isSelectAllInDatabase &&
						!isMobile && (
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="outline" size="sm">
										Export{" "}
										<ChevronDown className="ml-2 h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem
										onClick={handleExportAllCSV}
									>
										Export All as CSV
									</DropdownMenuItem>
									<DropdownMenuItem
										onClick={handleExportAllJSON}
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
									aria-label="Select all submissions"
								/>
							</TableHead>

							{/* Status Column */}
							<TableHead className="w-24">
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 font-semibold hover:bg-transparent"
									onClick={() => handleSort("is_draft")}
								>
									Status
									{getSortIcon("is_draft")}
								</Button>
							</TableHead>

							{/* Received Date Column */}
							<TableHead>
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 font-semibold hover:bg-transparent"
									onClick={() => handleSort("received")}
								>
									Received
									{getSortIcon("received")}
								</Button>
							</TableHead>

							{/* Phase Column */}
							<TableHead>
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 font-semibold hover:bg-transparent"
									onClick={() => handleSort("phase")}
								>
									Phase
									{getSortIcon("phase")}
								</Button>
							</TableHead>

							{/* Case Number Column */}
							<TableHead className="text-right">
								<Button
									variant="ghost"
									size="sm"
									className="h-auto p-0 font-semibold hover:bg-transparent"
									onClick={() => handleSort("case_number")}
								>
									Case Number
									{getSortIcon("case_number")}
								</Button>
							</TableHead>

							{/* Botanist Column - hide on mobile */}
							{!isMobile && (
								<TableHead className="text-right">
									<Button
										variant="ghost"
										size="sm"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() =>
											handleSort(
												"approved_botanist__last_name"
											)
										}
									>
										Botanist
										{getSortIcon(
											"approved_botanist__last_name"
										)}
									</Button>
								</TableHead>
							)}

							{/* Finance Officer Column - hide on mobile */}
							{!isMobile && (
								<TableHead className="text-right">
									<Button
										variant="ghost"
										size="sm"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() =>
											handleSort(
												"finance_officer__last_name"
											)
										}
									>
										Finance Officer
										{getSortIcon(
											"finance_officer__last_name"
										)}
									</Button>
								</TableHead>
							)}

							{/* Requesting Officer Column - hide on mobile */}
							{!isMobile && (
								<TableHead className="text-right">
									<Button
										variant="ghost"
										size="sm"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() =>
											handleSort(
												"requesting_officer__last_name"
											)
										}
									>
										Requesting Officer
										{getSortIcon(
											"requesting_officer__last_name"
										)}
									</Button>
								</TableHead>
							)}

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
										<Skeleton className="h-4 w-32" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-6 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-20" />
									</TableCell>
									{!isMobile && (
										<TableCell>
											<Skeleton className="h-4 w-28" />
										</TableCell>
									)}
									{!isMobile && (
										<TableCell>
											<Skeleton className="h-4 w-28" />
										</TableCell>
									)}
									{!isMobile && (
										<TableCell>
											<Skeleton className="h-4 w-28" />
										</TableCell>
									)}
									<TableCell>
										<Skeleton className="h-6 w-8" />
									</TableCell>
									{!isMobile && (
										<TableCell>
											<Skeleton className="h-6 w-8" />
										</TableCell>
									)}
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
									colSpan={isMobile ? 6 : 10}
									className="h-24 text-center"
								>
									<div className="text-muted-foreground">
										<p>Error loading submissions</p>
										<p className="text-sm">
											{(error as Error)?.message ||
												"Please try again"}
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : submissions.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={isMobile ? 6 : 10}
									className="h-24 text-center"
								>
									<div className="text-muted-foreground">
										<FileText className="mx-auto h-12 w-12 opacity-50" />
										<p className="mt-2">
											{searchQuery || hasActiveFilters
												? "No submissions found"
												: "No submissions yet"}
										</p>
										<p className="text-sm">
											{searchQuery || hasActiveFilters
												? "Try adjusting your search or filters"
												: "Add your first submission to get started"}
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							submissions.map((submission) => (
								<TableRow key={submission.id}>
									{/* Bulk selection checkbox */}
									<TableCell>
										<Checkbox
											checked={bulkSelection.isSelected(
												submission.id
											)}
											onCheckedChange={() =>
												bulkSelection.toggleItem(
													submission.id
												)
											}
											aria-label={`Select submission ${submission.case_number}`}
										/>
									</TableCell>

									{/* Status (Draft/Official) */}
									<TableCell>
										<Badge
											variant={"default"}
											className={cn(
												submission.is_draft
													? "bg-red-100 text-red-800"
													: "bg-green-100 text-green-800"
											)}
										>
											{submission.is_draft
												? "Draft"
												: "Official"}
										</Badge>
									</TableCell>

									{/* Received Date */}
									<TableCell className="text-sm">
										{formatDate(submission.received)}
									</TableCell>

									{/* Phase */}
									<TableCell>
										<Badge
											className={SubmissionsService.getPhaseBadgeClass(
												submission.phase
											)}
										>
											{submission.phase_display}
										</Badge>
									</TableCell>

									{/* Case Number */}
									<TableCell className="font-mono font-medium text-right">
										{submission.case_number}
									</TableCell>

									{/* Botanist - hide on mobile */}
									{!isMobile && (
										<TableCell className="text-sm text-right">
											{submission.approved_botanist_name || (
												<span className="text-muted-foreground italic">
													—
												</span>
											)}
										</TableCell>
									)}

									{/* Finance Officer - hide on mobile */}
									{!isMobile && (
										<TableCell className="text-sm text-right">
											{submission.finance_officer_name || (
												<span className="text-muted-foreground italic">
													—
												</span>
											)}
										</TableCell>
									)}

									{/* Requesting Officer - hide on mobile */}
									{!isMobile && (
										<TableCell className="text-sm text-right">
											{submission.requesting_officer_name || (
												<span className="text-muted-foreground italic">
													—
												</span>
											)}
										</TableCell>
									)}

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
														handleViewDetails(
															submission
														)
													}
												>
													View Details
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														handleEdit(submission)
													}
												>
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														handleDelete(submission)
													}
													className="text-destructive"
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
			{totalCount !== undefined && totalCount > 0 && (
				<TablePagination
					currentPage={pagination.currentPage}
					totalPages={pagination.totalPages}
					totalItems={totalCount}
					itemsShown={submissions.length}
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
				title="Submissions Table Shortcuts"
				description="Use these keyboard shortcuts to work with the submissions table more efficiently."
			/>
		</div>
	);
};
