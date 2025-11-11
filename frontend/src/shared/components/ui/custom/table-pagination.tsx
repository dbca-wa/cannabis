import { observer } from "mobx-react-lite";
import { Button } from "@/shared/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/components/ui/select";
import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import { useBreakpoint } from "@/shared/hooks/ui/useResponsive";
import { useUIStore } from "@/app/providers/store.provider";

// Helper function to generate page numbers for pagination
export const generatePageNumbers = (
	currentPage: number,
	totalPages: number,
	maxVisible: number = 5
) => {
	if (totalPages <= maxVisible) {
		return Array.from({ length: totalPages }, (_, i) => i + 1);
	}

	const half = Math.floor(maxVisible / 2);
	let start = Math.max(1, currentPage - half);
	let end = Math.min(totalPages, start + maxVisible - 1);

	// Adjust start if we're near the end
	if (end - start + 1 < maxVisible) {
		start = Math.max(1, end - maxVisible + 1);
	}

	return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

interface TablePaginationProps {
	// Current pagination state
	currentPage: number;
	totalPages: number;
	totalItems: number;
	itemsShown: number;

	// Pagination controls
	onPageChange: (page: number) => void;
	onPageSizeChange?: (pageSize: number) => void;

	// Optional overrides
	pageSize?: number;
	pageSizeOptions?: number[];
	showPageSizeSelector?: boolean;

	// Loading state
	isLoading?: boolean;
}

/**
 * Unified table pagination component that syncs with global user preferences
 * Supports both client-side and server-side pagination patterns
 */
export const TablePagination = observer<TablePaginationProps>(
	({
		currentPage,
		totalPages,
		totalItems,
		itemsShown,
		onPageChange,
		onPageSizeChange,
		pageSize: overridePageSize,
		pageSizeOptions = [10, 25, 50, 100],
		showPageSizeSelector = true,
		isLoading = false,
	}) => {
		const { isMobile } = useBreakpoint();
		const uiStore = useUIStore();

		// Use global preference or override
		const currentPageSize = overridePageSize || uiStore.itemsPerPage;

		const handlePageSizeChange = async (newPageSize: string) => {
			const pageSize = parseInt(newPageSize) as 10 | 25 | 50 | 100;

			// Update global preference
			await uiStore.setItemsPerPage(pageSize);

			// Call local handler if provided
			onPageSizeChange?.(pageSize);
		};

		const canGoPrevious = currentPage > 1 && !isLoading;
		const canGoNext = currentPage < totalPages && !isLoading;

		// Generate page numbers for pagination
		const pageNumbers = generatePageNumbers(
			currentPage,
			totalPages,
			isMobile ? 3 : 5
		);

		// Don't render if no items
		if (totalItems === 0) {
			return null;
		}

		return (
			<div className="py-4">
				{/* Bottom row: Results info on left, page size on right */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
					{/* Left: Results info */}
					<div className="text-sm text-muted-foreground">
						Showing {itemsShown} of {totalItems} items
					</div>

					{/* Right: Page size selector */}
					{showPageSizeSelector && (
						<div className="flex items-center gap-2 text-sm">
							<span className="text-muted-foreground">Show</span>
							<Select
								value={currentPageSize.toString()}
								onValueChange={handlePageSizeChange}
								disabled={isLoading}
							>
								<SelectTrigger className="w-16 h-8">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{pageSizeOptions.map((size) => (
										<SelectItem
											key={size}
											value={size.toString()}
										>
											{size}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<span className="text-muted-foreground">
								per page
							</span>
						</div>
					)}
				</div>

				{/* Center: Pagination controls (only show if more than 1 page) */}
				{totalPages > 1 && (
					<div className="flex items-center justify-center gap-1">
						{/* First page button */}
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(1)}
							disabled={!canGoPrevious}
							className="h-8 w-8 p-0"
							title="First page"
						>
							<ChevronsLeft className="h-4 w-4" />
						</Button>

						{/* Previous page button */}
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(currentPage - 1)}
							disabled={!canGoPrevious}
							className="h-8 w-8 p-0"
							title="Previous page"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>

						{/* Page number buttons */}
						{pageNumbers.map((pageNum) => (
							<Button
								key={pageNum}
								variant={
									pageNum === currentPage
										? "default"
										: "outline"
								}
								size="sm"
								onClick={() => onPageChange(pageNum)}
								disabled={isLoading}
								className="h-8 w-8 p-0"
							>
								{pageNum}
							</Button>
						))}

						{/* Next page button */}
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(currentPage + 1)}
							disabled={!canGoNext}
							className="h-8 w-8 p-0"
							title="Next page"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>

						{/* Last page button */}
						<Button
							variant="outline"
							size="sm"
							onClick={() => onPageChange(totalPages)}
							disabled={!canGoNext}
							className="h-8 w-8 p-0"
							title="Last page"
						>
							<ChevronsRight className="h-4 w-4" />
						</Button>
					</div>
				)}
			</div>
		);
	}
);

TablePagination.displayName = "TablePagination";
