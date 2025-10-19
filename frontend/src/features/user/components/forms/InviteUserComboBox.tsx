import React, { useEffect, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils";
import { Check, ChevronsUpDown, UserPlus, X } from "lucide-react";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { CommandInputWithLoading } from "@/shared/components/ui/custom/command-input-with-loading";

import { useExternalUserSearch } from "../../hooks/useExternalUserSearch";
import type { ExternalUser } from "@/shared/types/backend-api.types";
import { SmoothLoadingOverlay } from "@/shared/components/ui/custom/smooth-loading-overlay";

interface InviteUserComboBoxProps {
	value?: string | null; // Using email as the value since external users don't have our system IDs
	onValueChange: (
		userEmail: string | null,
		userData: ExternalUser | null
	) => void;
	placeholder?: string;
	emptyText?: string;
	disabled?: boolean;
	className?: string;
	required?: boolean;
	error?: boolean;
}

export const InviteUserComboBox = React.forwardRef<
	HTMLButtonElement,
	InviteUserComboBoxProps
>(
	(
		{
			value,
			onValueChange,
			placeholder = "Search external users...",
			emptyText = "No external users found",
			disabled = false,
			className,
			error = false,
		},
		ref
	) => {
		const [open, setOpen] = useState(false);
		const [searchQuery, setSearchQuery] = useState("");
		const [selectedUserData, setSelectedUserData] =
			useState<ExternalUser | null>(null);

		// Queries with error handling
		const {
			data: searchResults,
			isLoading: isSearching,
			error: searchError,
			retry,
			isRetrying,
		} = useExternalUserSearch({
			query: searchQuery,
			enabled: open,
		});

		// Reset search when closing
		useEffect(() => {
			if (!open) {
				setSearchQuery("");
			}
		}, [open]);

		const handleSelect = (user: ExternalUser) => {
			setSelectedUserData(user);
			onValueChange(user.email, user);
			setOpen(false);
		};

		const handleClear = (e: React.MouseEvent) => {
			e.stopPropagation();
			setSelectedUserData(null);
			onValueChange(null, null);
		};

		const displayValue = selectedUserData?.full_name || null;

		return (
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
							{displayValue ? (
								<>
									<UserPlus className="h-4 w-4 text-muted-foreground" />
									<div className="flex-1 min-w-0">
										<div className="truncate">
											{displayValue}
										</div>
										{selectedUserData && (
											<div className="text-xs text-muted-foreground truncate">
												{selectedUserData.email}
											</div>
										)}
									</div>
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
							placeholder="Search external users..."
							value={searchQuery}
							onValueChange={setSearchQuery}
							isLoading={isSearching}
							loadingText="Searching external users..."
						/>
						<CommandList className="max-h-[300px] min-h-[120px]">
							<SmoothLoadingOverlay
								isInitialLoading={false}
								isSearching={isSearching}
								hasResults={!!searchResults?.results?.length}
								skeletonCount={4}
								skeletonType="simple"
								error={searchError}
								onRetry={retry}
								isRetrying={isRetrying}
							>
								{!searchResults?.results?.length ? (
									<CommandEmpty>
										{searchQuery.length < 2
											? "Type at least 2 characters to search"
											: emptyText}
									</CommandEmpty>
								) : (
									<CommandGroup>
										{searchResults.results
											.slice(0, 6)
											.map((user: ExternalUser) => (
												<CommandItem
													key={user.email}
													value={user.email}
													onSelect={() =>
														handleSelect(user)
													}
													className="flex items-center gap-2"
												>
													<Check
														className={cn(
															"h-4 w-4",
															value === user.email
																? "opacity-100"
																: "opacity-0"
														)}
													/>
													<UserPlus className="h-4 w-4 text-muted-foreground" />
													<div className="flex-1 min-w-0">
														<div className="truncate font-medium">
															{user.full_name}
														</div>
														<div className="text-xs text-muted-foreground truncate">
															{user.email}
														</div>
														{user.title && (
															<div className="text-xs text-muted-foreground truncate">
																{user.title}
															</div>
														)}
													</div>
												</CommandItem>
											))}
									</CommandGroup>
								)}
							</SmoothLoadingOverlay>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		);
	}
);

InviteUserComboBox.displayName = "InviteUserComboBox";
