import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { observer } from "mobx-react-lite";
import {
	Plus,
	Search,
	ChevronsUpDown,
	ChevronUp,
	ChevronDown,
	Shield,
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
import { Skeleton } from "@/shared/components/ui/skeleton";
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import { TablePagination } from "@/shared/components/ui/custom/table-pagination";
import { useKeyboardShortcuts, commonShortcuts } from "@/shared/hooks/ui";
import { useServerPagination } from "@/shared/hooks/data/useServerPagination";
import { useExport } from "@/shared/hooks/data/useExport";
import { usePoliceOfficers } from "../../hooks/usePoliceOfficers";
import { officersSearchStore } from "@/app/stores/derived/officers-search.store";
import { ENDPOINTS } from "@/shared/services/api";
import { OfficersFilters } from "./OfficersFilters";
import type { OfficerRank } from "@/shared/types/backend-api.types";

export const PoliceOfficersTable = observer(
	({ onCountChange }: { onCountChange?: (count: number) => void }) => {
		const navigate = useNavigate();
		const searchInputRef = useRef<HTMLInputElement>(null);

		const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

		// Sort state
		const [sortField, setSortField] = useState("last_name");
		const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

		// Server-side pagination
		const pagination = useServerPagination({
			initialPage: officersSearchStore.state.currentPage,
			enableGlobalPageSize: true,
			syncToUrl: false,
		});

		// Build ordering string from local sort state
		const ordering = sortDirection === "desc" ? `-${sortField}` : sortField;

		// Build search parameters from store state
		const searchParams = useMemo(
			() => ({
				page: officersSearchStore.state.currentPage,
				limit: pagination.pageSize,
				search: officersSearchStore.state.searchTerm || undefined,
				station: officersSearchStore.state.filters.station ?? undefined,
				rank:
					officersSearchStore.state.filters.rank !== "all"
						? (officersSearchStore.state.filters.rank as OfficerRank)
						: undefined,
				ordering,
			}),
			[pagination.pageSize, ordering]
		);

		// Fetch data
		const {
			data: officersResponse,
			isLoading,
			error,
			refetch: refetchOfficers,
		} = usePoliceOfficers(searchParams);
		const officers = useMemo(
			() => officersResponse?.results || [],
			[officersResponse?.results]
		);

		useEffect(() => {
			if (officersResponse) {
				pagination.updateTotalItems(officersResponse.count || 0);
				officersSearchStore.setPagination({
					totalPages: Math.max(
						1,
						Math.ceil((officersResponse.count || 0) / pagination.pageSize)
					),
					totalResults: officersResponse.count || 0,
				});
				onCountChange?.(officersResponse.count || 0);
			}
		}, [officersResponse, pagination, onCountChange]);

		// Centralised export
		const exportHook = useExport({
			entityName: "police-officers",
			exportEndpoint: ENDPOINTS.POLICE.OFFICERS.EXPORT,
			getCurrentFilters: () => ({
				searchQuery: officersSearchStore.state.searchTerm || undefined,
				ordering,
				additionalParams: {
					...(officersSearchStore.state.filters.station != null
						? { station: officersSearchStore.state.filters.station }
						: {}),
					...(officersSearchStore.state.filters.rank !== "all"
						? { rank: officersSearchStore.state.filters.rank }
						: {}),
				},
			}),
		});

		const handleResetFilters = useCallback(() => {
			officersSearchStore.clearSearchAndFilters();
		}, []);

		// Sorting
		const handleSort = (field: string) => {
			if (sortField === field) {
				setSortDirection(sortDirection === "asc" ? "desc" : "asc");
			} else {
				setSortField(field);
				setSortDirection("asc");
			}
			officersSearchStore.setCurrentPage(1);
		};

		const getSortIcon = (field: string) => {
			if (sortField === field) {
				return sortDirection === "asc" ? (
					<ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
				) : (
					<ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
				);
			}
			return (
				<ChevronsUpDown className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
			);
		};

		// Keyboard shortcuts
		const shortcuts = useMemo(
			() => [
				commonShortcuts.table.search(() => searchInputRef.current?.focus()),
				commonShortcuts.table.export(() => exportHook.exportCSV()),
				commonShortcuts.general.help(() => setShowShortcutsHelp(true)),
				{
					key: "n",
					ctrlKey: true,
					action: () => navigate("/officers/add"),
					description: "Create new officer",
				},
				{
					key: "r",
					ctrlKey: true,
					action: handleResetFilters,
					description: "Reset filters",
				},
			],
			[exportHook, navigate, handleResetFilters]
		);

		useKeyboardShortcuts({ shortcuts });

		const handlePageChange = useCallback((page: number) => {
			officersSearchStore.setCurrentPage(page);
		}, []);

		return (
			<div className="space-y-4">
				{/* Filters */}
				<OfficersFilters />

				{/* Table */}
				<div className="rounded-xl border border-border shadow-md overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("last_name")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Name</span>
										{getSortIcon("last_name")}
									</button>
								</TableHead>
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("badge_number")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Badge</span>
										{getSortIcon("badge_number")}
									</button>
								</TableHead>
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("rank")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Rank</span>
										{getSortIcon("rank")}
									</button>
								</TableHead>
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("station")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Station</span>
										{getSortIcon("station")}
									</button>
								</TableHead>
								<TableHead className="text-center">
									<button
										type="button"
										onClick={() => handleSort("case_count")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Cases</span>
										{getSortIcon("case_count")}
									</button>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								Array.from({ length: 5 }).map((_, i) => (
									<TableRow key={i}>
										<TableCell>
											<Skeleton className="h-4 w-32" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-16" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-20" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-24" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-8 mx-auto" />
										</TableCell>
									</TableRow>
								))
							) : error ? (
								<TableRow>
									<TableCell colSpan={5} className="h-48 text-center">
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											<AlertCircle className="h-12 w-12 opacity-50 mb-4" />
											<p className="text-lg font-medium mb-2">
												Unable to load officers
											</p>
											<p className="text-sm mb-4">
												{error instanceof Error
													? error.message
													: "There was an error loading officers. Please try again."}
											</p>
											<Button
												onClick={() => refetchOfficers()}
												variant="outline"
												size="sm"
											>
												Try Again
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : officers.length === 0 ? (
								<TableRow>
									<TableCell colSpan={5} className="h-48 text-center">
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											{officersSearchStore.hasActiveFilters ? (
												<>
													<Search className="h-12 w-12 opacity-40 mb-4" />
													<p className="text-lg font-medium mb-2">
														No officers found
													</p>
													<p className="text-sm mb-4">
														Try adjusting your search or filters.
													</p>
													<Button
														variant="outline"
														size="sm"
														onClick={handleResetFilters}
													>
														Clear search
													</Button>
												</>
											) : (
												<>
													<Shield className="h-12 w-12 opacity-40 mb-4" />
													<p className="text-lg font-medium mb-2">
														No officers yet
													</p>
													<p className="text-sm mb-4">
														Get started by adding your first officer.
													</p>
													<Button
														size="sm"
														onClick={() => navigate("/officers/add")}
													>
														<Plus className="h-4 w-4 mr-2" />
														Add Officer
													</Button>
												</>
											)}
										</div>
									</TableCell>
								</TableRow>
							) : (
								officers.map((officer) => (
									<TableRow
										key={officer.id}
										className="cursor-pointer"
										onClick={(e) => {
											if (e.ctrlKey || e.metaKey) {
												window.open(`/officers/${officer.id}`, "_blank");
											} else {
												navigate(`/officers/${officer.id}`);
											}
										}}
									>
										<TableCell>
											<Link
												to={`/officers/${officer.id}`}
												onClick={(e) => e.stopPropagation()}
												className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline underline-offset-2 transition-colors text-[14px] cursor-pointer font-medium"
											>
												{officer.full_name}
											</Link>
										</TableCell>
										<TableCell className="text-[14px]">
											{officer.badge_number || "—"}
										</TableCell>
										<TableCell className="text-[14px]">
											{officer.rank_display}
										</TableCell>
										<TableCell className="text-[14px]">
											{officer.station_name || "—"}
										</TableCell>
										<TableCell className="text-center">
											<span className="inline-flex items-center justify-center w-8 h-6 text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded-full tabular-nums">
												{officer.case_count ?? 0}
											</span>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>

				{/* Pagination */}
				{officersResponse && officersResponse.count > 0 && (
					<TablePagination
						currentPage={officersSearchStore.state.currentPage}
						totalPages={officersSearchStore.state.totalPages}
						totalItems={officersResponse.count}
						itemsShown={officers.length}
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
					title="Officers Table Shortcuts"
					description="Use these keyboard shortcuts to work with the officers table more efficiently."
				/>
			</div>
		);
	}
);
