import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router";

import { observer } from "mobx-react-lite";
import { useDebounce } from "@/shared/hooks/core";
import { useUsersTableFilters } from "@/shared/hooks/data";
import { useServerPagination } from "@/shared/hooks/data";
import { useBulkSelection } from "@/shared/hooks/data";
import { useBreakpoint } from "@/shared/hooks/ui";
import { useKeyboardShortcuts, commonShortcuts } from "@/shared/hooks/ui";
import { useExport } from "@/shared/hooks/data/useExport";

import {
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
	ChevronDown,
	EllipsisVertical,
	Search,
	Plus,
	RotateCcw,
	Keyboard,
	Loader2,
} from "lucide-react";
import { MdDelete, MdEdit, MdScience } from "react-icons/md";
import { CgSmileNone } from "react-icons/cg";
import { FaUserShield, FaUsers } from "react-icons/fa6";

// UI Components
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Button } from "@/shared/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Input } from "@/shared/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { IndeterminateCheckbox } from "@/shared/components/ui/custom/indeterminate-checkbox";
import {
	BulkActions,
	commonBulkActions,
} from "@/shared/components/ui/custom/bulk-actions";
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import { TablePagination } from "@/shared/components/ui/custom/table-pagination";

// Feature imports
import { useUsers } from "@/features/user/hooks/useUsers";

import { type IUser } from "@/features/user/types/users.types";
import type { UserRole } from "@/shared/types/backend-api.types";
import { ENDPOINTS } from "@/shared/services/api";

