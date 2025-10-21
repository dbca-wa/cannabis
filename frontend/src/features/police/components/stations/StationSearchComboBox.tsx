import React, { useEffect, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Check, ChevronsUpDown, Building, X, Plus } from "lucide-react";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { CommandInputWithLoading } from "@/shared/components/ui/custom/command-input-with-loading";

import { useStationSearch } from "../../hooks/useStationSearch";
import { useStationById } from "../../hooks/useStationById";
import { CreateStationModal } from "./CreateStationModal";
import type { PoliceStation } from "@/shared/types/backend-api.types";
import { SmoothLoadingOverlay } from "@/shared/components/ui/custom/smooth-loading-overlay";

interface StationSearchComboBoxProps {
	value?: number | null;
	onValueChange: (stationId: number | null) => void;
	placeholder?: string;
	emptyText?: string;
	disabled?: boolean;
	className?: string;
	required?: boolean;
	error?: boolean;
	showExternalAddButton?: boolean; // Whether to show external "Add" button to the right
}

export const StationSearchComboBox = React.forwardRef<
	HTMLButtonElement,
	StationSearchComboBoxProps
>(
	(
		{
			value,
			onValueChange,
			placeholder = "Search stations...",
			emptyText = "No stations found",
			disabled = false,
			className,
			error = false,
			showExternalAddButton = false,
		},
		ref
	) => {
		const [open, setOpen] = useState(false);
		const [searchQuery, setSearchQuery] = useState("");
		const [showCreateModal, setShowCreateModal] = useState(false);
		const [showExternalCreateModal, setShowExternalCreateModal] = useState(false);

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
		} = useStationSearch({
			query: searchQuery,
			enabled: open,
			loadInitialData: true,
		});

		const { data: selectedStation, isLoading: isLoadingSelectedStation } =
			useStationById(value ?? null);

		// Reset search when closing
		useEffect(() => {
			if (!open) {
				setSearchQuery("");
			}
		}, [open]);

		const handleSelect = (stationId: number) => {
			onValueChange(stationId);
			setOpen(false);
		};

		const handleClear = (e: React.MouseEvent) => {
			e.stopPropagation();
			onValueChange(null);
		};

		const handleCreateStation = () => {
			setOpen(false);
			setShowCreateModal(true);
		};

		const handleStationCreated = (newStation: PoliceStation) => {
			// Auto-select the newly created station
			onValueChange(newStation.id);
		};

		const handleExternalCreateStation = () => {
			setShowExternalCreateModal(true);
		};

		const handleExternalStationCreated = (newStation: PoliceStation) => {
			// Auto-select the newly created station and close dropdown if open
			onValueChange(newStation.id);
			setOpen(false);
		};

		const displayValue = selectedStation?.name || null;

		const comboboxElement = (
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
							{isLoadingSelectedStation ? (
								<div className="flex items-center gap-2 flex-1">
									<Skeleton className="h-4 w-4 rounded-full" />
									<Skeleton className="h-4 flex-1" />
								</div>
							) : displayValue ? (
								<>
									<Building className="h-4 w-4 text-muted-foreground" />
									<span className="truncate">
										{displayValue}
									</span>
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
							placeholder="Search stations..."
							value={searchQuery}
							onValueChange={setSearchQuery}
							isLoading={isSearching}
							loadingText="Searching stations..."
						/>
						<CommandList className="max-h-[300px] min-h-[120px]">
							<SmoothLoadingOverlay
								isInitialLoading={isInitialLoading}
								isSearching={isSearching}
								hasResults={
									!!searchResults?.results?.length
								}
								skeletonCount={5}
								skeletonType="station"
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
														station: PoliceStation
													) => (
														<CommandItem
															key={station.id}
															value={station.id.toString()}
															onSelect={() =>
																handleSelect(
																	station.id
																)
															}
															className="flex items-center gap-2"
														>
															<Check
																className={cn(
																	"h-4 w-4",
																	value ===
																		station.id
																		? "opacity-100"
																		: "opacity-0"
																)}
															/>
															<Building className="h-4 w-4 text-muted-foreground" />
															<div className="flex-1 min-w-0">
																<div className="truncate">
																	{
																		station.name
																	}
																</div>
																<div className="text-xs text-muted-foreground truncate">
																	{
																		station.address
																	}
																</div>
															</div>
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
												: "No stations available"}
										</div>
										<Button
											size="sm"
											onClick={handleCreateStation}
											className="w-full bg-green-600 hover:bg-green-700 text-white"
										>
											<Plus className="h-4 w-4 mr-2" />
											Create New Station
										</Button>
									</div>
								) : (
									<CommandGroup>
										{searchResults.results
											.slice(0, 6)
											.map(
												(
													station: PoliceStation
												) => (
													<CommandItem
														key={station.id}
														value={station.id.toString()}
														onSelect={() =>
															handleSelect(
																station.id
															)
														}
														className="flex items-center gap-2"
													>
														<Check
															className={cn(
																"h-4 w-4",
																value ===
																	station.id
																	? "opacity-100"
																	: "opacity-0"
															)}
														/>
														<Building className="h-4 w-4 text-muted-foreground" />
														<div className="flex-1 min-w-0">
															<div className="truncate">
																{
																	station.name
																}
															</div>
															<div className="text-xs text-muted-foreground truncate">
																{
																	station.address
																}
															</div>
														</div>
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
		);

		return (
			<>
				{showExternalAddButton ? (
					<div className="flex items-center gap-2">
						<div className="flex-1">
							{comboboxElement}
						</div>
						<Button
							onClick={handleExternalCreateStation}
							disabled={disabled}
							className="bg-green-600 hover:bg-green-700 text-white"
						>
							<Plus className="h-4 w-4 mr-2" />
							Add
						</Button>
					</div>
				) : (
					comboboxElement
				)}

				{/* Create Station Modal */}
				<CreateStationModal
					isOpen={showCreateModal}
					onClose={() => setShowCreateModal(false)}
					onCreate={handleStationCreated}
				/>

				{/* External Create Station Modal */}
				<CreateStationModal
					isOpen={showExternalCreateModal}
					onClose={() => setShowExternalCreateModal(false)}
					onCreate={handleExternalStationCreated}
				/>
			</>
		);
	}
);

StationSearchComboBox.displayName = "StationSearchComboBox";
