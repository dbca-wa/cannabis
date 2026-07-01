import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { observer } from "mobx-react-lite";
import {
	Plus,
	Search,
	ChevronsUpDown,
	ChevronUp,
	ChevronDown,
	Building2,
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
import { KeyboardShortcutsHelp } from "@/shared/components/ui/custom/keyboard-shortcuts-help";
import { TablePagination } from "@/shared/components/ui/custom/table-pagination";
import { useServerPagination, useExport } from "@/shared/hooks/data";
import { useKeyboardShortcuts, commonShortcuts } from "@/shared/hooks/ui";
import { useStations } from "../../hooks/usePoliceStations";
import { stationsSearchStore } from "@/app/stores/derived/stations-search.store";
import { ENDPOINTS } from "@/shared/services/api";
import { Skeleton } from "@/shared/components/ui/skeleton";

interface PoliceStationsTableProps {
	onCountChange?: (count: number) => void;
}

export const PoliceStationsTable = observer(
	({ onCountChange }: PoliceStationsTableProps) => {
		const navigate = useNavigate();
		const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

		// Sort state (local — not part of filter persistence)
		const [sortField, setSortField] = useState("name");
		const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

		// Server-side pagination
		const pagination = useServerPagination({
			initialPage: stationsSearchStore.state.currentPage,
			enableGlobalPageSize: true,
		});

		// Build ordering string from local sort state
		const ordering = sortDirection === "desc" ? `-${sortField}` : sortField;

		// Build search parameters from store state
		const searchParams = useMemo(
			() => ({
				page: stationsSearchStore.state.currentPage,
				limit: pagination.pageSize,
				search: stationsSearchStore.state.searchTerm || undefined,
				ordering: ordering,
			}),
			[
				stationsSearchStore.state.currentPage,
				stationsSearchStore.state.searchTerm,
				pagination.pageSize,
				ordering,
			]
		);

		// Fetch stations with search, pagination, and ordering
		const {
			data,
			isLoading,
			error,
			refetch: refetchStations,
		} = useStations(searchParams);

		const stations = useMemo(() => data?.results || [], [data?.results]);

		useEffect(() => {
			if (data) {
				pagination.updateTotalItems(data.count || 0);
				stationsSearchStore.setPagination({
					totalPages: Math.max(
						1,
						Math.ceil((data.count || 0) / pagination.pageSize)
					),
					totalResults: data.count || 0,
				});
				onCountChange?.(data.count || 0);
			}
		}, [data, pagination, onCountChange]);

		// Centralised export functionality
		const exportHook = useExport({
			entityName: "police-stations",
			exportEndpoint: ENDPOINTS.POLICE.STATIONS.EXPORT,
			getCurrentFilters: () => ({
				searchQuery: stationsSearchStore.state.searchTerm || undefined,
				ordering: ordering,
			}),
		});

		// Sorting functionality
		const handleSort = (field: string) => {
			if (sortField === field) {
				setSortDirection(sortDirection === "asc" ? "desc" : "asc");
			} else {
				setSortField(field);
				setSortDirection("asc");
			}
			stationsSearchStore.setCurrentPage(1);
		};

		// Get sort icon for a field
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

		// Reset filters function
		const handleResetFilters = useCallback(() => {
			stationsSearchStore.clearSearchAndFilters();
		}, []);

		// Handle page change via store
		const handlePageChange = useCallback((page: number) => {
			stationsSearchStore.setCurrentPage(page);
		}, []);

		// Keyboard shortcuts
		const shortcuts = useMemo(
			() => [
				commonShortcuts.table.export(() => exportHook.exportCSV()),
				commonShortcuts.general.help(() => setShowShortcutsHelp(true)),
				{
					key: "n",
					ctrlKey: true,
					action: () => navigate("/stations/add"),
					description: "Create new station",
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

		if (error) {
			return (
				<div className="flex flex-col items-center justify-center p-8">
					<AlertCircle className="h-12 w-12 text-muted-foreground opacity-50 mb-4" />
					<p className="text-lg font-medium mb-2">Unable to load stations</p>
					<p className="text-sm text-muted-foreground mb-4">
						{error instanceof Error
							? error.message
							: "There was an error loading police stations. Please try again."}
					</p>
					<Button onClick={() => refetchStations()} variant="outline" size="sm">
						Try Again
					</Button>
				</div>
			);
		}

		return (
			<div className="space-y-4">
				{/* Table */}
				<div className="rounded-xl border border-border shadow-md overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("name")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Name</span>
										{getSortIcon("name")}
									</button>
								</TableHead>
								<TableHead className="text-center">
									<button
										type="button"
										onClick={() => handleSort("officer_count")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Officers</span>
										{getSortIcon("officer_count")}
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
											<Skeleton className="h-4 w-40" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-5 w-8 rounded-full mx-auto" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-8 mx-auto" />
										</TableCell>
									</TableRow>
								))
							) : stations.length === 0 ? (
								<TableRow>
									<TableCell colSpan={3} className="h-48 text-center">
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											{stationsSearchStore.hasActiveFilters ? (
												<>
													<Search className="h-12 w-12 opacity-40 mb-4" />
													<p className="text-lg font-medium mb-2">
														No stations found
													</p>
													<p className="text-sm mb-4">
														Try adjusting your search or filters
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
													<Building2 className="h-12 w-12 opacity-40 mb-4" />
													<p className="text-lg font-medium mb-2">
														No stations yet
													</p>
													<p className="text-sm mb-4">
														Get started by adding your first station.
													</p>
													<Button
														size="sm"
														onClick={() => navigate("/stations/add")}
													>
														<Plus className="h-4 w-4 mr-2" />
														Add Station
													</Button>
												</>
											)}
										</div>
									</TableCell>
								</TableRow>
							) : (
								stations.map((station) => (
									<TableRow
										key={station.id}
										className="cursor-pointer"
										onClick={(e) => {
											if (e.ctrlKey || e.metaKey) {
												window.open(`/stations/${station.id}`, "_blank");
											} else {
												navigate(`/stations/${station.id}`);
											}
										}}
									>
										<TableCell>
											<Link
												to={`/stations/${station.id}`}
												onClick={(e) => e.stopPropagation()}
												className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline underline-offset-2 transition-colors text-[14px] cursor-pointer font-medium"
											>
												{station.name}
											</Link>
										</TableCell>
										<TableCell className="text-center">
											<span className="inline-flex items-center justify-center w-8 h-6 text-xs bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300 rounded-full">
												{station.officer_count || 0}
											</span>
										</TableCell>
										<TableCell className="text-center">
											<span className="inline-flex items-center justify-center w-8 h-6 text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded-full tabular-nums">
												{station.case_count ?? 0}
											</span>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>

				{/* Pagination */}
				{data && data.count > 0 && (
					<TablePagination
						currentPage={stationsSearchStore.state.currentPage}
						totalPages={stationsSearchStore.state.totalPages}
						totalItems={data.count}
						itemsShown={stations.length}
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
					title="Stations Table Shortcuts"
					description="Use these keyboard shortcuts to work with the stations table more efficiently."
				/>
			</div>
		);
	}
);