// Utils
import { cn } from "@/shared/utils";
import { logger } from "@/shared/services/logger.service";
import { getErrorMessage } from "@/shared/utils/error.utils";
import {
	exportToCSV,
	exportToJSON,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import { toast } from "sonner";
import SectionWrapper from "@/shared/components/layout/SectionWrapper";

// Stable default filters object to prevent re-renders
const DEFAULT_USERS_FILTERS = {
	roleFilter: "all" as const,
	statusFilter: "all" as const,
	sortField: "email" as const,
	sortDirection: "asc" as const,
};

const AllUsersTable = observer(() => {
	const navigate = useNavigate();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const { isMobile } = useBreakpoint();

	// Search state (not persisted)
	const [searchQuery, setSearchQuery] = useState("");
	const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

	// Persistent filter state
	const { filters, updateFilter, resetFilters } = useUsersTableFilters(
		DEFAULT_USERS_FILTERS
	);

	// Server-side pagination
	const pagination = useServerPagination({
		initialPage: 1,
		enableGlobalPageSize: true,
	});

	// Debounce search query to avoid filtering on every keystroke
	const debouncedSearchQuery = useDebounce(searchQuery, 300); // 300ms delay

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
			role:
				filters.roleFilter !== "all"
					? (filters.roleFilter as UserRole)
					: undefined,
			is_active:
				filters.statusFilter === "active"
					? true
					: filters.statusFilter === "inactive"
					? false
					: undefined,
			ordering: ordering,
		}),
		[
			pagination.currentPage,
			pagination.pageSize,
			debouncedSearchQuery,
			filters.roleFilter,
			filters.statusFilter,
			ordering,
		]
	);

	// GET USER DATA with server-side pagination
	const { usersData, isLoading, error } = useUsers(searchParams);

	// Extract users and update pagination when data changes
	const users = useMemo(() => usersData?.results || [], [usersData?.results]);

	useEffect(() => {
		if (usersData) {
			// Update pagination total when data changes
			(pagination as any).updateTotalItems(usersData.count || 0);
			logger.debug("Users data loaded", {
				count: users.length,
				total: usersData.count,
				page: pagination.currentPage,
			});
		}
	}, [usersData, users.length, pagination]);

	// Bulk selection with database-wide support
	const bulkSelection = useBulkSelection({
		items: users,
		getItemId: (user) => user.id,
		totalDatabaseCount: usersData?.count || 0,
	});

	// Centralized export functionality
	const exportHook = useExport({
		entityName: "users",
		exportEndpoint: ENDPOINTS.USERS.EXPORT,
		getCurrentFilters: () => {
			const additionalParams: Record<string, string | number | boolean> =
				{};
			if (filters.roleFilter !== "all") {
				additionalParams.role = filters.roleFilter as string;
			}
			if (filters.statusFilter === "active") {
				additionalParams.is_active = "true";
			} else if (filters.statusFilter === "inactive") {
				additionalParams.is_active = "false";
			}
			return {
				searchQuery: debouncedSearchQuery || undefined,
				ordering: ordering || undefined,
				additionalParams,
			};
		},
	});

	// Reset filters function
	const handleResetFilters = () => {
		setSearchQuery("");
		resetFilters(); // This will reset all filters to defaults and persist to server
		pagination.firstPage(); // Reset to first page
		bulkSelection.clearSelection();
	};

	// Export functions for selected items (local data)
	const handleExportSelectedCSV = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("users_selected", "csv");

		exportToCSV(dataToExport, commonExportColumns.user, { filename });
		toast.success(`Exported ${dataToExport.length} users to CSV`);
	}, [bulkSelection]);

	const handleExportSelectedJSON = useCallback(() => {
		const dataToExport = bulkSelection.getSelectedItems();
		const filename = generateFilename("users_selected", "json");

		exportToJSON(dataToExport, commonExportColumns.user, { filename });
		toast.success(`Exported ${dataToExport.length} users to JSON`);
	}, [bulkSelection]);

	// Export functions for all data in database

	// Bulk delete function
	const handleBulkDelete = () => {
		const selectedUsers = bulkSelection.getSelectedItems();
		const nonSuperUsers = selectedUsers.filter(
			(user: IUser) => !user.is_superuser
		);

		if (nonSuperUsers.length === 0) {
			toast.error("Cannot delete super admin users");
			return;
		}

		if (nonSuperUsers.length < selectedUsers.length) {
			toast.warning("Super admin users will be skipped");
		}

		// For now, just show a confirmation toast
		// In a real implementation, you'd show a confirmation dialog
		toast.info(
			`Would delete ${nonSuperUsers.length} users (confirmation dialog would appear)`
		);
	};

	// TABLE DEFINITIONS - Memoized to prevent infinite re-renders
	const roleIconMapping = useMemo(
		() => ({
			none: <CgSmileNone />,
			botanist: <MdScience />,
			finance: <FaUserShield />,
		}),
		[]
	);

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
				action: () => navigate("/users/add"),
				description: "Create new user",
			},
		],
		[bulkSelection, exportHook, navigate]
	);

	useKeyboardShortcuts({ shortcuts });

	// Loading state with better skeleton
	if (isLoading) {
		return (
			<SectionWrapper variant="minimal">
				<div className="w-full space-y-4">
					{/* Header skeleton */}
					<div className="flex items-center justify-between py-4">
						<Skeleton className="h-10 w-64" />
						<div className="flex gap-2">
							<Skeleton className="h-10 w-24" />
							<Skeleton className="h-10 w-32" />
						</div>
					</div>

					{/* Table skeleton */}
					<div className="rounded-md border">
						<div className="p-4">
							{Array(8)
								.fill(0)
								.map((_, i) => (
									<Skeleton
										key={i}
										className="h-16 w-full mb-2"
									/>
								))}
						</div>
					</div>
				</div>
			</SectionWrapper>
		);
	}

	// Error state with better error handling
	if (error) {
		return (
			<SectionWrapper variant="minimal">
				<div className="text-center py-12">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
						<FaUsers className="h-6 w-6 text-red-600" />
					</div>
					<h3 className="mt-2 text-sm font-semibold text-gray-900">
						Error loading users
					</h3>
					<p className="mt-1 text-sm text-gray-500">
						{getErrorMessage(error)}
					</p>
					<div className="mt-6 flex gap-2 justify-center">
						<Button onClick={handleResetFilters} variant="outline">
							<RotateCcw className="mr-2 h-4 w-4" />
							Reset Filters
						</Button>
						<Button
							onClick={() => navigate("/users/add")}
							variant="default"
						>
							<Plus className="mr-2 h-4 w-4" />
							Invite User
						</Button>
					</div>
				</div>
			</SectionWrapper>
		);
	}

	return (
		<SectionWrapper variant="minimal">
			<div className="w-full">
				{/* Bulk Actions */}
				{(bulkSelection.selectedCount > 0 ||
					bulkSelection.isSelectAllInDatabase) && (
					<BulkActions
						selectedCount={bulkSelection.selectedCount}
						totalCount={users.length}
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
						totalDatabaseCount={usersData?.count}
						isSelectAllInDatabase={
							bulkSelection.isSelectAllInDatabase
						}
						onToggleSelectAllInDatabase={
							bulkSelection.toggleSelectAllInDatabase
						}
					/>
				)}

				{/* Enhanced header with search and filters */}
				<div className="flex flex-col gap-4 py-4">
					{/* Top row: Search and actions */}
					<div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
						<div className="flex items-center gap-2 flex-1 max-w-full sm:max-w-md">
							<div className="relative flex-1 pl-[1px]">
								<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
								<Input
									ref={searchInputRef}
									placeholder={
										isMobile
											? "Search users..."
											: "Search users by name, email, or ID..."
									}
									value={searchQuery}
									onChange={(e) =>
										setSearchQuery(e.target.value)
									}
									className="pl-10"
								/>
							</div>
						</div>

						<div className="flex gap-2 flex-wrap sm:flex-nowrap">
							<Button
								variant="outline"
								onClick={handleResetFilters}
								size="sm"
								title="Reset all filters (Ctrl+R)"
							>
								<RotateCcw className="h-4 w-4" />
							</Button>

							{/* Export button (when no selection) */}
							{bulkSelection.selectedCount === 0 &&
								!bulkSelection.isSelectAllInDatabase && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="outline"
												size="sm"
												disabled={
													exportHook.isExporting
												}
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
												disabled={
													exportHook.isExporting
												}
											>
												Export All as CSV
											</DropdownMenuItem>
											<DropdownMenuItem
												onClick={exportHook.exportJSON}
												disabled={
													exportHook.isExporting
												}
											>
												Export All as JSON
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}

							{/* Add user button */}
							<Button
								variant="default"
								onClick={() => navigate("/users/add")}
								size="sm"
								title="Add new user (Ctrl+N)"
								className="flex-shrink-0"
							>
								<Plus className="mr-2 h-4 w-4" />
								{isMobile ? "Invite" : "Invite User"}
							</Button>
						</div>
					</div>

					{/* Second row: Filters */}
					<div className="flex flex-col sm:flex-row sm:items-center gap-4">
						<div className="flex flex-col sm:flex-row gap-4">
							<div className="flex items-center gap-2">
								<span className="text-sm font-medium whitespace-nowrap">
									Role:
								</span>
								<Select
									value={filters.roleFilter}
									onValueChange={(value) =>
										updateFilter("roleFilter", value)
									}
								>
									<SelectTrigger className="w-full sm:w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">
											All Roles
										</SelectItem>
										<SelectItem value="botanist">
											Botanist
										</SelectItem>
										<SelectItem value="finance">
											Finance
										</SelectItem>
										<SelectItem value="none">
											No Role
										</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-center gap-2">
								<span className="text-sm font-medium whitespace-nowrap">
									Status:
								</span>
								<Select
									value={filters.statusFilter}
									onValueChange={(value) =>
										updateFilter("statusFilter", value)
									}
								>
									<SelectTrigger className="w-full sm:w-32">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										<SelectItem value="active">
											Active
										</SelectItem>
										<SelectItem value="inactive">
											Inactive
										</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Selection count (if any) */}
						{bulkSelection.selectedCount > 0 && (
							<div className="text-sm text-blue-600">
								{bulkSelection.selectedCount} selected
							</div>
						)}

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
										onCheckedChange={
											bulkSelection.toggleAll
										}
										aria-label="Select all users"
									/>
								</TableHead>

								{/* ID Column (hidden on mobile) */}
								{!isMobile && (
									<TableHead className="w-20 text-center">
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
								)}

								{/* Name Column */}
								<TableHead>
									<Button
										variant="ghost"
										size="sm"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() => handleSort("full_name")}
									>
										Name
										{getSortIcon("full_name")}
									</Button>
								</TableHead>

								{/* Email Column (hidden on mobile) */}
								{!isMobile && (
									<TableHead>
										<Button
											variant="ghost"
											size="sm"
											className="h-auto p-0 font-semibold hover:bg-transparent"
											onClick={() => handleSort("email")}
										>
											Email
											{getSortIcon("email")}
										</Button>
									</TableHead>
								)}

								{/* Role Column */}
								<TableHead>
									<Button
										variant="ghost"
										size="sm"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() => handleSort("role")}
									>
										Role
										{getSortIcon("role")}
									</Button>
								</TableHead>

								{/* Status Column */}
								<TableHead>
									<Button
										variant="ghost"
										size="sm"
										className="h-auto p-0 font-semibold hover:bg-transparent"
										onClick={() => handleSort("is_active")}
									>
										Status
										{getSortIcon("is_active")}
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
										{!isMobile && (
											<TableCell>
												<Skeleton className="h-4 w-8" />
											</TableCell>
										)}
										<TableCell>
											<Skeleton className="h-4 w-32" />
										</TableCell>
										{!isMobile && (
											<TableCell>
												<Skeleton className="h-4 w-48" />
											</TableCell>
										)}
										<TableCell>
											<Skeleton className="h-4 w-24" />
										</TableCell>
										{!isMobile && (
											<TableCell>
												<Skeleton className="h-4 w-20" />
											</TableCell>
										)}
										<TableCell>
											<Skeleton className="h-8 w-8" />
										</TableCell>
									</TableRow>
								))
							) : error ? (
								<TableRow>
									<TableCell
										colSpan={isMobile ? 5 : 7}
										className="h-24 text-center"
									>
										<div className="text-muted-foreground">
											<p>Error loading users</p>
											<p className="text-sm">
												{getErrorMessage(error)}
											</p>
										</div>
									</TableCell>
								</TableRow>
							) : users.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={isMobile ? 5 : 7}
										className="h-24 text-center"
									>
										<div className="flex flex-col items-center gap-2">
											<FaUsers className="h-8 w-8 text-gray-400" />
											<div>
												<p className="text-sm font-medium text-gray-900">
													No users found
												</p>
												<p className="text-sm text-gray-500">
													{searchQuery ||
													filters.roleFilter !==
														"all" ||
													filters.statusFilter !==
														"all"
														? "Try adjusting your search or filters"
														: "Get started by adding your first user"}
												</p>
											</div>
											{!searchQuery &&
												filters.roleFilter === "all" &&
												filters.statusFilter ===
													"all" && (
													<Button
														onClick={() =>
															navigate(
																"/users/add"
															)
														}
														variant="outline"
														size="sm"
													>
														<Plus className="mr-2 h-4 w-4" />
														Invite User
													</Button>
												)}
										</div>
									</TableCell>
								</TableRow>
							) : (
								users.map((user) => (
									<TableRow key={user.id}>
										{/* Bulk selection checkbox */}
										<TableCell>
											<Checkbox
												checked={bulkSelection.isSelected(
													user.id
												)}
												onCheckedChange={() =>
													bulkSelection.toggleItem(
														user.id
													)
												}
												aria-label={`Select user ${user.full_name}`}
											/>
										</TableCell>

										{/* ID (hidden on mobile) */}
										{!isMobile && (
											<TableCell className="font-mono text-xs text-gray-500 text-center">
												{user.id}
											</TableCell>
										)}

										{/* Name */}
										<TableCell>
											<div className="flex flex-col">
												<div className="font-medium">
													{user.full_name}
												</div>
												{user.employee_id && (
													<div className="text-xs text-gray-500">
														ID: {user.employee_id}
													</div>
												)}
												{/* Show email on mobile */}
												{isMobile && (
													<div className="text-xs text-gray-500 lowercase">
														{user.email}
													</div>
												)}
											</div>
										</TableCell>

										{/* Email (hidden on mobile) */}
										{!isMobile && (
											<TableCell className="lowercase text-sm">
												{user.email}
											</TableCell>
										)}

										{/* Role */}
										<TableCell>
											<div className="flex items-center gap-2">
												<div
													className={cn(
														"text-start font-medium",
														user.is_superuser
															? "text-yellow-600"
															: user.role ===
															  "botanist"
															? "text-green-600"
															: user.role ===
															  "finance"
															? "text-purple-600"
															: "text-gray-600"
													)}
												>
													{user.is_superuser ? (
														<FaUserShield />
													) : (
														roleIconMapping[
															user.role as keyof typeof roleIconMapping
														] || <CgSmileNone />
													)}
												</div>
												<span className="text-sm font-medium">
													{user.is_superuser
														? "Super Admin"
														: user.role ===
														  "botanist"
														? "Botanist"
														: user.role ===
														  "finance"
														? "Finance"
														: "No Role"}
												</span>
											</div>
										</TableCell>

										{/* Status */}
										<TableCell>
											{user.is_active ? (
												<Badge
													variant="default"
													className="bg-green-100 text-green-800 w-fit"
												>
													Active
												</Badge>
											) : (
												<Badge
													variant="destructive"
													className="w-fit"
												>
													Inactive
												</Badge>
											)}
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
														<EllipsisVertical className="h-4 w-4" />
													</Button>
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() =>
															navigate(
																`/users/${user.id}`
															)
														}
													>
														<MdEdit className="mr-2 h-4 w-4 text-blue-500" />
														Edit User
													</DropdownMenuItem>
													<DropdownMenuSeparator />
													<DropdownMenuItem
														onClick={() =>
															navigate(
																`/users/${user.id}/delete`
															)
														}
														disabled={
															user.is_superuser
														}
														className={cn(
															user.is_superuser &&
																"opacity-50 cursor-not-allowed"
														)}
													>
														<MdDelete className="mr-2 h-4 w-4 text-red-500" />
														Delete User
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
				{usersData && (
					<TablePagination
						currentPage={pagination.currentPage}
						totalPages={pagination.totalPages}
						totalItems={usersData.count}
						itemsShown={users.length}
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
					title="Users Table Shortcuts"
					description="Use these keyboard shortcuts to work with the users table more efficiently."
				/>
			</div>
		</SectionWrapper>
	);
});

export default AllUsersTable;
