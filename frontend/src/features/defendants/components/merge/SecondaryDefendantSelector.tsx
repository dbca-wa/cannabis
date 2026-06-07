import { useState, useMemo } from "react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { X, Search, Loader2 } from "lucide-react";
import { useDebounce } from "@/shared/hooks";
import { useDefendants } from "../../hooks/useDefendants";
import type { DefendantTiny } from "@/shared/types/backend-api.types";

interface SecondaryDefendantSelectorProps {
	selected: DefendantTiny[];
	onChange: (defendants: DefendantTiny[]) => void;
	excludeId: number;
}

export const SecondaryDefendantSelector = ({
	selected,
	onChange,
	excludeId,
}: SecondaryDefendantSelectorProps) => {
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebounce(searchQuery, 300);

	const { data, isLoading } = useDefendants({
		search: debouncedSearch || undefined,
		limit: 10,
	});

	const selectedIds = useMemo(
		() => new Set(selected.map((d) => d.id)),
		[selected]
	);

	// eslint-disable-next-line react-hooks/preserve-manual-memoization
	const filteredResults = useMemo(() => {
		if (!data?.results) return [];
		return data.results.filter(
			(d) => d.id !== excludeId && !selectedIds.has(d.id)
		);
	}, [data?.results, excludeId, selectedIds]);

	const handleAdd = (defendant: DefendantTiny) => {
		onChange([...selected, defendant]);
		setSearchQuery("");
	};

	const handleRemove = (id: number) => {
		onChange(selected.filter((d) => d.id !== id));
	};

	return (
		<div className="space-y-3">
			<label className="text-sm font-medium">Secondary Defendants</label>

			{/* Search input */}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Search defendants to merge..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9"
				/>
				{isLoading && debouncedSearch && (
					<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
				)}
			</div>

			{/* Search results dropdown */}
			{debouncedSearch && filteredResults.length > 0 && (
				<ul className="border rounded-md divide-y max-h-48 overflow-y-auto">
					{filteredResults.map((defendant) => (
						<li key={defendant.id}>
							<button
								type="button"
								onClick={() => handleAdd(defendant)}
								className="w-full text-left px-3 py-2 hover:bg-muted transition-colors cursor-pointer"
							>
								<span className="text-sm font-medium">
									{defendant.full_name}
								</span>
								<span className="text-xs text-muted-foreground ml-2">
									({defendant.cases_count}{" "}
									{defendant.cases_count === 1 ? "case" : "cases"})
								</span>
							</button>
						</li>
					))}
				</ul>
			)}

			{debouncedSearch && filteredResults.length === 0 && !isLoading && (
				<p className="text-sm text-muted-foreground">
					No matching defendants found.
				</p>
			)}

			{/* Selected secondaries list */}
			{selected.length > 0 && (
				<div className="space-y-2">
					<p className="text-xs text-muted-foreground">
						Selected ({selected.length}):
					</p>
					<ul className="space-y-1">
						{selected.map((defendant) => (
							<li
								key={defendant.id}
								className="flex items-center justify-between rounded-md border px-3 py-2"
							>
								<div className="flex items-center gap-2">
									<span className="text-sm">{defendant.full_name}</span>
									<span className="text-xs text-muted-foreground">
										({defendant.cases_count}{" "}
										{defendant.cases_count === 1 ? "case" : "cases"})
									</span>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => handleRemove(defendant.id)}
									className="h-6 w-6 p-0 cursor-pointer"
									aria-label={`Remove ${defendant.full_name}`}
								>
									<X className="h-4 w-4" />
								</Button>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};
