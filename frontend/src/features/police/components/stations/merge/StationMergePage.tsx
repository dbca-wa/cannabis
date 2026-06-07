import { useState } from "react";
import { Link } from "react-router";
import {
	Search,
	Check,
	Building2,
	AlertTriangle,
	X,
	Loader2,
	ArrowLeft,
} from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@/shared/components/ui/alert";
import { cn } from "@/shared/utils";
import { useStations } from "../../../hooks/usePoliceStations";
import { useStationMerge } from "../../../hooks/useStationMerge";
import { useDebounce } from "@/shared/hooks/core/useDebounce";
import type { PoliceStation } from "@/shared/types/backend-api.types";

export const StationMergePage = () => {
	const [primary, setPrimary] = useState<PoliceStation | null>(null);
	const [secondaries, setSecondaries] = useState<PoliceStation[]>([]);
	const mergeMutation = useStationMerge();

	const handleMerge = async () => {
		if (!primary || secondaries.length === 0) return;
		try {
			await mergeMutation.mutateAsync({
				primary_id: primary.id,
				secondary_ids: secondaries.map((s) => s.id),
			});
			setPrimary(null);
			setSecondaries([]);
		} catch {
			// Error handled by mutation hook
		}
	};

	return (
		<div className="space-y-6 p-6">
			<Link
				to="/stations"
				className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to Stations
			</Link>

			<h1 className="text-2xl font-semibold">Merge Stations</h1>

			<PrimaryStationSelector
				selected={primary}
				onSelect={setPrimary}
				excludeIds={secondaries.map((s) => s.id)}
			/>

			{primary && (
				<SecondaryStationSelector
					selected={secondaries}
					onChange={setSecondaries}
					excludeId={primary.id}
				/>
			)}

			{primary && secondaries.length > 0 && (
				<>
					<MergePreview primary={primary} secondaries={secondaries} />
					<Button
						variant="destructive"
						onClick={handleMerge}
						disabled={mergeMutation.isPending}
					>
						{mergeMutation.isPending && (
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
						)}
						{mergeMutation.isPending ? "Merging..." : "Confirm Merge"}
					</Button>
				</>
			)}
		</div>
	);
};

// --- Sub-components ---

