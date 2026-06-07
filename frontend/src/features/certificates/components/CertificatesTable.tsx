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

import { IndeterminateCheckbox } from "@/shared/components/ui/custom/indeterminate-checkbox";
import { BulkActions } from "@/shared/components/ui/custom/bulk-actions";
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import { TablePagination } from "@/shared/components/ui/custom/table-pagination";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useDebounce } from "@/shared/hooks/core/useDebounce";
import { useBulkSelection } from "@/shared/hooks/data/useBulkSelection";
import { useBreakpoint } from "@/shared/hooks/ui/useResponsive";
import {
	useKeyboardShortcuts,
	commonShortcuts,
} from "@/shared/hooks/ui/useKeyboardShortcuts";
import { useServerPagination } from "@/shared/hooks/data/useServerPagination";
import { useCertificates } from "../hooks/useCertificates";
import { useSignCertificate } from "@/features/signatures/hooks";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Badge } from "@/shared/components/ui/badge";
import { PenLine } from "lucide-react";
import {
	exportToCSV,
	exportToJSON,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import { toast } from "sonner";
import { formatDate } from "@/shared/utils/date.utils";

import type { Certificate } from "@/shared/types/backend-api.types";

export const CertificatesTable = () => {
	const navigate = useNavigate();
	const searchInputRef = useRef<HTMLInputElement>(null);
	const { isMobile } = useBreakpoint();
	const { user: currentUser } = useAuth();
	const signCertificateMutation = useSignCertificate();

	// State management
	const [searchQuery, setSearchQuery] = useState("");
	const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
	const [sortField, setSortField] = useState("created_at");
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
	const debouncedSearchQuery = useDebounce(searchQuery, 300);

	// Server-side pagination
	const pagination = useServerPagination();

	// Fetch certificates with filters
	const {
		data: certificatesResponse,
		isLoading,
		error,
		refetch: refetchCertificates,
	} = useCertificates({
		page: pagination.currentPage,
		limit: pagination.pageSize,
		search: debouncedSearchQuery,
		ordering: sortDirection === "asc" ? sortField : `-${sortField}`,
	});

	// Update pagination when data changes
	useEffect(() => {
		if (certificatesResponse && certificatesResponse.count > 0) {
			const totalPages = Math.ceil(
				certificatesResponse.count / pagination.pageSize
			);
			// Only update if different to avoid infinite loops
			if (totalPages > 0 && pagination.currentPage > totalPages) {
				pagination.setPage(1);
			}
		}
	}, [certificatesResponse, pagination]);

	// Memoize certificates array
	const certificates = useMemo(
		() => certificatesResponse?.results || [],
		[certificatesResponse?.results]
	);

	// Bulk selection
	const bulkSelection = useBulkSelection<Certificate>({
		items: certificates,
		getItemId: (cert) => cert.id,
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

	// eslint-disable-next-line react-hooks/preserve-manual-memoization
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
				: certificates;

		const columns = commonExportColumns.certificate;
		const filename = generateFilename("certificates", "csv");

		exportToCSV(dataToExport, columns, { filename });
		toast.success(
			`Exported ${dataToExport.length} certificate(s) to ${filename}`
		);
	}, [bulkSelection, certificates]);

	const handleExportJSON = useCallback(() => {
		const dataToExport =
			bulkSelection.selectedCount > 0
				? bulkSelection.getSelectedItems()
				: certificates;

		const columns = commonExportColumns.certificate;
		const filename = generateFilename("certificates", "json");

		exportToJSON(dataToExport, columns, { filename });
		toast.success(
			`Exported ${dataToExport.length} certificate(s) to ${filename}`
		);
	}, [bulkSelection, certificates]);

	// Navigation handlers
	const handleCreate = useCallback(
		() => navigate("/docs/certificates/add"),
		[navigate]
	);
	const handleEdit = (cert: Certificate) =>
		navigate(`/docs/certificates/${cert.id}`);
	const handleDelete = (cert: Certificate) =>
		navigate(`/docs/certificates/${cert.id}/delete`);

	// Keyboard shortcuts
	const shortcuts = useMemo(
		() => [
			commonShortcuts.table.selectAll(() => bulkSelection.toggleAll()),
			// eslint-disable-next-line react-hooks/refs
			commonShortcuts.table.search(() => searchInputRef.current?.focus()),
			commonShortcuts.table.export(() => handleExportCSV()),
			{
				key: "n",
				ctrlKey: true,
				action: handleCreate,
				description: "New certificate",
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

	// Render loading state
	if (isLoading && !certificates.length) {
		return (
			<div className="space-y-4">
				<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
					<Skeleton className="h-9 w-64 rounded-md" />
					<div className="flex gap-2">
						<Skeleton className="h-9 w-28 rounded-md" />
						<Skeleton className="h-9 w-36 rounded-md" />
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
									<Skeleton className="h-4 w-6" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-28" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-12" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-20" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-16" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-14" />
								</TableHead>
								<TableHead>
									<Skeleton className="h-4 w-14" />
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Array.from({ length: 5 }).map((_, i) => (
								<TableRow key={i}>
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
										<Skeleton className="h-4 w-20" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-28" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-4 w-20" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-5 w-16 rounded-full" />
									</TableCell>
									<TableCell>
										<Skeleton className="h-8 w-8 rounded-md ml-auto" />
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
				<FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
				<h3 className="text-lg font-semibold mb-2">
					Error Loading Certificates
				</h3>
				<p className="text-sm text-muted-foreground mb-4">
					{error instanceof Error
						? error.message
						: "Failed to load certificates. Please try again."}
				</p>
				<Button onClick={() => refetchCertificates()} variant="outline">
					Try Again
				</Button>
			</div>
		);
	}

	// Render empty state
	if (!isLoading && certificates.length === 0 && !debouncedSearchQuery) {
		return (
			<div className="space-y-4">
				<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
					<Input
						ref={searchInputRef}
						placeholder="Search certificates..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="max-w-sm"
					/>
					<Button onClick={handleCreate}>
						<Plus className="mr-2 h-4 w-4" />
						New Certificate
					</Button>
				</div>
				<div className="rounded-md border p-12 text-center">
					<FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
					<h3 className="text-lg font-semibold mb-2">
						No certificates generated yet
					</h3>
					<p className="text-sm text-muted-foreground mb-4">
						Certificates are generated when a case reaches the documents phase.
					</p>
				</div>
			</div>
		);
	}

	const totalPages = certificatesResponse
		? Math.ceil(certificatesResponse.count / pagination.pageSize)
		: 0;

	return (
		<div className="space-y-4">
			{/* Toolbar */}
			<div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
				<div className="flex-1 w-full sm:w-auto">
					<Input
						ref={searchInputRef}
						placeholder="Search certificates..."
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
					<Button onClick={handleCreate} className="flex-1 sm:flex-none">
						<Plus className="mr-2 h-4 w-4" />
						New Certificate
					</Button>
				</div>
			</div>

			{/* Bulk Actions */}
			{bulkSelection.selectedCount > 0 && (
				<BulkActions
					selectedCount={bulkSelection.selectedCount}
					totalCount={certificates.length}
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
									onClick={() => handleSort("certificate_number")}
									className="-ml-3 h-8"
								>
									Certificate Number
									{getSortIcon("certificate_number")}
								</Button>
							</TableHead>
							<TableHead>Case</TableHead>
							<TableHead>Defendant(s)</TableHead>
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
							<TableHead>Status</TableHead>
							<TableHead className="text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{certificates.length === 0 ? (
							<TableRow>
								<TableCell colSpan={8} className="h-48 text-center">
									<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
										<FileText className="h-12 w-12 opacity-40 mb-4" />
										<p className="text-lg font-medium mb-2">
											No certificates found
										</p>
										{debouncedSearchQuery && (
											<p className="text-sm">Try adjusting your search.</p>
										)}
									</div>
								</TableCell>
							</TableRow>
						) : (
							certificates.map((cert) => (
								<TableRow key={cert.id}>
									<TableCell>
										<IndeterminateCheckbox
											checked={bulkSelection.isSelected(cert.id)}
											onCheckedChange={() => bulkSelection.toggleItem(cert.id)}
										/>
									</TableCell>
									<TableCell className="font-medium">{cert.id}</TableCell>
									<TableCell className="font-mono text-sm">
										{cert.certificate_number}
									</TableCell>
									<TableCell>
										{cert.submission_case_number || (
											<span className="text-gray-400">N/A</span>
										)}
									</TableCell>
									<TableCell>
										{cert.defendant_names || (
											<span className="text-gray-400">N/A</span>
										)}
									</TableCell>
									<TableCell>{formatDate(cert.created_at)}</TableCell>
									<TableCell>
										{cert.signed_pdf_file ? (
											<Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
												Signed
											</Badge>
										) : (
											<Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
												Unsigned
											</Badge>
										)}
										{cert.is_locked && (
											<Badge variant="outline" className="ml-1 text-xs">
												🔒
											</Badge>
										)}
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
													<span className="sr-only">Open menu</span>
												</Button>
											</DropdownMenuTrigger>
											<DropdownMenuContent align="end">
												{cert.signed_pdf_url && (
													<DropdownMenuItem
														onClick={() =>
															window.open(cert.signed_pdf_url!, "_blank")
														}
													>
														<Download className="mr-2 h-4 w-4" />
														Download Signed PDF
													</DropdownMenuItem>
												)}
												{cert.pdf_url && (
													<DropdownMenuItem
														onClick={() => window.open(cert.pdf_url!, "_blank")}
													>
														<Download className="mr-2 h-4 w-4" />
														Download Unsigned PDF
													</DropdownMenuItem>
												)}
												{!cert.signed_pdf_file &&
													cert.case &&
													currentUser?.role === "botanist" && (
														<DropdownMenuItem
															onClick={() =>
																signCertificateMutation.mutate({
																	submissionId: cert.case!,
																	certificateId: cert.id,
																})
															}
															disabled={signCertificateMutation.isPending}
														>
															<PenLine className="mr-2 h-4 w-4" />
															{signCertificateMutation.isPending
																? "Signing…"
																: "Sign Certificate"}
														</DropdownMenuItem>
													)}
												<DropdownMenuItem onClick={() => handleEdit(cert)}>
													Edit
												</DropdownMenuItem>
												<DropdownMenuItem
													onClick={() => handleDelete(cert)}
													className="text-red-600"
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

			{/* Pagination */}
			{certificatesResponse && certificatesResponse.count > 0 && (
				<div className="flex items-center justify-between px-2">
					<div className="text-sm text-muted-foreground">
						Showing {certificates.length} of {certificatesResponse.count}{" "}
						certificates
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
				totalItems={certificatesResponse?.count || 0}
				itemsShown={certificates.length}
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
