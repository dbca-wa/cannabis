// ===================================== IMPORTS =====================================
import { useTheme } from "@/shared/hooks/ui";
import React, { useEffect, useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/shared/components/ui/popover";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/utils";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Check, ChevronsUpDown, User, X, UserPlus, Plus } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import {
	formatUserDisplayName,
	getUserRoleBadge,
	getUserRoleColorClass,
} from "../../utils/userDisplay.utils";
import { SmoothLoadingOverlay } from "@/shared/components/ui/custom/smooth-loading-overlay";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/shared/components/ui/command";
import { CommandInputWithLoading } from "@/shared/components/ui/custom/command-input-with-loading";

import { useLocalStorage } from "@/shared/hooks/core";
import { useUserSearch } from "../../hooks/useUserSearch";
import { useUserById } from "../../hooks/useUserById";
import { InviteUserModal } from "./InviteUserModal";
import type { IUser } from "../../types/users.types";

// ===================================== COMPONENT =====================================

interface UserSearchComboboxProps {
	value?: number | null;
	onValueChange: (userId: number | null) => void;
	placeholder?: string;
	emptyText?: string;
	disabled?: boolean;
	className?: string;
	kind?: "All" | "DBCA";
	exclude?: number[];
	required?: boolean;
	error?: boolean;
	allowCreate?: boolean; // Whether to show the "Invite User" button
	showExternalInviteButton?: boolean; // Whether to show external "Invite" button to the right
	roleFilter?: "botanist" | "finance" | "all"; // Filter users by role (admin always visible)
	/**
	 * When set, the most recently selected user is remembered (per key) and
	 * pinned in a "Last used" group at the top of the list so the user does not
	 * have to search for a frequently-used selection.
	 */
	lastUsedKey?: string;
}

export const UserSearchCombobox = React.forwardRef<
	HTMLButtonElement,
	UserSearchComboboxProps
