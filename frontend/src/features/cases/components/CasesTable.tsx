import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { observer } from "mobx-react-lite";
import {
	Plus,
	ChevronsUpDown,
	ChevronUp,
	ChevronDown,
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
import { Checkbox } from "@/shared/components/ui/checkbox";
import { Skeleton } from "@/shared/components/ui/skeleton";
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
import { formatDate } from "@/shared/utils/date.utils";

import type { Certificate } from "@/features/certificates/types/certificates.types";
import type { CaseTiny, CasePhase } from "@/shared/types/backend-api.types";

/** Return the IDs of all batch-eligible certificates across a case's forms. */
export const getEligibleCertIds = (c: CaseTiny): number[] =>
	c.forms
		.map((f) => f.certificate)
		.filter(
			(cert): cert is Certificate => cert !== null && cert.is_batch_eligible
		)
		.map((cert) => cert.id);

export const CasesTable = observer(
	({
		onCountChange,
		selectedCertificateIds,
		onToggleSelect,
		onToggleSelectAll,
	}: {
		onCountChange?: (count: number) => void;
		/** When provided, an eligibility-gated selection checkbox column is shown. Holds certificate IDs. */
		selectedCertificateIds?: Set<number>;
		/** Toggle all eligible cert IDs for a given case row. */
		onToggleSelect?: (caseObj: CaseTiny) => void;
		/** Toggle selection of every eligible cert ID from all shown eligible cases. */
		onToggleSelectAll?: (eligible: CaseTiny[]) => void;
	}) => {
		const navigate = useNavigate();
		const searchInputRef = useRef<HTMLInputElement>(null);
		const { isMobile } = useBreakpoint();

		const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

		// Sort state (local — not part of filter persistence)
		const [sortField, setSortField] = useState("status_priority");
		const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

		// Server-side pagination — keep for pageSize management via global preference
		const pagination = useServerPagination({
			initialPage: casesSearchStore.state.currentPage,
			enableGlobalPageSize: true,
			syncToUrl: false,
		});

		// Build ordering string from local sort state
		const ordering = sortDirection === "desc" ? `-${sortField}` : sortField;

		// Build search parameters from store state
		const searchParams = {
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
			tag_search: casesSearchStore.state.filters.tagSearch || undefined,
		};

		// Fetch data
		const {
			cases,
			totalCount,
			isLoading,
			error,
			refetch: refetchCases,
		} = useCases(searchParams);

		// Batching selection: cases with at least one eligible certificate, and
		// whether all eligible cert IDs are currently selected.
		const eligibleCases = useMemo(
			() => cases.filter((c) => getEligibleCertIds(c).length > 0),
			[cases]
		);
		const allEligibleCertIds = useMemo(
			() => eligibleCases.flatMap(getEligibleCertIds),
			[eligibleCases]
		);
		const allEligibleSelected =
			!!selectedCertificateIds &&
			allEligibleCertIds.length > 0 &&
			allEligibleCertIds.every((id) => selectedCertificateIds.has(id));

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

		const handleResetFilters = useCallback(() => {
			casesSearchStore.clearSearchAndFilters();
		}, []);

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
			[navigate, handleResetFilters]
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
								{/* Selection checkbox column (only when selecting for batch) */}
								{selectedCertificateIds && (
									<TableHead
										className="w-16 text-center"
										title="Select all eligible certificates for batching"
									>
										<div className="flex items-center justify-center">
											<Checkbox
												checked={allEligibleSelected}
												disabled={allEligibleCertIds.length === 0}
												onCheckedChange={() =>
													onToggleSelectAll?.(eligibleCases)
												}
												aria-label="Select all eligible certificates for batching"
												className="cursor-pointer disabled:cursor-not-allowed"
											/>
										</div>
									</TableHead>
								)}
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

								{/* Certificates Column - hide on mobile */}
								{!isMobile && (
									<TableHead
										className="text-center"
										title="Number of certificates generated for this case"
									>
										<button
											type="button"
											onClick={() => handleSort("certificates_count")}
											className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
										>
											<span>Certificates</span>
											{getSortIcon("certificates_count")}
										</button>
									</TableHead>
								)}

								{/* State Column — sortable by workflow priority */}
								<TableHead
									className="text-center"
									title="Current workflow state"
								>
									<button
										type="button"
										onClick={() => handleSort("status_priority")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>State</span>
										{getSortIcon("status_priority")}
									</button>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								Array.from({ length: 5 }).map((_, i) => (
									<TableRow key={i}>
										{selectedCertificateIds && (
											<TableCell className="text-center">
												<div className="flex items-center justify-center">
													<Skeleton className="h-4 w-4 rounded" />
												</div>
											</TableCell>
										)}
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
										{!isMobile && (
											<TableCell>
												<Skeleton className="h-6 w-8 rounded-full mx-auto" />
											</TableCell>
										)}
										<TableCell>
											<Skeleton className="h-5 w-20 rounded-full mx-auto" />
										</TableCell>
									</TableRow>
								))
							) : error ? (
								<TableRow>
									<TableCell
										colSpan={
											(isMobile ? 3 : 7) + (selectedCertificateIds ? 1 : 0)
										}
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
										colSpan={
											(isMobile ? 3 : 7) + (selectedCertificateIds ? 1 : 0)
										}
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

									return (
										<TableRow
											key={caseObj.id}
											className="cursor-pointer"
											onClick={(e) => {
												const target = `/cases/${caseObj.id}`;
												if (e.ctrlKey || e.metaKey) {
													window.open(target, "_blank");
												} else {
													navigate(target);
												}
											}}
										>
											{/* Selection checkbox — only for cases with eligible certificates */}
											{selectedCertificateIds && (
												<TableCell
													className="text-center align-middle"
													onClick={(e) => e.stopPropagation()}
												>
													{getEligibleCertIds(caseObj).length > 0 ? (
														<div className="flex items-center justify-center">
															<Checkbox
																checked={getEligibleCertIds(caseObj).every(
																	(id) => selectedCertificateIds.has(id)
																)}
																onCheckedChange={() =>
																	onToggleSelect?.(caseObj)
																}
																aria-label={`Select case ${caseObj.case_number} certificates for batching`}
																className="cursor-pointer"
															/>
														</div>
													) : (
														<span className="inline-block w-4" />
													)}
												</TableCell>
											)}

											{/* Reference — link + ID (reference design) */}
											<TableCell>
												<div className="flex items-center gap-2">
													<Link
														to={`/cases/${caseObj.id}`}
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

											{/* Certificates */}
											{!isMobile && (
												<TableCell className="text-center">
													<span className="inline-flex items-center justify-center w-8 h-6 text-xs bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 rounded-full tabular-nums">
														{caseObj.certificates_count}
													</span>
												</TableCell>
											)}

											{/* State */}
											<TableCell className="text-center">
												<Badge
													className={`${getPhaseBadgeClass(caseObj.derived_status)} pointer-events-none`}
												>
													{caseObj.derived_status_display}
												</Badge>
											</TableCell>
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
