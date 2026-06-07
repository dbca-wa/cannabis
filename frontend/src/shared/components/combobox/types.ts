import type { ReactNode } from "react";

/**
 * Base Combobox Props
 * Generic props interface for BaseCombobox component
 *
 * @template T - The type of items in the combobox (e.g., IUserData, IAffiliation)
 */
export interface BaseComboboxProps<T> {
	// Core functionality
	searchFn: (searchTerm: string) => Promise<T[]>;
	value?: T | null;
	onChange: (value: T | null) => void;
	getItemKey: (item: T) => string | number;

	// Custom rendering (composition pattern)
	renderSelected: (item: T, onClear: () => void) => ReactNode;
	renderMenuItem: (
		item: T,
		onSelect: (item: T) => void,
		isHighlighted: boolean
	) => ReactNode;

	// Optional "add new" functionality
	onCreateNew?: (searchTerm: string) => Promise<T>;
	createNewLabel?: (searchTerm: string) => string;

	// Optional "create new" click handler (fire-and-forget, no loading state)
	// Use this instead of onCreateNew when the creation happens in a modal
	onCreateNewClick?: () => void;
	createNewClickLabel?: string;

	// UI customisation
	label?: string;
	placeholder?: string;
	helperText?: string;
	showIcon?: boolean;
	icon?: ReactNode;
	autoFocus?: boolean;
	isRequired?: boolean;
	isEditable?: boolean;
	disabled?: boolean;
	className?: string;
	wrapperClassName?: string;

	// Accessibility
	ariaLabel?: string; // Fallback accessible name when label is not provided

	// Search configuration
	debounceMs?: number;
	maxResults?: number;
	minSearchLength?: number;
}

/**
 * Base Combobox Ref
 * Methods exposed via ref for external control
 */
export interface BaseComboboxRef {
	focusInput: () => void;
	clearSelection: () => void;
}
