import { useState } from "react";
import { Link } from "react-router";
import {
	Search,
	Check,
	Shield,
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
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { usePoliceOfficers } from "../../../hooks/usePoliceOfficers";
import { useDebounce } from "@/shared/hooks/core/useDebounce";
import { apiClient } from "@/shared/services/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateRelatedQueries } from "@/shared/services/cache/queryInvalidation";
import { toast } from "sonner";
import type { PoliceOfficerTiny } from "@/shared/types/backend-api.types";

export const OfficerMergePage = () => {
	useDocumentTitle("Merge Officers");
	const [primary, setPrimary] = useState<PoliceOfficerTiny | null>(null);
	const [secondaries, setSecondaries] = useState<PoliceOfficerTiny[]>([]);
	const queryClient = useQueryClient();

	const mergeMutation = useMutation({
		mutationFn: async (data: {
			target_officer_id: number;
			source_officer_id: number;
		}) =>
			apiClient.post<{
				merged_into: number;
				target_name: string;
				cases_reassigned: number;
			}>("/police/officers/merge/", data),
		onSuccess: async (response) => {
			await invalidateRelatedQueries(queryClient, "policeOfficers");
			toast.success(
				`Merge complete. ${response.cases_reassigned} case(s) reassigned.`
			);
		},
		onError: (error: Error) => {
			toast.error(error.message || "Merge failed. Please try again.");
		},
	});

	const handleMerge = async () => {
		if (!primary || secondaries.length === 0) return;
		try {
			for (const secondary of secondaries) {
				await mergeMutation.mutateAsync({
					target_officer_id: primary.id,
					source_officer_id: secondary.id,
				});
			}
			setPrimary(null);
			setSecondaries([]);
		} catch {
			// Error handled by mutation
		}
	};

	return (
		<div className="space-y-6 p-6">
			<Link
				to="/officers"
				className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
			>
				<ArrowLeft className="h-4 w-4" />
				Back to Officers
			</Link>

			<h1 className="text-2xl font-semibold">Merge Officers</h1>

			<PrimaryOfficerSelector
				selected={primary}
				onSelect={setPrimary}
				excludeIds={secondaries.map((s) => s.id)}
			/>

			{primary && (
				<SecondaryOfficerSelector
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

const PrimaryOfficerSelector = ({
	selected,
	onSelect,
	excludeIds,
}: {
	selected: PoliceOfficerTiny | null;
	onSelect: (officer: PoliceOfficerTiny) => void;
	excludeIds: number[];
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebounce(searchQuery, 300);
	const { data, isLoading } = usePoliceOfficers({
		search: debouncedSearch || undefined,
		limit: 10,
	});
	const filtered = (data?.results || []).filter(
		(o) => !excludeIds.includes(o.id)
	);

	const formatName = (officer: PoliceOfficerTiny) =>
		officer.badge_number
			? `${officer.full_name} (${officer.badge_number})`
			: officer.full_name;

	return (
		<div className="space-y-3">
			<label className="text-sm font-medium" htmlFor="primary-officer-search">
				Primary Officer
			</label>
			{selected && (
				<div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
					<Check className="h-4 w-4 text-green-600" />
					<Shield className="h-4 w-4 text-muted-foreground" />
					<span className="font-medium">{formatName(selected)}</span>
					<Badge variant="secondary" className="text-xs">
						{selected.rank_display}
					</Badge>
				</div>
			)}
			<div className="relative">
				<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					id="primary-officer-search"
					variant="search"
					placeholder="Search officers by name..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					className="pl-9"
				/>
			</div>
			{(debouncedSearch || searchQuery) && (
				<ul
					className="max-h-60 overflow-y-auto rounded-md border"
					role="listbox"
				>
					{isLoading && (
						<li className="p-3 text-center text-sm text-muted-foreground">
							Searching...
						</li>
					)}
					{!isLoading && filtered.length === 0 && (
						<li className="p-3 text-center text-sm text-muted-foreground">
							No officers found
						</li>
					)}
					{!isLoading &&
						filtered.map((officer) => (
							<li
								key={officer.id}
								role="option"
								aria-selected={selected?.id === officer.id}
							>
								<button
									type="button"
									onClick={() => onSelect(officer)}
									className={cn(
										"flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted cursor-pointer",
										selected?.id === officer.id &&
											"bg-green-50 dark:bg-green-950/30"
									)}
								>
									<Check
										className={cn(
											"h-4 w-4 shrink-0",
											selected?.id === officer.id
												? "text-green-600 opacity-100"
												: "opacity-0"
										)}
									/>
									<span className="flex-1 truncate">{formatName(officer)}</span>
									<span className="text-xs text-muted-foreground">
										{officer.station_name || "No station"}
									</span>
								</button>
							</li>
						))}
				</ul>
			)}
		</div>
	);
};

const SecondaryOfficerSelector = ({
	selected,
	onChange,
	excludeId,
}: {
	selected: PoliceOfficerTiny[];
	onChange: (officers: PoliceOfficerTiny[]) => void;
	excludeId: number;
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const debouncedSearch = useDebounce(searchQuery, 300);
	const { data, isLoading } = usePoliceOfficers({
		search: debouncedSearch || undefined,
		limit: 10,
	});
	const selectedIds = new Set(selected.map((o) => o.id));
	const filtered = (data?.results || []).filter(
		(o) => o.id !== excludeId && !selectedIds.has(o.id)
	);

	const formatName = (officer: PoliceOfficerTiny) =>
		officer.badge_number
			? `${officer.full_name} (${officer.badge_number})`
			: officer.full_name;

	return (
		<div className="space-y-3">
			<label className="text-sm font-medium">Secondary Officers</label>
			<div className="relative">
				<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					placeholder="Search officers to merge..."
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
					{filtered.map((officer) => (
						<li key={officer.id}>
							<button
								type="button"
								onClick={() => {
									onChange([...selected, officer]);
									setSearchQuery("");
								}}
								className="w-full text-left px-3 py-2 hover:bg-muted transition-colors cursor-pointer"
							>
								<span className="text-sm font-medium">
									{formatName(officer)}
								</span>
								<span className="text-xs text-muted-foreground ml-2">
									({officer.station_name || "No station"})
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
			{debouncedSearch && filtered.length === 0 && !isLoading && (
				<p className="text-sm text-muted-foreground">
					No matching officers found.
				</p>
			)}
			{selected.length > 0 && (
				<div className="space-y-2">
					<p className="text-xs text-muted-foreground">
						Selected ({selected.length}):
					</p>
					<ul className="space-y-1">
						{selected.map((officer) => (
							<li
								key={officer.id}
								className="flex items-center justify-between rounded-md border px-3 py-2"
							>
								<div className="flex items-center gap-2">
									<span className="text-sm">{formatName(officer)}</span>
									<span className="text-xs text-muted-foreground">
										({officer.station_name || "No station"})
									</span>
								</div>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() =>
										onChange(selected.filter((o) => o.id !== officer.id))
									}
									className="h-6 w-6 p-0 cursor-pointer"
									aria-label={`Remove ${officer.full_name}`}
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
	primary: PoliceOfficerTiny;
	secondaries: PoliceOfficerTiny[];
}) => (
	<div className="space-y-4 rounded-lg border p-4">
		<div>
			<p className="text-sm font-medium text-muted-foreground">
				Primary (will be kept):
			</p>
			<p className="text-base font-semibold">{primary.full_name}</p>
		</div>
		<div>
			<p className="text-sm font-medium text-muted-foreground">
				Will be merged and deleted:
			</p>
			<ul className="mt-1 space-y-1">
				{secondaries.map((officer) => (
					<li key={officer.id} className="text-sm">
						{officer.full_name}{" "}
						<span className="text-muted-foreground">
							({officer.case_count}{" "}
							{officer.case_count === 1 ? "case" : "cases"})
						</span>
					</li>
				))}
			</ul>
		</div>
		<Alert variant="destructive">
			<AlertTriangle className="h-4 w-4" />
			<AlertTitle>Warning</AlertTitle>
			<AlertDescription>
				This action cannot be undone. The secondary officers will be permanently
				deleted and all their cases will be transferred to the primary.
			</AlertDescription>
		</Alert>
	</div>
);
