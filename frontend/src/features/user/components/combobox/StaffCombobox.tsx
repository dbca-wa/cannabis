import { useCallback } from "react";
import { User, X } from "lucide-react";
import { BaseCombobox } from "@/shared/components/combobox";
import { useUserById } from "@/features/user/hooks/useUserById";
import { searchUsers } from "@/features/user/services/users.service";
import {
	formatUserDisplayName,
	getUserRoleBadge,
	getUserRoleColorClass,
} from "@/features/user/utils/userDisplay.utils";
import { useTheme } from "@/shared/hooks/ui";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils/style.utils";
import type { IUser } from "@/features/user/types/users.types";

// ===================================== TYPES =====================================

interface StaffComboboxProps {
	value: number | null;
	onValueChange: (userId: number | null) => void;
	placeholder?: string;
	disabled?: boolean;
	allowCreate?: boolean;
	roleFilter?: "botanist" | "finance" | "all";
	className?: string;
}

// ===================================== COMPONENT =====================================

/**
 * StaffCombobox - Thin wrapper around BaseCombobox for staff/user selection.
 *
 * Drop-in replacement for UserSearchCombobox with the same external prop interface.
 * Uses BaseCombobox composition pattern with custom render functions.
 */
export const StaffCombobox = ({
	value,
	onValueChange,
	placeholder = "Search staff...",
	disabled = false,
	allowCreate: _allowCreate,
	roleFilter = "all",
	className,
}: StaffComboboxProps) => {
	const { theme } = useTheme();
	const isDark = theme === "dark";

	// Fetch the selected user for display
	const { data: selectedUser } = useUserById(value);

	// Search function for BaseCombobox
	const searchFn = useCallback(
		async (searchTerm: string): Promise<IUser[]> => {
			const data = await searchUsers({
				query: searchTerm,
				role: roleFilter !== "all" ? roleFilter : undefined,
				limit: 10,
			});

			// Client-side role filtering (admin always visible)
			if (roleFilter && roleFilter !== "all") {
				return data.results.filter((user: IUser) => {
					if (user.is_superuser || user.is_staff) return true;
					return user.role === roleFilter;
				});
			}

			return data.results;
		},
		[roleFilter]
	);

	// Handle selection change — map IUser to userId
	const handleChange = useCallback(
		(user: IUser | null) => {
			onValueChange(user ? user.id : null);
		},
		[onValueChange]
	);

	// Render the selected user display
	const renderSelected = useCallback(
		(user: IUser, onClear: () => void) => (
			<div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm w-full">
				<User className="h-4 w-4 text-muted-foreground shrink-0" />
				<span className="truncate flex-1">{formatUserDisplayName(user)}</span>
				<Badge
					variant="secondary"
					className={cn(
						"text-xs shrink-0",
						getUserRoleColorClass(user, isDark)
					)}
				>
					{getUserRoleBadge(user)}
				</Badge>
				{!disabled && (
					<button
						type="button"
						onClick={onClear}
						className="h-4 w-4 p-0 hover:bg-muted rounded-sm cursor-pointer flex items-center justify-center shrink-0"
						aria-label="Clear selection"
					>
						<X className="h-3 w-3" />
					</button>
				)}
			</div>
		),
		[isDark, disabled]
	);

	// Render a menu item in the dropdown
	const renderMenuItem = useCallback(
		(user: IUser, onSelect: (item: IUser) => void, isHighlighted: boolean) => (
			<button
				type="button"
				onClick={() => onSelect(user)}
				className={cn(
					"w-full text-left px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer",
					isHighlighted && "bg-gray-100 dark:bg-gray-600"
				)}
			>
				<User className="h-4 w-4 text-muted-foreground shrink-0" />
				<div className="flex-1 min-w-0">
					<div className="truncate text-sm">{formatUserDisplayName(user)}</div>
					<div className="text-xs text-muted-foreground truncate">
						{user.email}
					</div>
				</div>
				<Badge
					variant="secondary"
					className={cn(
						"text-xs shrink-0",
						getUserRoleColorClass(user, isDark)
					)}
				>
					{getUserRoleBadge(user)}
				</Badge>
			</button>
		),
		[isDark]
	);

	return (
		<BaseCombobox<IUser>
			searchFn={searchFn}
			value={selectedUser ?? null}
			onChange={handleChange}
			getItemKey={(user) => user.id}
			renderSelected={renderSelected}
			renderMenuItem={renderMenuItem}
			placeholder={placeholder}
			disabled={disabled}
			className={className}
			debounceMs={300}
			maxResults={10}
		/>
	);
};

StaffCombobox.displayName = "StaffCombobox";