const PrimaryStationSelector = ({
	selected,
	onSelect,
	excludeIds,
}: {
	selected: PoliceStation | null;
	onSelect: (station: PoliceStation) => void;
	excludeIds: number[];
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebounce(searchQuery, 300);

	const { data, isLoading } = useStations({
		search: debouncedSearch || undefined,
		limit: 10,
	});

	const filtered = (data?.results || []).filter(
		(s) => !excludeIds.includes(s.id)
	);

	return (
		<div className="space-y-3">
			<label className="text-sm font-medium" htmlFor="primary-station-search">
				Primary Station
			</label>

			{selected && (
				<div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
					<Check className="h-4 w-4 text-green-600" />
					<Building2 className="h-4 w-4 text-muted-foreground" />
					<span className="font-medium">{selected.name}</span>
					<Badge variant="secondary" className="text-xs">
						{selected.officer_count} officers
					</Badge>
				</div>
			)}

			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					id="primary-station-search"
					variant="search"
					placeholder="Search stations by name..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9"
				/>
			</div>

			{(debouncedSearch || searchQuery) && (
				<ul
					className="max-h-60 overflow-y-auto rounded-md border"
					role="listbox"
					aria-label="Primary station search results"
				>
					{isLoading && (
						<li className="p-3 text-center text-sm text-muted-foreground">
							Searching...
						</li>
					)}
					{!isLoading && filtered.length === 0 && (
						<li className="p-3 text-center text-sm text-muted-foreground">
							No stations found
						</li>
					)}
					{!isLoading &&
						filtered.map((station) => {
							const isSelected = selected?.id === station.id;
							return (
								<li key={station.id} role="option" aria-selected={isSelected}>
									<button
										type="button"
										onClick={() => onSelect(station)}
										className={cn(
											"flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted cursor-pointer",
											isSelected && "bg-green-50 dark:bg-green-950/30"
										)}
									>
										<Check
											className={cn(
												"h-4 w-4 shrink-0",
												isSelected ? "text-green-600 opacity-100" : "opacity-0"
											)}
										/>
										<Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
										<span className="flex-1 truncate">{station.name}</span>
										<Badge variant="secondary" className="text-xs">
											{station.officer_count} officers
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

const SecondaryStationSelector = ({
	selected,
	onChange,
	excludeId,
}: {
	selected: PoliceStation[];
	onChange: (stations: PoliceStation[]) => void;
	excludeId: number;
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebounce(searchQuery, 300);

	const { data, isLoading } = useStations({
		search: debouncedSearch || undefined,
		limit: 10,
	});

	const selectedIds = new Set(selected.map((s) => s.id));
	const filtered = (data?.results || []).filter(
		(s) => s.id !== excludeId && !selectedIds.has(s.id)
	);

	const handleAdd = (station: PoliceStation) => {
		onChange([...selected, station]);
		setSearchQuery("");
	};

	const handleRemove = (id: number) => {
		onChange(selected.filter((s) => s.id !== id));
	};

	return (
		<div className="space-y-3">
			<label className="text-sm font-medium">Secondary Stations</label>

			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Search stations to merge..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9"
				/>
				{isLoading && debouncedSearch && (
					<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
				)}
			</div>

			{debouncedSearch && filtered.length > 0 && (
				<ul className="border rounded-md divide-y max-h-48 overflow-y-auto">
					{filtered.map((station) => (
						<li key={station.id}>
							<button
								type="button"
								onClick={() => handleAdd(station)}
								className="w-full text-left px-3 py-2 hover:bg-muted transition-colors cursor-pointer"
							>
								<span className="text-sm font-medium">{station.name}</span>
								<span className="text-xs text-muted-foreground ml-2">
									({station.officer_count} officers)
								</span>
							</button>
						</li>
					))}
				</ul>
			)}

			{debouncedSearch && filtered.length === 0 && !isLoading && (
				<p className="text-sm text-muted-foreground">
					No matching stations found.
				</p>
			)}

			{selected.length > 0 && (
				<div className="space-y-2">
					<p className="text-xs text-muted-foreground">
						Selected ({selected.length}):
					</p>
					<ul className="space-y-1">
						{selected.map((station) => (
							<li
								key={station.id}
								className="flex items-center justify-between rounded-md border px-3 py-2"
							>
								<div className="flex items-center gap-2">
									<span className="text-sm">{station.name}</span>
									<span className="text-xs text-muted-foreground">
										({station.officer_count} officers)
									</span>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => handleRemove(station.id)}
									className="h-6 w-6 p-0 cursor-pointer"
									aria-label={`Remove ${station.name}`}
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

const MergePreview = ({
	primary,
	secondaries,
}: {
	primary: PoliceStation;
	secondaries: PoliceStation[];
}) => {
	return (
		<div className="space-y-4 rounded-lg border p-4">
			<div>
				<p className="text-sm font-medium text-muted-foreground">
					Primary (will be kept):
				</p>
				<p className="text-base font-semibold">{primary.name}</p>
			</div>
			<div>
				<p className="text-sm font-medium text-muted-foreground">
					Will be merged and deleted:
				</p>
				<ul className="mt-1 space-y-1">
					{secondaries.map((station) => (
						<li key={station.id} className="text-sm">
							{station.name}{" "}
							<span className="text-muted-foreground">
								({station.officer_count}{" "}
								{station.officer_count === 1 ? "officer" : "officers"})
							</span>
						</li>
					))}
				</ul>
			</div>
			<Alert variant="destructive">
				<AlertTriangle className="h-4 w-4" />
				<AlertTitle>Warning</AlertTitle>
				<AlertDescription>
					This action cannot be undone. The secondary stations will be
					permanently deleted and all their officers and cases will be
					transferred to the primary.
				</AlertDescription>
			</Alert>
		</div>
	);
};
