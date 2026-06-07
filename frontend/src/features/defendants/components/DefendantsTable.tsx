import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate, Link } from "react-router";
import { observer } from "mobx-react-lite";
import {
	Plus,
	ChevronsUpDown,
	ChevronUp,
	ChevronDown,
	User,
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
import {
	useKeyboardShortcuts,
	commonShortcuts,
} from "@/shared/hooks/ui/useKeyboardShortcuts";
import { useServerPagination } from "@/shared/hooks/data/useServerPagination";
import { useExport } from "@/shared/hooks/data/useExport";
import { defendantsSearchStore } from "@/app/stores/derived/defendants-search.store";
import { useDefendants } from "../hooks/useDefendants";
import { ENDPOINTS } from "@/shared/services/api";

export const DefendantsTable = observer(
	({ onCountChange }: { onCountChange?: (count: number) => void }) => {
		const navigate = useNavigate();
		const searchInputRef = useRef<HTMLInputElement>(null);

		const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

		// Sort state (local — not part of filter persistence)
		const [sortField, setSortField] = useState("last_name");
		const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

		// Server-side pagination — keep for pageSize management via global preference
		const pagination = useServerPagination({
			initialPage: defendantsSearchStore.state.currentPage,
			enableGlobalPageSize: true,
		});

		// Build ordering string from local sort state
		const ordering = sortDirection === "desc" ? `-${sortField}` : sortField;

		// Build search parameters from store state
		const searchParams = useMemo(
			() => ({
				page: defendantsSearchStore.state.currentPage,
				limit: pagination.pageSize,
				search: defendantsSearchStore.state.searchTerm || undefined,
				ordering,
			}),
			[pagination.pageSize, ordering]
		);

		// Fetch data
		const {
			data: defendantsResponse,
			isLoading,
			error,
			refetch: refetchDefendants,
		} = useDefendants(searchParams);

		const defendants = useMemo(
			() => defendantsResponse?.results || [],
			[defendantsResponse?.results]
		);

		useEffect(() => {
			if (defendantsResponse) {
				pagination.updateTotalItems(defendantsResponse.count || 0);
				defendantsSearchStore.setPagination({
					totalPages: Math.max(
						1,
						Math.ceil((defendantsResponse.count || 0) / pagination.pageSize)
					),
					totalResults: defendantsResponse.count || 0,
				});
				onCountChange?.(defendantsResponse.count || 0);
			}
		}, [defendantsResponse, pagination, onCountChange]);

		const handleResetFilters = useCallback(() => {
			defendantsSearchStore.clearSearchAndFilters();
			pagination.firstPage();
		}, [pagination]);

		// Centralised export functionality
		const exportHook = useExport({
			entityName: "defendants",
			exportEndpoint: ENDPOINTS.DEFENDANTS.EXPORT,
			getCurrentFilters: () => ({
				searchQuery: defendantsSearchStore.state.searchTerm || undefined,
				ordering: ordering,
			}),
		});

		// Sorting functionality
		const handleSort = (field: string) => {
			if (sortField === field) {
				const newDirection = sortDirection === "asc" ? "desc" : "asc";
				setSortDirection(newDirection);
			} else {
				setSortField(field);
				setSortDirection("asc");
			}
			// Reset to first page when sorting changes
			defendantsSearchStore.setCurrentPage(1);
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
				commonShortcuts.table.export(() => exportHook.exportCSV()),
				commonShortcuts.general.help(() => setShowShortcutsHelp(true)),
				{
					key: "n",
					ctrlKey: true,
					action: () => navigate("/defendants/add"),
					description: "Create new defendant",
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

		// Handle page change via store
		const handlePageChange = useCallback((page: number) => {
			defendantsSearchStore.setCurrentPage(page);
		}, []);

		return (
			<div className="space-y-4">
				{/* Table */}
				<div className="rounded-xl border border-border shadow-md overflow-hidden">
					<Table>
						<TableHeader>
							<TableRow>
								{/* Last Name Column (link) */}
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("last_name")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Last Name</span>
										{getSortIcon("last_name")}
									</button>
								</TableHead>

								{/* Given Names Column */}
								<TableHead>
									<button
										type="button"
										onClick={() => handleSort("given_names")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Given Names</span>
										{getSortIcon("given_names")}
									</button>
								</TableHead>

								{/* Cases Count Column */}
								<TableHead className="w-32 text-center">
									<button
										type="button"
										onClick={() => handleSort("cases_count")}
										className="inline-flex items-center gap-1 group hover:text-foreground transition-colors cursor-pointer"
									>
										<span>Cases</span>
										{getSortIcon("cases_count")}
									</button>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								Array.from({ length: 5 }).map((_, i) => (
									<TableRow key={i}>
										<TableCell>
											<Skeleton className="h-4 w-28" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-4 w-24" />
										</TableCell>
										<TableCell>
											<Skeleton className="h-5 w-12 rounded-full" />
										</TableCell>
									</TableRow>
								))
							) : error ? (
								<TableRow>
									<TableCell colSpan={3} className="h-48 text-center">
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											<AlertCircle className="h-12 w-12 opacity-50 mb-4" />
											<p className="text-lg font-medium mb-2">
												Unable to load defendants
											</p>
											<p className="text-sm mb-4">
												{(error as Error)?.message ||
													"There was an error loading defendants. Please try again."}
											</p>
											<Button
												onClick={() => refetchDefendants()}
												variant="outline"
												size="sm"
											>
												Try Again
											</Button>
										</div>
									</TableCell>
								</TableRow>
							) : defendants.length === 0 ? (
								<TableRow>
									<TableCell colSpan={3} className="h-48 text-center">
										<div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
											<User className="h-12 w-12 opacity-40 mb-4" />
											<p className="text-lg font-medium mb-2">
												{defendantsSearchStore.hasActiveFilters
													? "No defendants found"
													: "No defendants yet"}
											</p>
											<p className="text-sm mb-4">
												{defendantsSearchStore.hasActiveFilters
													? "Try adjusting your search."
													: "Get started by adding your first defendant."}
											</p>
											{!defendantsSearchStore.hasActiveFilters && (
												<Button
													onClick={() => navigate("/defendants/add")}
													size="sm"
												>
													<Plus className="mr-2 h-4 w-4" />
													Add Defendant
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							) : (
								defendants.map((defendant) => (
									<TableRow
										key={defendant.id}
										className="cursor-pointer"
										onClick={(e) => {
											if (e.ctrlKey || e.metaKey) {
												window.open(`/defendants/${defendant.id}`, "_blank");
											} else {
												navigate(`/defendants/${defendant.id}`);
											}
										}}
									>
										{/* Last Name — blue link */}
										<TableCell>
											<Link
												to={`/defendants/${defendant.id}`}
												onClick={(e) => e.stopPropagation()}
												className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline underline-offset-2 transition-colors text-[14px] cursor-pointer font-medium"
											>
												{defendant.last_name}
											</Link>
										</TableCell>

										{/* Given Names */}
										<TableCell className="text-[14px]">
											{defendant.given_names || (
												<span className="text-muted-foreground italic">—</span>
											)}
										</TableCell>

										{/* Cases Count */}
										<TableCell className="text-center">
											<span className="inline-flex items-center justify-center w-8 h-6 text-xs bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 rounded-full tabular-nums">
												{defendant.cases_count ?? 0}
											</span>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>

				{/* Unified Pagination */}
				{defendantsResponse && defendantsResponse.count > 0 && (
					<TablePagination
						currentPage={defendantsSearchStore.state.currentPage}
						totalPages={defendantsSearchStore.state.totalPages}
						totalItems={defendantsResponse.count}
						itemsShown={defendants.length}
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
					title="Defendants Table Shortcuts"
					description="Use these keyboard shortcuts to work with the defendants table more efficiently."
				/>
			</div>
		);
	}
);
