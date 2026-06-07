import { useState, useMemo } from "react";
import { Search, Check, User } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { cn } from "@/shared/utils";
import { useDefendants } from "../../hooks/useDefendants";
import {
	formatDefendantDisplayName,
	getDefendantCasesBadge,
	getDefendantCasesBadgeColourClass,
} from "@/shared/utils/defendant-display.utils";
import type { DefendantTiny } from "@/shared/types/backend-api.types";
import { useDebounce } from "@/shared/hooks/core/useDebounce";

interface PrimaryDefendantSelectorProps {
	selected: DefendantTiny | null;
	onSelect: (defendant: DefendantTiny) => void;
	excludeIds: number[];
}

export const PrimaryDefendantSelector = ({
	selected,
	onSelect,
	excludeIds,
}: PrimaryDefendantSelectorProps) => {
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebounce(searchQuery, 300);

	const { data, isLoading } = useDefendants({
		search: debouncedSearch || undefined,
		limit: 10,
	});

	// eslint-disable-next-line react-hooks/preserve-manual-memoization
	const filteredResults = useMemo(() => {
		if (!data?.results) return [];
		return data.results.filter(
			(defendant) => !excludeIds.includes(defendant.id)
		);
	}, [data?.results, excludeIds]);

	return (
		<div className="space-y-3">
			<label className="text-sm font-medium" htmlFor="primary-search">
				Primary Defendant
			</label>

			{selected && (
				<div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
					<Check className="h-4 w-4 text-green-600" />
					<User className="h-4 w-4 text-muted-foreground" />
					<span className="font-medium">
						{formatDefendantDisplayName(selected)}
					</span>
					<Badge
						variant="secondary"
						className={cn(
							"text-xs",
							getDefendantCasesBadgeColourClass(selected)
						)}
					>
						{getDefendantCasesBadge(selected)}
					</Badge>
				</div>
			)}

			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					id="primary-search"
					variant="search"
					placeholder="Search defendants by name..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9"
				/>
			</div>

			{(debouncedSearch || searchQuery) && (
				<ul
					className="max-h-60 overflow-y-auto rounded-md border"
					role="listbox"
					aria-label="Primary defendant search results"
				>
					{isLoading && (
						<li className="p-3 text-center text-sm text-muted-foreground">
							Searching...
						</li>
					)}

					{!isLoading && filteredResults.length === 0 && (
						<li className="p-3 text-center text-sm text-muted-foreground">
							No defendants found
						</li>
					)}

					{!isLoading &&
						filteredResults.map((defendant) => {
							const isSelected = selected?.id === defendant.id;

							return (
								<li key={defendant.id} role="option" aria-selected={isSelected}>
									<button
										type="button"
										onClick={() => onSelect(defendant)}
										className={cn(
											"flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
											isSelected && "bg-green-50 dark:bg-green-950/30"
										)}
									>
										<Check
											className={cn(
												"h-4 w-4 shrink-0",
												isSelected ? "text-green-600 opacity-100" : "opacity-0"
											)}
										/>
										<User className="h-4 w-4 shrink-0 text-muted-foreground" />
										<span className="flex-1 truncate">
											{formatDefendantDisplayName(defendant)}
										</span>
										<Badge
											variant="secondary"
											className={cn(
												"text-xs",
												getDefendantCasesBadgeColourClass(defendant)
											)}
										>
											{getDefendantCasesBadge(defendant)}
										</Badge>
									</button>
								</li>
							);
						})}
				</ul>
			)}
		</div>
	);
};