>(
	(
		{
			value,
			onValueChange,
			placeholder = "Search users...",
			emptyText = "No users found",
			disabled = false,
			className,
			exclude = [],
			error = false,
			allowCreate = true,
			showExternalInviteButton = false,
			roleFilter = "all",
			lastUsedKey,
		},
		ref
	) => {
		const [open, setOpen] = useState(false);
		const [searchQuery, setSearchQuery] = useState("");
		const [showInviteModal, setShowInviteModal] = useState(false);
		const [showExternalInviteModal, setShowExternalInviteModal] =
			useState(false);
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
		} = useUserSearch({
			query: searchQuery,
			role: roleFilter !== "all" ? roleFilter : undefined,
			exclude,
			enabled: open,
			loadInitialData: true,
			limit: 50,
			initialDataLimit: 50,
		});

		const { data: selectedUser, isLoading: isLoadingSelectedUser } =
			useUserById(value ?? null);

		// Remember the most recently selected user (per key) for the "Last used"
		// shortcut. No-op when lastUsedKey is not provided.
		const { value: lastUsedUser, setValue: setLastUsedUser } =
			useLocalStorage<IUser | null>(
				`cannabis_last_used_user_${lastUsedKey ?? "none"}`,
				null
			);

		// Reset search when closing
		useEffect(() => {
			if (!open) {
				setSearchQuery("");
			}
		}, [open]);

		const handleSelect = (user: IUser) => {
			onValueChange(user.id);
			if (lastUsedKey) {
				setLastUsedUser(user);
			}
			setOpen(false);
		};

		const handleClear = (e: React.MouseEvent) => {
			e.stopPropagation();
			onValueChange(null);
		};

		const handleInviteUser = () => {
			setOpen(false);
			setShowInviteModal(true);
		};

		const handleUserInvited = () => {
			// Note: inviteUser returns InviteRecord, not User
			// The actual User is only created when the invitation is activated
			// Cannot auto-select since we don't have a user ID yet
			// Just close the dropdown
			setOpen(false);
		};

		const handleExternalInviteUser = () => {
			setShowExternalInviteModal(true);
		};

		const handleExternalUserInvited = () => {
			// Note: inviteUser returns InviteRecord, not User
			// The actual User is only created when the invitation is activated
			// Just close the dropdown if it's open
			setOpen(false);
		};

		const renderUserItem = (user: IUser) => (
			<CommandItem
				key={user.id}
				value={user.id.toString()}
				onSelect={() => handleSelect(user)}
				className="flex items-center gap-2"
			>
				<Check
					className={cn(
						"h-4 w-4",
						value === user.id ? "opacity-100" : "opacity-0"
					)}
				/>
				<User className="h-4 w-4 text-muted-foreground" />
				<div className="flex-1 min-w-0">
					<div className="truncate">{formatUserDisplayName(user)}</div>
					<div className="text-xs text-muted-foreground truncate">
						{user.email}
					</div>
				</div>
				<Badge
					variant="secondary"
					className={cn("text-xs", getUserRoleColorClass(user, isDark))}
				>
					{getUserRoleBadge(user)}
				</Badge>
			</CommandItem>
		);

		const displayValue = selectedUser
			? formatUserDisplayName(selectedUser)
			: null;

		// "Last used" shortcut: shown only in the default (non-search) state. The
		// pinned user is filtered out of the main list to avoid duplication.
		const rawResults = searchResults?.results ?? [];

		// Sort results alphabetically by first name
		const sortedResults = [...rawResults].sort((a, b) => {
			const nameA = (a.given_names ?? a.full_name ?? "").toLowerCase();
			const nameB = (b.given_names ?? b.full_name ?? "").toLowerCase();
			return nameA.localeCompare(nameB);
		});

		// Validate the cached last-used user against fresh results. Only runs when
		// the dropdown is open and results have loaded. If the cached ID isn't found
		// in this result set we don't clear the cache — the user may be valid but
		// simply not in the current page of results.
		useEffect(() => {
			if (!lastUsedKey || !lastUsedUser || !open || sortedResults.length === 0)
				return;
			const freshMatch = sortedResults.find((u) => u.id === lastUsedUser.id);
			if (freshMatch) {
				// ID still valid — update the cached object if stale
				if (
					freshMatch.email !== lastUsedUser.email ||
					freshMatch.full_name !== lastUsedUser.full_name
				) {
					setLastUsedUser(freshMatch);
				}
				return;
			}
			// ID not found in results — try matching by email
			const emailMatch = sortedResults.find(
				(u) =>
					u.email.toLowerCase() === (lastUsedUser.email ?? "").toLowerCase()
			);
			if (emailMatch) {
				setLastUsedUser(emailMatch); // Update cache with correct current ID
			}
			// Don't clear — the user might be valid but just not in this result set
		}, [sortedResults, lastUsedUser, lastUsedKey, setLastUsedUser, open]);

		const showLastUsed =
			!!lastUsedKey &&
			!!lastUsedUser &&
			!searchQuery.trim() &&
			!searchError &&
			sortedResults.some((u) => u.id === lastUsedUser.id);
		const mainResults =
			showLastUsed && lastUsedUser
				? sortedResults.filter((u) => u.id !== lastUsedUser.id)
				: sortedResults;

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
							{isLoadingSelectedUser ? (
								<div className="flex items-center gap-2 flex-1">
									<Skeleton className="h-4 w-4 rounded-full" />
									<Skeleton className="h-4 flex-1" />
								</div>
							) : displayValue ? (
								<>
									<User className="h-4 w-4 text-muted-foreground" />
									<span className="truncate">{displayValue}</span>
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
							placeholder="Search users..."
							value={searchQuery}
							onValueChange={setSearchQuery}
							isLoading={isSearching}
							loadingText="Searching users..."
						/>
						<CommandList className="max-h-[300px] min-h-[120px]">
							<SmoothLoadingOverlay
								isInitialLoading={isInitialLoading}
								isSearching={isSearching}
								hasResults={!!searchResults?.results?.length}
								skeletonCount={4}
								skeletonType="user"
								error={searchError}
								onRetry={retry}
								isRetrying={isRetrying}
								hasFallbackData={hasInitialData && !!searchError}
								fallbackMessage={
									hasInitialData ? "Showing cached results" : undefined
								}
							>
								{/* Show search error with fallback to initial data */}
								{searchError && hasInitialData && searchQuery ? (
									<>
										<div className="p-2 border-l-2 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
											<div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400">
												<span>Search failed. Showing cached results.</span>
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
											{initialData?.map(renderUserItem)}
										</CommandGroup>
									</>
								) : !searchResults?.results?.length ? (
									<div className="p-4 text-center">
										<div className="text-sm text-muted-foreground mb-3">
											{searchQuery ? emptyText : "No users available"}
										</div>
										{allowCreate && (
											<Button
												size="sm"
												onClick={handleInviteUser}
												className="w-full bg-green-600 hover:bg-green-700 text-white"
											>
												<UserPlus className="h-4 w-4 mr-2" />
												Invite User
											</Button>
										)}
									</div>
								) : (
									<>
										{showLastUsed && lastUsedUser && (
											<>
												<CommandGroup heading="Last used">
													{renderUserItem(lastUsedUser)}
												</CommandGroup>
												<CommandSeparator />
											</>
										)}
										{mainResults.length > 0 && (
											<CommandGroup>
												{mainResults.map(renderUserItem)}
											</CommandGroup>
										)}
									</>
								)}
							</SmoothLoadingOverlay>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>
		);

		return (
			<>
				{showExternalInviteButton ? (
					<div className="flex items-center gap-2">
						<div className="flex-1">{comboboxElement}</div>
						<Button
							onClick={handleExternalInviteUser}
							disabled={disabled}
							className="bg-green-600 hover:bg-green-700 text-white"
						>
							<Plus className="h-4 w-4 mr-2" />
							Invite
						</Button>
					</div>
				) : (
					comboboxElement
				)}

				{/* Invite User Modal */}
				<InviteUserModal
					open={showInviteModal}
					onOpenChange={setShowInviteModal}
					onCreate={handleUserInvited}
					lockedRole={roleFilter !== "all" ? roleFilter : null}
				/>

				{/* External Invite User Modal */}
				<InviteUserModal
					open={showExternalInviteModal}
					onOpenChange={setShowExternalInviteModal}
					onCreate={handleExternalUserInvited}
					lockedRole={roleFilter !== "all" ? roleFilter : null}
				/>
			</>
		);
	}
);

UserSearchCombobox.displayName = "UserSearchCombobox";
