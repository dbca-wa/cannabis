import { useCallback } from "react";
import { User, X } from "lucide-react";
import { BaseCombobox } from "@/shared/components/combobox";
import { useDefendantById } from "../../hooks/useDefendants";
import { searchDefendants } from "../../services/defendants.service";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils/style.utils";
import {
	formatDefendantDisplayName,
	getDefendantCasesBadge,
	getDefendantCasesBadgeColourClass,
} from "@/shared/utils/defendant-display.utils";
import type { DefendantTiny } from "@/shared/types/backend-api.types";

// ===================================== TYPES =====================================

interface DefendantComboboxProps {
	value: number | null;
	onValueChange: (defendantId: number | null) => void;
	placeholder?: string;
	disabled?: boolean;
	allowCreate?: boolean;
	className?: string;
}

// ===================================== COMPONENT =====================================

/**
 * DefendantCombobox - Thin wrapper around BaseCombobox for defendant selection.
 *
 * Drop-in replacement for DefendantSearchCombobox with the same external prop interface.
 * Uses BaseCombobox composition pattern with custom render functions.
 */
export const DefendantCombobox = ({
	value,
	onValueChange,
	placeholder = "Search defendants...",
	disabled = false,
	allowCreate: _allowCreate,
	className,
}: DefendantComboboxProps) => {
	// Fetch the selected defendant for display
	const { data: selectedDefendant } = useDefendantById(value);

	// Search function for BaseCombobox
	const searchFn = useCallback(
		async (searchTerm: string): Promise<DefendantTiny[]> => {
			const result = await searchDefendants({
				search: searchTerm,
				limit: 10,
			});
			return result.results;
		},
		[]
	);

	// Handle selection change — map DefendantTiny to defendantId
	const handleChange = useCallback(
		(defendant: DefendantTiny | null) => {
			onValueChange(defendant ? defendant.id : null);
		},
		[onValueChange]
	);

	// Render the selected defendant display
	const renderSelected = useCallback(
		(defendant: DefendantTiny, onClear: () => void) => (
			<div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm w-full">
				<User className="h-4 w-4 text-muted-foreground shrink-0" />
				<span className="truncate flex-1">
					{formatDefendantDisplayName(defendant)}
				</span>
				<Badge
					variant="secondary"
					className={cn(
						"text-xs shrink-0",
						getDefendantCasesBadgeColourClass(defendant)
					)}
				>
					{getDefendantCasesBadge(defendant)}
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
		[disabled]
	);

	// Render a menu item in the dropdown
	const renderMenuItem = useCallback(
		(
			defendant: DefendantTiny,
			onSelect: (item: DefendantTiny) => void,
			isHighlighted: boolean
		) => (
			<button
				type="button"
				onClick={() => onSelect(defendant)}
				className={cn(
					"w-full text-left px-3 py-2 flex items-center gap-2 transition-colors cursor-pointer",
					isHighlighted && "bg-gray-100 dark:bg-gray-600"
				)}
			>
				<User className="h-4 w-4 text-muted-foreground shrink-0" />
				<div className="flex-1 min-w-0">
					<div className="truncate text-sm">
						{formatDefendantDisplayName(defendant)}
					</div>
				</div>
				<Badge
					variant="secondary"
					className={cn(
						"text-xs shrink-0",
						getDefendantCasesBadgeColourClass(defendant)
					)}
				>
					{getDefendantCasesBadge(defendant)}
				</Badge>
			</button>
		),
		[]
	);

	return (
		<BaseCombobox<DefendantTiny>
			searchFn={searchFn}
			value={selectedDefendant ?? null}
			onChange={handleChange}
			getItemKey={(defendant) => defendant.id}
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

DefendantCombobox.displayName = "DefendantCombobox";
