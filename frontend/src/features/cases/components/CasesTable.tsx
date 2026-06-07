import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { observer } from "mobx-react-lite";
import {
	Plus,
	ChevronsUpDown,
	ChevronUp,
	ChevronDown,
	ScrollText,
	BadgeDollarSign,
	FileText,
	AlertCircle,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
	Tooltip,
	TooltipTrigger,
	TooltipContent,
} from "@/shared/components/ui/tooltip";
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import { TablePagination } from "@/shared/components/ui/custom/table-pagination";
import { useBreakpoint } from "@/shared/hooks/ui/useResponsive";
import {
	useKeyboardShortcuts,
	commonShortcuts,
} from "@/shared/hooks/ui/useKeyboardShortcuts";
import { useServerPagination } from "@/shared/hooks/data/useServerPagination";
import { casesSearchStore } from "@/app/stores/derived/cases-search.store";
import { useCases } from "../hooks/useCases";
import { getPhaseBadgeClass } from "../utils/cases.utils";
import {
	exportToCSV,
	commonExportColumns,
	generateFilename,
} from "@/shared/utils/export.utils";
import { toast } from "sonner";
import { formatDate } from "@/shared/utils/date.utils";
import {
	downloadCertificatePdf,
	downloadInvoicePdf,
	openBlobInNewTab,
} from "@/shared/services/pdf";

import type { CaseTiny, CasePhase } from "@/shared/types/backend-api.types";

