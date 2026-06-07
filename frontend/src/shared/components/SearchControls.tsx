import { Checkbox } from "@/shared/components/ui/checkbox";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { X } from "lucide-react";
import { cn } from "@/shared/utils/style.utils";

interface SearchControlsProps {
	saveSearch: boolean;
	onToggleSaveSearch: () => void;
	filterCount: number;
	onClearFilters: () => void;
	className?: string;
}

/**
 * Reusable "Remember search" checkbox and "Clear search" button.
 * Used across all filterable pages (cases, officers, stations, etc.)
 */
export const SearchControls = ({
	saveSearch,
	onToggleSaveSearch,
	filterCount,
	onClearFilters,
	className,
}: SearchControlsProps) => {
	return (
		<div className={cn("flex flex-col xs:flex-row gap-2", className)}>
			{/* Remember search toggle */}
			<div className="flex items-center space-x-2 px-3 py-1.5 rounded-md bg-muted/50">
				<Checkbox
					id="save-search"
					checked={saveSearch}
					onCheckedChange={onToggleSaveSearch}
					className="cursor-pointer"
				/>
				<Label
					htmlFor="save-search"
					className="text-sm font-normal cursor-pointer whitespace-nowrap"
				>
					Remember search
				</Label>
			</div>

			{/* Clear search button — only visible when filters are active */}
			{filterCount > 0 && (
				<Button
					variant="outline"
					size="sm"
					onClick={onClearFilters}
					className="gap-1 shrink-0 bg-red-50 border-red-200 text-red-700 hover:bg-red-100 hover:border-red-300 dark:bg-red-950/50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950 dark:hover:border-red-800"
				>
					<X className="size-4" />
					<span className="hidden sm:inline">Clear search</span>
					<span className="sm:hidden">Clear</span>
					<Badge
						variant="secondary"
						className="ml-0.5 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs"
					>
						{filterCount}
					</Badge>
				</Button>
			)}
		</div>
	);
};
