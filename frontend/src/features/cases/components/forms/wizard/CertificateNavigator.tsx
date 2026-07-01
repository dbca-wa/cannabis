import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
} from "@/shared/components/ui/select";

interface CertificateNavigatorProps {
	count: number;
	activeIndex: number;
	onChange: (index: number) => void;
	/** Prefix for default labels (e.g. "Certificate 3") */
	labelPrefix?: string;
	/** Optional per-certificate labels (e.g. certificate numbers) */
	labels?: string[];
}

/**
 * Certificate navigator: previous/next arrows around a dropdown that lists every
 * certificate, with a running "of N" count. Arrows and dropdown stay in sync, so
 * a case with twenty-plus certificates is easy to page through or jump within.
 */
export const CertificateNavigator = ({
	count,
	activeIndex,
	onChange,
	labelPrefix = "Certificate",
	labels,
}: CertificateNavigatorProps) => {
	const safeActive = Math.min(Math.max(activeIndex, 0), count - 1);
	const labelFor = (i: number) => labels?.[i] ?? `${labelPrefix} ${i + 1}`;

	return (
		<div className="inline-flex items-center gap-1 rounded-full border bg-card p-1 shadow-sm">
			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-9 w-9 rounded-full cursor-pointer disabled:opacity-40"
				onClick={() => onChange(safeActive - 1)}
				disabled={safeActive <= 0}
				aria-label="Previous certificate"
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>

			<Select
				value={String(safeActive)}
				onValueChange={(v) => onChange(Number(v))}
			>
				<SelectTrigger
					className="h-9 min-w-[190px] justify-center gap-1.5 rounded-full border-0 bg-transparent px-3 font-medium shadow-none focus:ring-0 focus-visible:ring-0 cursor-pointer"
					aria-label="Select certificate"
				>
					<span className="truncate">{labelFor(safeActive)}</span>
					<span className="text-xs font-normal text-muted-foreground">
						of {count}
					</span>
				</SelectTrigger>
				<SelectContent>
					{Array.from({ length: count }).map((_, i) => (
						<SelectItem key={i} value={String(i)} className="cursor-pointer">
							{labelFor(i)}
						</SelectItem>
					))}
				</SelectContent>
			</Select>

			<Button
				type="button"
				variant="ghost"
				size="icon"
				className="h-9 w-9 rounded-full cursor-pointer disabled:opacity-40"
				onClick={() => onChange(safeActive + 1)}
				disabled={safeActive >= count - 1}
				aria-label="Next certificate"
			>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
};
