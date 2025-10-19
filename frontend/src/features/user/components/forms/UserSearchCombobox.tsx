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
import { Check, ChevronsUpDown, User, X, UserPlus } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { UsersService } from "../../services/users.service";
import { SmoothLoadingOverlay } from "@/shared/components/ui/custom/smooth-loading-overlay";
import {
	Command,
	CommandGroup,
	CommandItem,
	CommandList,
} from "@/shared/components/ui/command";
import { CommandInputWithLoading } from "@/shared/components/ui/custom/command-input-with-loading";

import { useUserSearch } from "../../hooks/useUserSearch";
import { useUserById } from "../../hooks/useUserById";
import { useUsers } from "../../hooks/useUsers";
import InviteUserForm from "./InviteUserForm";
import type { InviteUserFormData } from "./InviteUserForm";
import type { ExternalUser } from "@/shared/types/backend-api.types";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/shared/components/ui/dialog";

// Import types for proper typing
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
		},
		ref
	) => {
		const [open, setOpen] = useState(false);
		const [searchQuery, setSearchQuery] = useState("");
		const [showInviteModal, setShowInviteModal] = useState(false);
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
			exclude,
			enabled: open,
			loadInitialData: true,
		});

		const { data: selectedUser, isLoading: isLoadingSelectedUser } =
			useUserById(value ?? null);

		const { isInviting, inviteUser } = useUsers();

		// Reset search when closing
		useEffect(() => {
			if (!open) {
				setSearchQuery("");
			}
		}, [open]);

		const handleSelect = (userId: number) => {
			onValueChange(userId);
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

		const handleInviteSubmit = (
			data: InviteUserFormData & { external_user_data: ExternalUser }
		) => {
			inviteUser(data, {
				onSuccess: (newUser) => {
					setShowInviteModal(false);
					// Auto-select the newly created user
					onValueChange(newUser.id);
				},
				onError: (error) => {
					console.error("Invite error:", error);
					// Error is already handled by the hook (toast)
				},
			});
		};

		const handleInviteCancel = () => {
			setShowInviteModal(false);
		};

		const displayValue = selectedUser
			? UsersService.formatUserDisplayName(selectedUser) // Now selectedUser is IUserDetail | null
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
								{isLoadingSelectedUser ? (
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
										{selectedUser && (
											<Badge
												variant="secondary"
												className={cn(
													"text-xs",
													UsersService.getUserRoleColorClass(
														selectedUser,
														isDark
													)
												)}
											>
												{UsersService.getUserRoleBadge(
													selectedUser
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
									hasResults={
										!!searchResults?.results?.length
									}
									skeletonCount={4}
									skeletonType="user"
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
													.map((user: IUser) => (
														<CommandItem
															key={user.id}
															value={user.id.toString()}
															onSelect={() =>
																handleSelect(
																	user.id
																)
															}
															className="flex items-center gap-2"
														>
															<Check
																className={cn(
																	"h-4 w-4",
																	value ===
																		user.id
																		? "opacity-100"
																		: "opacity-0"
																)}
															/>
															<User className="h-4 w-4 text-muted-foreground" />
															<div className="flex-1 min-w-0">
																<div className="truncate">
																	{UsersService.formatUserDisplayName(
																		user
																	)}
																</div>
																<div className="text-xs text-muted-foreground truncate">
																	{user.email}
																</div>
															</div>
															<Badge
																variant="secondary"
																className={cn(
																	"text-xs",
																	UsersService.getUserRoleColorClass(
																		user,
																		isDark
																	)
																)}
															>
																{UsersService.getUserRoleBadge(
																	user
																)}
															</Badge>
														</CommandItem>
													))}
											</CommandGroup>
										</>
									) : !searchResults?.results?.length ? (
										<div className="p-4 text-center">
											<div className="text-sm text-muted-foreground mb-3">
												{searchQuery
													? emptyText
													: "No users available"}
											</div>
											{searchQuery && (
												<Button
													variant="outline"
													size="sm"
													onClick={handleInviteUser}
													className="w-full"
												>
													<UserPlus className="h-4 w-4 mr-2" />
													Invite User
												</Button>
											)}
										</div>
									) : (
										<CommandGroup>
											{searchResults.results
												.slice(0, 6)
												.map((user: IUser) => (
													<CommandItem
														key={user.id}
														value={user.id.toString()}
														onSelect={() =>
															handleSelect(
																user.id
															)
														}
														className="flex items-center gap-2"
													>
														<Check
															className={cn(
																"h-4 w-4",
																value ===
																	user.id
																	? "opacity-100"
																	: "opacity-0"
															)}
														/>
														<User className="h-4 w-4 text-muted-foreground" />
														<div className="flex-1 min-w-0">
															<div className="truncate">
																{UsersService.formatUserDisplayName(
																	user
																)}
															</div>
															<div className="text-xs text-muted-foreground truncate">
																{user.email}
															</div>
														</div>
														<Badge
															variant="secondary"
															className={cn(
																"text-xs",
																UsersService.getUserRoleColorClass(
																	user,
																	isDark
																)
															)}
														>
															{UsersService.getUserRoleBadge(
																user
															)}
														</Badge>
													</CommandItem>
												))}
										</CommandGroup>
									)}
								</SmoothLoadingOverlay>
							</CommandList>
						</Command>
					</PopoverContent>
				</Popover>

				{/* Invite User Modal */}
				<Dialog
					open={showInviteModal}
					onOpenChange={setShowInviteModal}
				>
					<DialogContent className="sm:max-w-[500px]">
						<DialogHeader>
							<DialogTitle>Invite User</DialogTitle>
							<DialogDescription>
								Search for and invite an external user to join
								the system
							</DialogDescription>
						</DialogHeader>
						<InviteUserForm
							onCancel={handleInviteCancel}
							onSubmit={handleInviteSubmit}
							isSubmitting={isInviting}
						/>
					</DialogContent>
				</Dialog>
			</>
		);
	}
);

UserSearchCombobox.displayName = "UserSearchCombobox";
