import { useState, useCallback } from "react";

export interface BulkSelectionState {
	selectedItems: Set<string | number>;
	isAllSelected: boolean;
	isIndeterminate: boolean;
	selectedCount: number;
	totalCount: number;
	// New state for database-wide selection
	isSelectAllInDatabase: boolean;
	totalDatabaseCount: number;
}

export interface BulkSelectionActions<T> {
	toggleItem: (id: string | number) => void;
	toggleAll: () => void;
	clearSelection: () => void;
	selectItems: (ids: (string | number)[]) => void;
	isSelected: (id: string | number) => boolean;
	getSelectedItems: () => T[];
	// New actions for database-wide selection
	toggleSelectAllInDatabase: () => void;
	setSelectAllInDatabase: (enabled: boolean) => void;
}

export interface UseBulkSelectionOptions<T> {
	items: T[];
	getItemId: (item: T) => string | number;
	onSelectionChange?: (selectedItems: T[]) => void;
	// New options for database-wide selection
	totalDatabaseCount?: number;
	onSelectAllInDatabaseChange?: (enabled: boolean) => void;
}

/**
 * Hook for managing bulk selection state in tables
 * Provides selection state and actions for bulk operations
 * Supports both page-level and database-wide selection
 */
export function useBulkSelection<T>({
	items,
	getItemId,
	onSelectionChange,
	totalDatabaseCount = 0,
	onSelectAllInDatabaseChange,
}: UseBulkSelectionOptions<T>): BulkSelectionState & BulkSelectionActions<T> {
	const [selectedItems, setSelectedItems] = useState<Set<string | number>>(
		new Set()
	);
	const [isSelectAllInDatabase, setIsSelectAllInDatabase] = useState(false);

	const totalCount = items.length;
	const selectedCount = selectedItems.size;
	const isAllSelected = totalCount > 0 && selectedCount === totalCount;
	const isIndeterminate = selectedCount > 0 && selectedCount < totalCount;

	const toggleItem = useCallback(
		(id: string | number) => {
			setSelectedItems((prev) => {
				const newSet = new Set(prev);
				if (newSet.has(id)) {
					newSet.delete(id);
				} else {
					newSet.add(id);
				}

				// Notify parent of selection change
				if (onSelectionChange) {
					const selectedItemsArray = items.filter((item) =>
						newSet.has(getItemId(item))
					);
					onSelectionChange(selectedItemsArray);
				}

				return newSet;
			});
		},
		[items, getItemId, onSelectionChange]
	);

	const toggleAll = useCallback(() => {
		setSelectedItems(() => {
			const newSet = new Set<string | number>();

			// If not all selected, select all
			if (!isAllSelected) {
				items.forEach((item) => {
					newSet.add(getItemId(item));
				});
			}
			// If all selected, clear selection (newSet remains empty)

			// Notify parent of selection change
			if (onSelectionChange) {
				const selectedItemsArray = items.filter((item) =>
					newSet.has(getItemId(item))
				);
				onSelectionChange(selectedItemsArray);
			}

			return newSet;
		});
	}, [items, getItemId, isAllSelected, onSelectionChange]);

	const clearSelection = useCallback(() => {
		setSelectedItems(new Set());
		setIsSelectAllInDatabase(false);
		if (onSelectionChange) {
			onSelectionChange([]);
		}
		if (onSelectAllInDatabaseChange) {
			onSelectAllInDatabaseChange(false);
		}
	}, [onSelectionChange, onSelectAllInDatabaseChange]);

	const selectItems = useCallback(
		(ids: (string | number)[]) => {
			const newSet = new Set(ids);
			setSelectedItems(newSet);

			if (onSelectionChange) {
				const selectedItemsArray = items.filter((item) =>
					newSet.has(getItemId(item))
				);
				onSelectionChange(selectedItemsArray);
			}
		},
		[items, getItemId, onSelectionChange]
	);

	const isSelected = useCallback(
		(id: string | number) => selectedItems.has(id),
		[selectedItems]
	);

	const getSelectedItems = useCallback(() => {
		return items.filter((item) => selectedItems.has(getItemId(item)));
	}, [items, selectedItems, getItemId]);

	const toggleSelectAllInDatabase = useCallback(() => {
		const newValue = !isSelectAllInDatabase;
		setIsSelectAllInDatabase(newValue);

		// Clear individual selections when toggling database selection
		if (newValue) {
			setSelectedItems(new Set());
			if (onSelectionChange) {
				onSelectionChange([]);
			}
		}

		if (onSelectAllInDatabaseChange) {
			onSelectAllInDatabaseChange(newValue);
		}
	}, [isSelectAllInDatabase, onSelectionChange, onSelectAllInDatabaseChange]);

	const setSelectAllInDatabase = useCallback(
		(enabled: boolean) => {
			setIsSelectAllInDatabase(enabled);

			// Clear individual selections when enabling database selection
			if (enabled) {
				setSelectedItems(new Set());
				if (onSelectionChange) {
					onSelectionChange([]);
				}
			}

			if (onSelectAllInDatabaseChange) {
				onSelectAllInDatabaseChange(enabled);
			}
		},
		[onSelectionChange, onSelectAllInDatabaseChange]
	);

	return {
		// State
		selectedItems,
		isAllSelected,
		isIndeterminate,
		selectedCount,
		totalCount,
		isSelectAllInDatabase,
		totalDatabaseCount,
		// Actions
		toggleItem,
		toggleAll,
		clearSelection,
		selectItems,
		isSelected,
		getSelectedItems,
		toggleSelectAllInDatabase,
		setSelectAllInDatabase,
	};
}