export const CasesTable = observer(
	({
		onCountChange,
		onCasesChange,
	}: {
		onCountChange?: (count: number) => void;
		onCasesChange?: (cases: CaseTiny[]) => void;
	}) => {
		const navigate = useNavigate();
		const searchInputRef = useRef<HTMLInputElement>(null);
		const { isMobile } = useBreakpoint();

		const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

		// Sort state (local — not part of filter persistence)
		const [sortField, setSortField] = useState("received");
		const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

		// Server-side pagination — keep for pageSize management via global preference
		const pagination = useServerPagination({
			initialPage: casesSearchStore.state.currentPage,
			enableGlobalPageSize: true,
			syncToUrl: false,
		});

		// Build ordering string from local sort state
		const ordering = sortDirection === "desc" ? `-${sortField}` : sortField;

		// Build search parameters from store state
		const searchParams = useMemo(
			() => ({
				page: casesSearchStore.state.currentPage,
				limit: pagination.pageSize,
				search: casesSearchStore.state.searchTerm || undefined,
				ordering,
				phase:
					casesSearchStore.state.filters.phase !== "all"
						? (casesSearchStore.state.filters.phase as CasePhase)
						: undefined,
				botanist: casesSearchStore.state.filters.botanist ?? undefined,
				officer: casesSearchStore.state.filters.officer ?? undefined,
				station: casesSearchStore.state.filters.station ?? undefined,
			}),
			[
				casesSearchStore.state.currentPage,
				pagination.pageSize,
				casesSearchStore.state.searchTerm,
				ordering,
				casesSearchStore.state.filters.phase,
				casesSearchStore.state.filters.botanist,
				casesSearchStore.state.filters.officer,
				casesSearchStore.state.filters.station,
			]
		);

		// Fetch data
		const {
			cases,
			totalCount,
			isLoading,
			error,
			refetch: refetchCases,
		} = useCases(searchParams);

		useEffect(() => {
			if (totalCount !== undefined) {
				pagination.updateTotalItems(totalCount);
				casesSearchStore.setPagination({
					totalPages: Math.max(1, Math.ceil(totalCount / pagination.pageSize)),
					totalResults: totalCount,
				});
				onCountChange?.(totalCount);
			}
		}, [totalCount, pagination, onCountChange]);

		useEffect(() => {
			onCasesChange?.(cases);
		}, [cases, onCasesChange]);

		const handleResetFilters = useCallback(() => {
			casesSearchStore.clearSearchAndFilters();
		}, []);

		// Export all data (for keyboard shortcut)
		const handleExportAllCSV = useCallback(() => {
			const filename = generateFilename("submissions_all", "csv");
			exportToCSV(cases, commonExportColumns.caseObj, {
				filename,
			});
			toast.success(`Exported ${cases.length} cases to CSV`);
		}, [cases]);

		// Sorting functionality
		const handleSort = (field: string) => {
			if (sortField === field) {
				const newDirection = sortDirection === "asc" ? "desc" : "asc";
				setSortDirection(newDirection);
			} else {
				setSortField(field);
				setSortDirection(field === "received" ? "desc" : "asc");
			}
			// Reset to first page when sorting changes
			casesSearchStore.setCurrentPage(1);
		};

		// Get sort icon for a field
		const getSortIcon = (field: string) => {
			if (sortField === field) {
				return sortDirection === "asc" ? (
					<ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
				) : (
					<ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
				);
			} else {
				return (
					<ChevronsUpDown className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
				);
			}
		};

		// Keyboard shortcuts
		const shortcuts = useMemo(
			() => [
				commonShortcuts.table.search(() => searchInputRef.current?.focus()),
				commonShortcuts.table.export(() => handleExportAllCSV()),
				commonShortcuts.general.help(() => setShowShortcutsHelp(true)),
				{
					key: "n",
					ctrlKey: true,
					action: () => navigate("/cases/add"),
					description: "Create new case",
				},
				{
					key: "r",
					ctrlKey: true,
					action: handleResetFilters,
					description: "Reset filters",
				},
			],
			[handleExportAllCSV, navigate, handleResetFilters]
		);

		useKeyboardShortcuts({ shortcuts });

		// Handle page change via store
		const handlePageChange = useCallback((page: number) => {
			casesSearchStore.setCurrentPage(page);
		}, []);

		return (
			<div className="space-y-4">
				{/* Table */}
				<div className="rounded-xl border border-border shadow-md overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								{/* Case Number Column */}
								<TableHead title="Unique case reference number">
									<button
										type="button"
										onClick={() => handleSort("case_number")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Reference</span>
										{getSortIcon("case_number")}
									</button>
								</TableHead>

								{/* Received Date Column */}
								<TableHead title="Date the case was received">
									<button
										type="button"
										onClick={() => handleSort("received")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Received</span>
										{getSortIcon("received")}
									</button>
								</TableHead>

								{/* Defendants Column - hide on mobile */}
								{!isMobile && (
									<TableHead title="Defendants linked to this case">
										<button
											type="button"
											onClick={() => handleSort("defendants__last_name")}
											className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
										>
											<span>Defendants</span>
											{getSortIcon("defendants__last_name")}
										</button>
									</TableHead>
								)}

								{/* Officers Column (combined) - hide on mobile */}
								{!isMobile && (
									<TableHead title="Submitting and requesting police officers">
										<button
											type="button"
											onClick={() =>
												handleSort("requesting_officer__last_name")
											}
											className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
										>
											<span>Officers</span>
											{getSortIcon("requesting_officer__last_name")}
										</button>
									</TableHead>
								)}

								{/* Bags Column - hide on mobile */}
								{!isMobile && (
									<TableHead
										className="text-center"
										title="Number of exhibit bags in this case"
									>
										<button
											type="button"
											onClick={() => handleSort("bags_count")}
											className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
										>
											<span>Bags</span>
											{getSortIcon("bags_count")}
										</button>
									</TableHead>
								)}

								{/* State Column */}
								<TableHead
									className="text-center"
									title="Current workflow phase"
								>
									<button
										type="button"
										onClick={() => handleSort("phase")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>State</span>
										{getSortIcon("phase")}
									</button>
								</TableHead>

								{/* Docs Column - hide on mobile (last) */}
								{!isMobile && (
									<TableHead title="Certificate and invoice documents">
										<button
											type="button"
											className="inline-flex items-center gap-1"
										>
											<span>Docs</span>
										</button>
									</TableHead>
								)}
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								Array.from({ length: 5 }).map((_, i) => (
									<TableRow key={i}>
										<TableCell>
											<div className="space-y-1">
												<Skeleton className="h-4 w-24" />
												<Skeleton className="h-3 w-12" />
											</div>
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
												<div className="flex items-center gap-2.5">
													<Skeleton className="h-8 w-8 rounded-full" />
													<div className="space-y-1">
														<Skeleton className="h-4 w-24" />
														<Skeleton className="h-3 w-16" />
													</div>
												</div>
											</TableCell>
										)}
										{!isMobile && (
											<TableCell>
												<Skeleton className="h-6 w-8 rounded-full mx-auto" />
											</TableCell>
										)}
										<TableCell>
											<Skeleton className="h-5 w-20 rounded-full mx-auto" />
										</TableCell>
										{!isMobile && (
											<TableCell>
												<Skeleton className="h-7 w-16 rounded-lg" />
											</TableCell>
										)}
									</TableRow>
								))
							) : error ? (
								<TableRow>
									<TableCell
										colSpan={isMobile ? 3 : 7}
										className="h-48 text-center"
									>
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											<AlertCircle className="h-12 w-12 opacity-50 mb-4" />
											<p className="text-lg font-medium mb-2">
												Unable to load cases
											</p>
											<p className="text-sm mb-4">
												{(error as Error)?.message ||
													"There was an error loading cases. Please try again."}
											</p>
											<Button
												onClick={() => refetchCases()}
												variant="outline"
												size="sm"
											>
												Try Again
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : cases.length === 0 ? (
								<TableRow>
									<TableCell
										colSpan={isMobile ? 3 : 7}
										className="h-48 text-center"
									>
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											<FileText className="h-12 w-12 opacity-40 mb-4" />
											<p className="text-lg font-medium mb-2">
												{casesSearchStore.hasActiveFilters
													? "No cases found"
													: "No cases yet"}
											</p>
											<p className="text-sm mb-4">
												{casesSearchStore.hasActiveFilters
													? "Try adjusting your search or filters"
													: "Get started by creating your first case."}
											</p>
											{!casesSearchStore.hasActiveFilters && (
												<Button
													onClick={() => navigate("/cases/add")}
													size="sm"
												>
													<Plus className="mr-2 h-4 w-4" />
													Create Case
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							) : (
								cases.map((caseObj) => {
									const submittingOfficerName = (
										caseObj as unknown as Record<string, unknown>
									).submitting_officer_name as string | null;
									const submittingOfficerRank = (
										caseObj as unknown as Record<string, unknown>
									).submitting_officer_rank as string | null;
									const submittingOfficerStation = (
										caseObj as unknown as Record<string, unknown>
									).submitting_officer_station as string | null;
									const requestingOfficerRank = (
										caseObj as unknown as Record<string, unknown>
									).requesting_officer_rank as string | null;
									const requestingOfficerStation = (
										caseObj as unknown as Record<string, unknown>
									).requesting_officer_station as string | null;
									const certificateId = (
										caseObj as unknown as Record<string, unknown>
									).certificate_id as number | null;
									const invoiceId = (
										caseObj as unknown as Record<string, unknown>
									).invoice_id as number | null;

									return (
										<TableRow
											key={caseObj.id}
											className="cursor-pointer"
											onClick={(e) => {
												if (e.ctrlKey || e.metaKey) {
													window.open(`/cases/${caseObj.id}/detail`, "_blank");
												} else {
													navigate(`/cases/${caseObj.id}/detail`);
												}
											}}
										>
											{/* Reference — link + ID (reference design) */}
											<TableCell>
												<div className="flex items-center gap-2">
													<Link
														to={`/cases/${caseObj.id}/detail`}
														onClick={(e) => e.stopPropagation()}
														className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline underline-offset-2 transition-colors text-[14px] cursor-pointer"
													>
														{caseObj.case_number}
													</Link>
												</div>
												<div className="text-[12px] text-muted-foreground">
													ID: {caseObj.id}
												</div>
											</TableCell>

											{/* Received Date */}
											<TableCell className="text-[14px] text-muted-foreground">
												{formatDate(caseObj.received)}
											</TableCell>

											{/* Defendants */}
											{!isMobile && (
												<TableCell className="text-[14px]">
													{(() => {
														const names = (
															caseObj as unknown as Record<string, unknown>
														).defendant_names as string[] | undefined;
														if (!names || names.length === 0)
															return (
																<span className="text-muted-foreground">
																	Unknown
																</span>
															);
														return (
															<div className="leading-tight space-y-0.5">
																{names.map((name, i) => (
																	<div key={i} className="truncate">
																		{name}
																	</div>
																))}
															</div>
														);
													})()}
												</TableCell>
											)}

											{/* Officers — avatar + name + rank·station (reference design) */}
											{!isMobile && (
												<TableCell>
													{(() => {
														const sub = submittingOfficerName;
														const req = caseObj.requesting_officer_name;
														if (!req && !sub)
															return (
																<span className="text-muted-foreground">—</span>
															);

														const primary = sub || req!;
														const primaryRank = sub
															? submittingOfficerRank
															: requestingOfficerRank;
														const primaryStation = sub
															? submittingOfficerStation
															: requestingOfficerStation;
														const showSecondary = sub && req && sub !== req;
														const initialsStr = primary
															.split(" ")
															.map((p) => p[0])
															.filter(Boolean)
															.slice(0, 2)
															.join("")
															.toUpperCase();

														return (
															<div className="min-w-0">
																<div className="flex items-center gap-2.5 min-w-0">
																	<div className="shrink-0 w-8 h-8 rounded-full bg-indigo-100/80 text-indigo-700 ring-1 ring-inset ring-indigo-500/15 dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-400/20 flex items-center justify-center text-[11px] font-medium">
																		{initialsStr}
																	</div>
																	<div className="min-w-0 leading-tight">
																		<div className="text-[14px] truncate">
																			{primary}
																		</div>
																		{(primaryRank || primaryStation) && (
																			<div className="text-[12px] text-muted-foreground truncate">
																				{[primaryRank, primaryStation]
																					.filter(Boolean)
																					.join(" · ")}
																			</div>
																		)}
																	</div>
																</div>
																{showSecondary && (
																	<div className="mt-1.5 leading-tight min-w-0 border-l-2 border-indigo-200/60 dark:border-indigo-800/40 pl-2.5 ml-[15px]">
																		<div className="text-[12px] text-muted-foreground truncate">
																			Requested by{" "}
																			<span className="text-foreground/85">
																				{req}
																			</span>
																		</div>
																		{(requestingOfficerRank ||
																			requestingOfficerStation) && (
																			<div className="text-[11px] text-muted-foreground truncate">
																				{[
																					requestingOfficerRank,
																					requestingOfficerStation,
																				]
																					.filter(Boolean)
																					.join(" · ")}
																			</div>
																		)}
																	</div>
																)}
															</div>
														);
													})()}
												</TableCell>
											)}

											{/* Bags */}
											{!isMobile && (
												<TableCell className="text-center">
													<span className="inline-flex items-center justify-center w-8 h-6 text-xs bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 rounded-full tabular-nums">
														{caseObj.bags_count}
													</span>
												</TableCell>
											)}

											{/* State */}
											<TableCell className="text-center">
												<Badge
													className={`${getPhaseBadgeClass(caseObj.phase)} pointer-events-none`}
												>
													{caseObj.phase_display}
												</Badge>
											</TableCell>

											{/* Docs — bordered icon group (reference design) */}
											{!isMobile && (
												<TableCell onClick={(e) => e.stopPropagation()}>
													<div className="inline-flex items-center rounded-lg border border-border/60 bg-muted/20 dark:bg-muted/10 divide-x divide-border/60 overflow-hidden">
														<Tooltip>
															<TooltipTrigger asChild>
																<button
																	type="button"
																	disabled={!certificateId}
																	onClick={async () => {
																		if (certificateId) {
																			try {
																				const blob =
																					await downloadCertificatePdf(
																						certificateId
																					);
																				openBlobInNewTab(blob);
																			} catch {
																				toast.error(
																					"Failed to download certificate PDF"
																				);
																			}
																		}
																	}}
																	className={`relative inline-flex items-center justify-center w-8 h-7 transition-colors ${
																		certificateId
																			? "text-foreground/80 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/40 cursor-pointer"
																			: "text-muted-foreground/30 cursor-default"
																	}`}
																	aria-label={
																		certificateId
																			? "View certificate"
																			: "No certificate"
																	}
																>
																	<ScrollText className="h-[15px] w-[15px]" />
																</button>
															</TooltipTrigger>
															<TooltipContent>
																{certificateId
																	? "Open certificate PDF"
																	: "Certificate not yet generated"}
															</TooltipContent>
														</Tooltip>
														<Tooltip>
															<TooltipTrigger asChild>
																<button
																	type="button"
																	disabled={!invoiceId}
																	onClick={async () => {
																		if (invoiceId) {
																			try {
																				const blob =
																					await downloadInvoicePdf(invoiceId);
																				openBlobInNewTab(blob);
																			} catch {
																				toast.error(
																					"Failed to download invoice PDF"
																				);
																			}
																		}
																	}}
																	className={`relative inline-flex items-center justify-center w-8 h-7 transition-colors ${
																		invoiceId
																			? "text-foreground/80 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:text-indigo-300 dark:hover:bg-indigo-950/40 cursor-pointer"
																			: "text-muted-foreground/30 cursor-default"
																	}`}
																	aria-label={
																		invoiceId ? "View invoice" : "No invoice"
																	}
																>
																	<BadgeDollarSign className="h-[15px] w-[15px]" />
																</button>
															</TooltipTrigger>
															<TooltipContent>
																{invoiceId
																	? "Open invoice PDF"
																	: "Invoice not yet generated"}
															</TooltipContent>
														</Tooltip>
													</div>
												</TableCell>
											)}
										</TableRow>
									);
								})
							)}
						</TableBody>
					</Table>
				</div>

				{/* Unified Pagination */}
				{totalCount !== undefined && totalCount > 0 && (
					<TablePagination
						currentPage={casesSearchStore.state.currentPage}
						totalPages={casesSearchStore.state.totalPages}
						totalItems={totalCount}
						itemsShown={cases.length}
						onPageChange={handlePageChange}
						onPageSizeChange={pagination.setPageSize}
						isLoading={isLoading}
					/>
				)}

				{/* Keyboard Shortcuts Help */}
				<KeyboardShortcutsHelp
					open={showShortcutsHelp}
					onOpenChange={setShowShortcutsHelp}
					shortcuts={shortcuts}
					title="Cases Table Shortcuts"
					description="Use these keyboard shortcuts to work with the cases table more efficiently."
				/>
			</div>
		);
	}
);
