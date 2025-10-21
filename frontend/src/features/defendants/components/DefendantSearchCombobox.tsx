import React, { useEffect, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Check, ChevronsUpDown, User, X, Plus } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { CommandInputWithLoading } from "@/shared/components/ui/custom/command-input-with-loading";
import { useDefendantSearch } from "../hooks/useDefendantSearch";
import { useDefendantById } from "../hooks/useDefendants";
import { DefendantsService } from "../services/defendants.service";
import type { DefendantTiny } from "@/shared/types/backend-api.types";
import { SmoothLoadingOverlay } from "@/shared/components/ui/custom/smooth-loading-overlay";
import { useTheme } from "@/shared/hooks/ui/useTheme";
import { CreateDefendantModal } from "./CreateDefendantModal";

interface DefendantSearchComboboxProps {
	value?: number | null;
	onValueChange: (defendantId: number | null) => void;
	placeholder?: string;
	emptyText?: string;
	disabled?: boolean;
	className?: string;
	exclude?: number[];
	required?: boolean;
	error?: boolean;
}

export const DefendantSearchCombobox = React.forwardRef<
	HTMLButtonElement,
	DefendantSearchComboboxProps
>(
	(
		{
			value,
			onValueChange,
			placeholder = "Search defendants...",
			emptyText = "No defendants found",
			disabled = false,
			className,
			exclude = [],
			error = false,
		},
		ref
	) => {
		const [open, setOpen] = useState(false);
		const [searchQuery, setSearchQuery] = useState("");
		const [showCreateModal, setShowCreateModal] = useState(false);
		const { theme } = useTheme();
		const isDark = theme === "dark";

		// Enhanced search with initial data loading and error handling
		const {
			data: searchResults,
			error: searchError,
			isInitialLoading,
			isSearching,
			hasInitialData,
			initialData,
			retry,
			isRetrying,
		} = useDefendantSearch({
			query: searchQuery,
			exclude,
			enabled: open,
			loadInitialData: true,
		});

		const {
			data: selectedDefendant,
			isLoading: isLoadingSelectedDefendant,
		} = useDefendantById(value ?? null);

		// Reset search when closing
		useEffect(() => {
			if (!open) {
				setSearchQuery("");
			}
		}, [open]);

		const handleSelect = (defendantId: number) => {
			onValueChange(defendantId);
			setOpen(false);
		};

		const handleClear = (e: React.MouseEvent) => {
			e.stopPropagation();
			onValueChange(null);
		};

		const handleCreateDefendant = () => {
			setOpen(false);
			setShowCreateModal(true);
		};

		const handleDefendantCreated = (newDefendant: DefendantTiny) => {
			// Auto-select the newly created defendant
			onValueChange(newDefendant.id);
		};

		const displayValue = selectedDefendant
			? DefendantsService.formatDefendantDisplayName(selectedDefendant)
			: null;

		return (
			<>
				<Popover open={open} onOpenChange={setOpen}>
					<PopoverTrigger asChild>
						<Button
							ref={ref}
							variant="outline"
							role="combobox"
							aria-expanded={open}
							className={cn(
								"w-full justify-between font-normal",
								!displayValue && "text-muted-foreground",
								error && "border-red-500 focus:border-red-500",
								className
							)}
							disabled={disabled}
						>
							<div className="flex items-center gap-2 flex-1 min-w-0">
								{isLoadingSelectedDefendant ? (
									<div className="flex items-center gap-2 flex-1">
										<Skeleton className="h-4 w-4 rounded-full" />
										<Skeleton className="h-4 flex-1" />
									</div>
								) : displayValue ? (
									<>
										<User className="h-4 w-4 text-muted-foreground" />
										<span className="truncate">
											{displayValue}
										</span>
										{selectedDefendant && (
											<Badge
												variant="secondary"
												className={cn(
													"text-xs",
													DefendantsService.getDefendantCasesBadgeColorClass(
														selectedDefendant,
														isDark
													)
												)}
											>
												{DefendantsService.getDefendantCasesBadge(
													selectedDefendant
												)}
											</Badge>
										)}
									</>
								) : (
									<span>{placeholder}</span>
								)}
							</div>
							<div className="flex items-center gap-1">
								{displayValue && !disabled && (
									<div
										className="h-4 w-4 p-0 hover:bg-muted rounded-sm cursor-pointer flex items-center justify-center"
										onClick={handleClear}
									>
										<X className="h-3 w-3" />
									</div>
								)}
								<ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
							</div>
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[--radix-popover-trigger-width] min-w-[320px] p-0">
						<Command shouldFilter={false}>
							<CommandInputWithLoading
								placeholder="Search defendants..."
								value={searchQuery}
								onValueChange={setSearchQuery}
								isLoading={isSearching}
								loadingText="Searching defendants..."
							/>
							<CommandList className="max-h-[300px] min-h-[120px]">
								<SmoothLoadingOverlay
									isInitialLoading={isInitialLoading}
									isSearching={isSearching}
									hasResults={
										!!searchResults?.results?.length
									}
									skeletonCount={4}
									skeletonType="simple"
									error={searchError}
									onRetry={retry}
									isRetrying={isRetrying}
									hasFallbackData={
										hasInitialData && !!searchError
									}
									fallbackMessage={
										hasInitialData
											? "Showing cached results"
											: undefined
									}
								>
									{/* Show search error with fallback to initial data */}
									{searchError &&
									hasInitialData &&
									searchQuery ? (
										<>
											<div className="p-2 border-l-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
												<div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
													<span>
														Search failed. Showing
														cached results.
													</span>
													<Button
														variant="ghost"
														size="sm"
														onClick={retry}
														disabled={isRetrying}
														className="h-6 px-2 text-orange-700 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-300"
													>
														Retry
													</Button>
												</div>
											</div>
											<CommandGroup>
												{initialData
													?.slice(0, 6)
													.map(
														(
															defendant: DefendantTiny
														) => (
															<CommandItem
																key={
																	defendant.id
																}
																value={defendant.id.toString()}
																onSelect={() =>
																	handleSelect(
																		defendant.id
																	)
																}
																className="flex items-center gap-2"
															>
																<Check
																	className={cn(
																		"h-4 w-4",
																		value ===
																			defendant.id
																			? "opacity-100"
																			: "opacity-0"
																	)}
																/>
																<User className="h-4 w-4 text-muted-foreground" />
																<div className="flex-1 min-w-0">
																	<div className="truncate">
																		{DefendantsService.formatDefendantDisplayName(
																			defendant
																		)}
																	</div>
																</div>
																<Badge
																	variant="secondary"
																	className={cn(
																		"text-xs",
																		DefendantsService.getDefendantCasesBadgeColorClass(
																			defendant,
																			isDark
																		)
																	)}
																>
																	{DefendantsService.getDefendantCasesBadge(
																		defendant
																	)}
																</Badge>
															</CommandItem>
														)
													)}
											</CommandGroup>
										</>
									) : !searchResults?.results?.length ? (
										<div className="p-4 text-center">
											<div className="text-sm text-muted-foreground mb-3">
												{searchQuery
													? emptyText
													: "No defendants available"}
											</div>
											<Button
												size="sm"
												onClick={handleCreateDefendant}
												className="w-full bg-green-600 hover:bg-green-700 text-white"
											>
												<Plus className="h-4 w-4 mr-2" />
												Create New Defendant
											</Button>
										</div>
									) : (
										<CommandGroup>
											{searchResults.results
												.slice(0, 6)
												.map(
													(
														defendant: DefendantTiny
													) => (
														<CommandItem
															key={defendant.id}
															value={defendant.id.toString()}
															onSelect={() =>
																handleSelect(
																	defendant.id
																)
															}
															className="flex items-center gap-2"
														>
															<Check
																className={cn(
																	"h-4 w-4",
																	value ===
																		defendant.id
																		? "opacity-100"
																		: "opacity-0"
																)}
															/>
															<User className="h-4 w-4 text-muted-foreground" />
															<div className="flex-1 min-w-0">
																<div className="truncate">
																	{DefendantsService.formatDefendantDisplayName(
																		defendant
																	)}
																</div>
															</div>
															<Badge
																variant="secondary"
																className={cn(
																	"text-xs",
																	DefendantsService.getDefendantCasesBadgeColorClass(
																		defendant,
																		isDark
																	)
																)}
															>
																{DefendantsService.getDefendantCasesBadge(
																	defendant
																)}
															</Badge>
														</CommandItem>
													)
												)}
										</CommandGroup>
									)}
								</SmoothLoadingOverlay>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{/* Create Defendant Modal */}
				<CreateDefendantModal
					open={showCreateModal}
					onOpenChange={setShowCreateModal}
					onCreate={handleDefendantCreated}
					isRouteModal={false}
				/>
			</>
		);
	}
);

DefendantSearchCombobox.displayName = "DefendantSearchCombobox";
