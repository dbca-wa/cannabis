import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import {
	MoreHorizontal,
	Plus,
	ArrowUpDown,
	ArrowUp,
	ArrowDown,
	RotateCcw,
	Keyboard,
	FileText,
	Download,
	Edit,
	Trash2,
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

import { IndeterminateCheckbox } from "@/shared/components/ui/custom/indeterminate-checkbox";
import { BulkActions } from "@/shared/components/ui/custom/bulk-actions";
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
import { useInvoices } from "../hooks/useInvoices";
import {
	exportToCSV,
	exportToJSON,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import { toast } from "sonner";

import type { Invoice } from "@/shared/types/backend-api.types";

export const InvoicesTable = () => {
	const navigate = useNavigate();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const { isMobile } = useBreakpoint();

	// State management
	const [searchQuery, setSearchQuery] = useState("");
	const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
	const [sortField, setSortField] = useState("created_at");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const debouncedSearchQuery = useDebounce(searchQuery, 300);

	// Server-side pagination
	const pagination = useServerPagination();

	// Fetch invoices with filters
	const {
		data: invoicesResponse,
		isLoading,
		error,
	} = useInvoices({
		page: pagination.currentPage,
		limit: pagination.pageSize,
		search: debouncedSearchQuery,
		ordering: sortDirection === "asc" ? sortField : `-${sortField}`,
	});

	// Update pagination when data changes
	useEffect(() => {
		if (invoicesResponse && invoicesResponse.count > 0) {
			const totalPages = Math.ceil(
				invoicesResponse.count / pagination.pageSize
			);
			// Only update if different to avoid infinite loops
			if (totalPages > 0 && pagination.currentPage > totalPages) {
				pagination.setPage(1);
			}
		}
	}, [invoicesResponse, pagination.pageSize]);

	// Memoize invoices array
	const invoices = useMemo(
		() => invoicesResponse?.results || [],
		[invoicesResponse?.results]
	);

	// Bulk selection
	const bulkSelection = useBulkSelection<Invoice>({
		items: invoices,
		getItemId: (invoice) => invoice.id,
	});

	// Handlers
	const handleSort = useCallback(
		(field: string) => {
			if (sortField === field) {
				setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
			} else {
				setSortField(field);
				setSortDirection("asc");
			}
		},
		[sortField]
	);

	const handleResetFilters = useCallback(() => {
		setSearchQuery("");
		setSortField("created_at");
		setSortDirection("desc");
		bulkSelection.clearSelection();
	}, [bulkSelection]);

	const handleExportCSV = useCallback(() => {
		const dataToExport =
			bulkSelection.selectedCount > 0
				? bulkSelection.getSelectedItems()
				: invoices;

		const columns = commonExportColumns.invoice;
		const filename = generateFilename("invoices", "csv");

		exportToCSV(dataToExport, columns, { filename });
		toast.success(
			`Exported ${dataToExport.length} invoice(s) to ${filename}`
		);
	}, [bulkSelection, invoices]);

	const handleExportJSON = useCallback(() => {
		const dataToExport =
			bulkSelection.selectedCount > 0
				? bulkSelection.getSelectedItems()
				: invoices;

		const columns = commonExportColumns.invoice;
		const filename = generateFilename("invoices", "json");

		exportToJSON(dataToExport, columns, { filename });
		toast.success(
			`Exported ${dataToExport.length} invoice(s) to ${filename}`
		);
	}, [bulkSelection, invoices]);

	// Navigation handlers
	const handleCreate = () => navigate("/docs/invoices/add");
	const handleEdit = (invoice: Invoice) =>
		navigate(`/docs/invoices/${invoice.id}`);
	const handleDelete = (invoice: Invoice) =>
		navigate(`/docs/invoices/${invoice.id}/delete`);

	// Keyboard shortcuts
	const shortcuts = useMemo(
		() => [
			commonShortcuts.table.selectAll(() => bulkSelection.toggleAll()),
			commonShortcuts.table.search(() => searchInputRef.current?.focus()),
			commonShortcuts.table.export(() => handleExportCSV()),
			{
				key: "n",
				ctrlKey: true,
				action: handleCreate,
				description: "New invoice",
			},
			{
				key: "r",
				ctrlKey: true,
				action: handleResetFilters,
				description: "Reset filters",
			},
		],
		[bulkSelection, handleExportCSV, handleCreate, handleResetFilters]
	);

	useKeyboardShortcuts({ shortcuts });

	// Get sort indicator icon
	const getSortIcon = (field: string) => {
		if (sortField !== field) {
			return <ArrowUpDown className="ml-2 h-4 w-4" />;
		}
		return sortDirection === "asc" ? (
			<ArrowUp className="ml-2 h-4 w-4" />
		) : (
			<ArrowDown className="ml-2 h-4 w-4" />
		);
	};

	// Format currency
	const formatCurrency = (amount: string | number) => {
		const num = typeof amount === "string" ? parseFloat(amount) : amount;
		return new Intl.NumberFormat("en-AU", {
			style: "currency",
			currency: "AUD",
		}).format(num);
	};

	// Render loading state
	if (isLoading && !invoices.length) {
		return (
			<div className="space-y-4">
				<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
					<Skeleton className="h-10 w-full sm:w-[300px]" />
					<div className="flex gap-2">
						<Skeleton className="h-10 w-[120px]" />
						<Skeleton className="h-10 w-[150px]" />
					</div>
				</div>
				<div className="rounded-md border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12">
									<Skeleton className="h-4 w-4" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-16" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-32" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-24" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-24" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-24" />
								</TableHead>
								<TableHead className="text-right">
									<Skeleton className="h-4 w-16 ml-auto" />
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{[...Array(5)].map((_, i) => (
								<TableRow key={i}>
									<TableCell>
										<Skeleton className="h-4 w-4" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-12" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-32" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-24" />
									</TableCell>
									<TableCell className="text-right">
										<Skeleton className="h-8 w-8 ml-auto" />
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</div>
		);
	}

	// Render error state
	if (error) {
		return (
			<div className="p-8 text-center">
				<FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
				<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
					Error Loading Invoices
				</h3>
				<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
					{error instanceof Error
						? error.message
						: "Failed to load invoices. Please try again."}
				</p>
				<Button onClick={() => window.location.reload()}>Retry</Button>
			</div>
		);
	}

	// Render empty state
	if (!isLoading && invoices.length === 0 && !debouncedSearchQuery) {
		return (
			<div className="space-y-4">
				<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
					<Input
						ref={searchInputRef}
						placeholder="Search invoices..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="max-w-sm"
					/>
					<Button onClick={handleCreate}>
						<Plus className="mr-2 h-4 w-4" />
						New Invoice
					</Button>
				</div>
				<div className="rounded-md border p-12 text-center">
					<FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
					<h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
						No Invoices Yet
					</h3>
					<p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
						Get started by creating your first invoice.
					</p>
					<Button onClick={handleCreate}>
						<Plus className="mr-2 h-4 w-4" />
						Create Invoice
					</Button>
				</div>
			</div>
		);
	}

	const totalPages = invoicesResponse
		? Math.ceil(invoicesResponse.count / pagination.pageSize)
		: 0;

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				<div className="flex-1 w-full sm:w-auto">
					<Input
						ref={searchInputRef}
						placeholder="Search invoices..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="max-w-sm"
					/>
				</div>
				<div className="flex gap-2 w-full sm:w-auto">
					<Button
						onClick={handleResetFilters}
						variant="outline"
						className="flex-1 sm:flex-none"
					>
						<RotateCcw className="mr-2 h-4 w-4" />
						Reset Filters
					</Button>
					<Button
						onClick={handleCreate}
						className="flex-1 sm:flex-none"
					>
						<Plus className="mr-2 h-4 w-4" />
						New Invoice
					</Button>
				</div>
			</div>

			{/* Bulk Actions */}
			{bulkSelection.selectedCount > 0 && (
				<BulkActions
					selectedCount={bulkSelection.selectedCount}
					totalCount={invoices.length}
					onClearSelection={bulkSelection.clearSelection}
					actions={[
						{
							id: "export-csv",
							label: "Export CSV",
							icon: <Download className="h-4 w-4" />,
							onClick: handleExportCSV,
						},
						{
							id: "export-json",
							label: "Export JSON",
							icon: <Download className="h-4 w-4" />,
							onClick: handleExportJSON,
						},
					]}
				/>
			)}

			{/* Table */}
			<div className="rounded-md border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-12">
								<IndeterminateCheckbox
									checked={bulkSelection.isAllSelected}
									indeterminate={
										bulkSelection.selectedCount > 0 &&
										!bulkSelection.isAllSelected
									}
									onCheckedChange={bulkSelection.toggleAll}
								/>
							</TableHead>
							<TableHead>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleSort("id")}
									className="-ml-3 h-8"
								>
									ID
									{getSortIcon("id")}
								</Button>
							</TableHead>
							<TableHead>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleSort("invoice_number")}
									className="-ml-3 h-8"
								>
									Invoice Number
									{getSortIcon("invoice_number")}
								</Button>
							</TableHead>
							<TableHead>Customer Number</TableHead>
							<TableHead>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleSort("total")}
									className="-ml-3 h-8"
								>
									Amount
									{getSortIcon("total")}
								</Button>
							</TableHead>
							<TableHead>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => handleSort("created_at")}
									className="-ml-3 h-8"
								>
									Created
									{getSortIcon("created_at")}
								</Button>
							</TableHead>
							<TableHead className="text-right">
								Actions
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{invoices.length === 0 ? (
							<TableRow>
								<TableCell
									colSpan={7}
									className="h-24 text-center"
								>
									<div className="flex flex-col items-center justify-center text-gray-500">
										<FileText className="h-8 w-8 mb-2" />
										<p>No invoices found</p>
										{debouncedSearchQuery && (
											<p className="text-sm mt-1">
												Try adjusting your search
											</p>
										)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							invoices.map((invoice) => (
								<TableRow key={invoice.id}>
									<TableCell>
										<IndeterminateCheckbox
											checked={bulkSelection.isSelected(
												invoice.id
											)}
											onCheckedChange={() =>
												bulkSelection.toggleItem(
													invoice.id
												)
											}
										/>
									</TableCell>
									<TableCell className="font-medium">
										{invoice.id}
									</TableCell>
									<TableCell className="font-mono text-sm">
										{invoice.invoice_number}
									</TableCell>
									<TableCell>
										{invoice.customer_number}
									</TableCell>
									<TableCell className="font-semibold">
										{formatCurrency(invoice.total)}
									</TableCell>
									<TableCell>
										{new Date(
											invoice.created_at
										).toLocaleDateString()}
									</TableCell>
									<TableCell className="text-right">
										<DropdownMenu>
											<DropdownMenuTrigger asChild>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
												>
													<MoreHorizontal className="h-4 w-4" />
													<span className="sr-only">
														Open menu
													</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{invoice.pdf_url && (
													<DropdownMenuItem
														onClick={() =>
															window.open(
																invoice.pdf_url!,
																"_blank"
															)
														}
													>
														<Download className="mr-2 h-4 w-4" />
														Download PDF
													</DropdownMenuItem>
												)}
												<DropdownMenuItem
													onClick={() =>
														handleEdit(invoice)
													}
												>
													<Edit className="mr-2 h-4 w-4" />
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() =>
														handleDelete(invoice)
													}
													className="text-red-600"
												>
													<Trash2 className="mr-2 h-4 w-4" />
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

			{/* Pagination */}
			{invoicesResponse && invoicesResponse.count > 0 && (
				<div className="flex items-center justify-between px-2">
					<div className="text-sm text-muted-foreground">
						Showing {invoices.length} of {invoicesResponse.count}{" "}
						invoices
					</div>
					<div className="flex items-center gap-4">
						{!isMobile && (
							<button
								onClick={() => setShowShortcutsHelp(true)}
								className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
								title="Show keyboard shortcuts (Shift + ?)"
							>
								<Keyboard className="h-3 w-3" />
								Shortcuts
							</button>
						)}
					</div>
				</div>
			)}

			<TablePagination
				currentPage={pagination.currentPage}
				totalPages={totalPages}
				totalItems={invoicesResponse?.count || 0}
				itemsShown={invoices.length}
				onPageChange={pagination.setPage}
				onPageSizeChange={pagination.setPageSize}
				isLoading={isLoading}
			/>

			{/* Keyboard Shortcuts Help Dialog */}
			<KeyboardShortcutsHelp
				open={showShortcutsHelp}
				onOpenChange={setShowShortcutsHelp}
				shortcuts={shortcuts}
			/>
		</div>
	);
};
