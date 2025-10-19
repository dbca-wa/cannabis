import React, { useEffect, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Check, ChevronsUpDown, Shield, X, Plus } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { CommandInputWithLoading } from "@/shared/components/ui/custom/command-input-with-loading";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

import { useOfficerSearch } from "../../hooks/useOfficerSearch";
import { useOfficerById } from "../../hooks/useOfficerById";
import { useCreatePoliceOfficer } from "../../hooks/usePoliceOfficers";
import { CreateOfficerForm } from "./CreateOfficerForm";
import type { PoliceOfficerTiny } from "@/shared/types/backend-api.types";
import { SmoothLoadingOverlay } from "@/shared/components/ui/custom/smooth-loading-overlay";

// Helper function to format officer details
const formatOfficerDetails = (officer: PoliceOfficerTiny): string => {
	const parts: string[] = [];

	// Only add badge number if it exists and is not empty
	if (officer.badge_number && officer.badge_number.trim()) {
		parts.push(`Badge: ${officer.badge_number}`);
	}

	// Only add station name if it exists and is not empty
	if (officer.station_name && officer.station_name.trim()) {
		parts.push(officer.station_name);
	}

	// Return joined parts or "No details" if no parts exist
	return parts.length > 0 ? parts.join(" • ") : "No details";
};

interface OfficerSearchComboBoxProps {
	value?: number | null;
	onValueChange: (officerId: number | null) => void;
	placeholder?: string;
	emptyText?: string;
	disabled?: boolean;
	className?: string;
	required?: boolean;
	error?: boolean;
}

export const OfficerSearchComboBox = React.forwardRef<
	HTMLButtonElement,
	OfficerSearchComboBoxProps
>(
	(
		{
			value,
			onValueChange,
			placeholder = "Search officers...",
			emptyText = "No officers found",
			disabled = false,
			className,
			error = false,
		},
		ref
	) => {
		const [open, setOpen] = useState(false);
		const [searchQuery, setSearchQuery] = useState("");
		const [showCreateModal, setShowCreateModal] = useState(false);

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
		} = useOfficerSearch({
			query: searchQuery,
			enabled: open,
			loadInitialData: true,
		});

		const { data: selectedOfficer, isLoading: isLoadingSelectedOfficer } =
			useOfficerById(value ?? null);

		const createOfficerMutation = useCreatePoliceOfficer();

		// Reset search when closing
		useEffect(() => {
			if (!open) {
				setSearchQuery("");
			}
		}, [open]);

		const handleSelect = (officerId: number) => {
			onValueChange(officerId);
			setOpen(false);
		};

		const handleClear = (e: React.MouseEvent) => {
			e.stopPropagation();
			onValueChange(null);
		};

		const handleCreateOfficer = () => {
			setOpen(false);
			setShowCreateModal(true);
		};

		const handleCreateSubmit = async (data: any) => {
			try {
				const newOfficer = await createOfficerMutation.mutateAsync(
					data
				);
				setShowCreateModal(false);
				// Auto-select the newly created officer
				onValueChange(newOfficer.id);
			} catch (error) {
				// Error handling is done in the mutation
				throw error;
			}
		};

		const handleCreateCancel = () => {
			setShowCreateModal(false);
		};

		const displayValue = selectedOfficer?.full_name || null;

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
								{isLoadingSelectedOfficer ? (
									<div className="flex items-center gap-2 flex-1">
										<Skeleton className="h-4 w-4 rounded-full" />
										<Skeleton className="h-4 flex-1" />
									</div>
								) : displayValue ? (
									<>
										<Shield className="h-4 w-4 text-muted-foreground" />
										<span className="truncate">
											{displayValue}
										</span>
										{selectedOfficer && (
											<Badge
												variant="secondary"
												className="text-xs"
											>
												{selectedOfficer.rank_display}
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
								placeholder="Search officers..."
								value={searchQuery}
								onValueChange={setSearchQuery}
								isLoading={isSearching}
								loadingText="Searching officers..."
							/>
							<CommandList className="max-h-[300px] min-h-[120px]">
								<SmoothLoadingOverlay
									isInitialLoading={isInitialLoading}
									isSearching={isSearching}
									hasResults={
										!!searchResults?.results?.length
									}
									skeletonCount={4}
									skeletonType="officer"
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
															officer: PoliceOfficerTiny
														) => (
															<CommandItem
																key={officer.id}
																value={officer.id.toString()}
																onSelect={() =>
																	handleSelect(
																		officer.id
																	)
																}
																className="flex items-center gap-2"
															>
																<Check
																	className={cn(
																		"h-4 w-4",
																		value ===
																			officer.id
																			? "opacity-100"
																			: "opacity-0"
																	)}
																/>
																<Shield className="h-4 w-4 text-muted-foreground" />
																<div className="flex-1 min-w-0">
																	<div className="truncate">
																		{
																			officer.full_name
																		}
																	</div>
																	<div className="text-xs text-muted-foreground truncate">
																		{formatOfficerDetails(
																			officer
																		)}
																	</div>
																</div>
																<Badge
																	variant="secondary"
																	className="text-xs"
																>
																	{
																		officer.rank_display
																	}
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
													: "No officers available"}
											</div>
											{searchQuery && (
												<Button
													variant="outline"
													size="sm"
													onClick={
														handleCreateOfficer
													}
													className="w-full"
												>
													<Plus className="h-4 w-4 mr-2" />
													Create New Officer
												</Button>
											)}
										</div>
									) : (
										<CommandGroup>
											{searchResults.results
												.slice(0, 6)
												.map(
													(
														officer: PoliceOfficerTiny
													) => (
														<CommandItem
															key={officer.id}
															value={officer.id.toString()}
															onSelect={() =>
																handleSelect(
																	officer.id
																)
															}
															className="flex items-center gap-2"
														>
															<Check
																className={cn(
																	"h-4 w-4",
																	value ===
																		officer.id
																		? "opacity-100"
																		: "opacity-0"
																)}
															/>
															<Shield className="h-4 w-4 text-muted-foreground" />
															<div className="flex-1 min-w-0">
																<div className="truncate">
																	{
																		officer.full_name
																	}
																</div>
																<div className="text-xs text-muted-foreground truncate">
																	{formatOfficerDetails(
																		officer
																	)}
																</div>
															</div>
															<Badge
																variant="secondary"
																className="text-xs"
															>
																{
																	officer.rank_display
																}
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

				{/* Create Officer Modal */}
				<Dialog
					open={showCreateModal}
					onOpenChange={setShowCreateModal}
				>
					<DialogContent className="sm:max-w-[500px]">
						<DialogHeader>
							<DialogTitle>Create New Officer</DialogTitle>
							<DialogDescription>
								Add a new police officer to the system. Last
								name is required, first name is optional.
							</DialogDescription>
						</DialogHeader>
						<CreateOfficerForm
							onSubmit={handleCreateSubmit}
							onCancel={handleCreateCancel}
							isLoading={createOfficerMutation.isPending}
						/>
					</DialogContent>
				</Dialog>
			</>
		);
	}
);

OfficerSearchComboBox.displayName = "OfficerSearchComboBox";
