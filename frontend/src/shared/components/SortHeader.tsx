import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc" | null;

interface SortHeaderProps {
	label: string;
	sortKey: string;
	activeKey: string | null;
	dir: SortDir;
	onSort: (key: string) => void;
	className?: string;
	align?: "left" | "right";
}

/** Clickable column header that cycles through ascending, descending, and unsorted states. */
export const SortHeader = ({
	label,
	sortKey,
	activeKey,
	dir,
	onSort,
	className = "",
	align = "left",
}: SortHeaderProps) => {
	const active = activeKey === sortKey;
	const sortStateLabel = active
		? dir === "asc"
			? "sorted ascending"
			: "sorted descending"
		: "not sorted";

	return (
		<button
			type="button"
			onClick={() => onSort(sortKey)}
			aria-label={`Sort by ${label}, currently ${sortStateLabel}`}
			className={`inline-flex items-center gap-1 cursor-pointer group hover:text-foreground transition-colors ${align === "right" ? "ml-auto" : ""} ${className}`}
		>
			<span>{label}</span>
			{active ? (
				dir === "asc" ? (
					<ChevronUp className="w-3.5 h-3.5 text-emerald-600" />
				) : (
					<ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
				)
			) : (
				<ChevronsUpDown className="w-3.5 h-3.5 opacity-30 group-hover:opacity-60 transition-opacity" />
			)}
		</button>
	);
};

/** Cycle sort direction: different key → asc, asc → desc, desc → null. */
// eslint-disable-next-line react-refresh/only-export-components
export const cycleSort = (
	current: { key: string | null; dir: SortDir },
	key: string
): { key: string | null; dir: SortDir } => {
	if (current.key !== key) return { key, dir: "asc" };
	if (current.dir === "asc") return { key, dir: "desc" };
	return { key: null, dir: null };
};

/** Sort an array of objects by a given key and direction. Returns a new array. */
// eslint-disable-next-line react-refresh/only-export-components
export const sortBy = <T extends object>(
	arr: T[],
	key: string | null,
	dir: SortDir
): T[] => {
	if (!key || !dir) return arr;

	const mult = dir === "asc" ? 1 : -1;

	return [...arr].sort((a, b) => {
		const av = (a as Record<string, unknown>)[key];
		const bv = (b as Record<string, unknown>)[key];
		if (av == null) return 1;
		if (bv == null) return -1;
		if (typeof av === "number" && typeof bv === "number")
			return (av - bv) * mult;
		return String(av).localeCompare(String(bv)) * mult;
	});
};
