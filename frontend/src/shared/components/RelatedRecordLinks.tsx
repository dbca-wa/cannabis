import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export interface RelatedRecordLink {
	/** What the list holds, plural: "cases" or "officers". */
	noun: string;
	/** How many there are, or undefined while the count is loading. */
	count: number | undefined;
	/** The list filtered to this record, e.g. "/cases?officer=12". */
	to: string;
}

interface RelatedRecordLinksProps {
	links: RelatedRecordLink[];
}

/**
 * Buttons on an officer, station or defendant that open the cases (and, for
 * a station, the officers) that use it, already filtered to that record.
 * With nothing to show, the button says so and cannot be clicked.
 */
export const RelatedRecordLinks = ({ links }: RelatedRecordLinksProps) => (
	<div className="mt-6 space-y-2 border-t pt-4">
		<h3 className="text-sm font-medium">Related records</h3>
		<div className="flex flex-wrap gap-2">
			{links.map(({ noun, count, to }) =>
				count === 0 ? (
					<Button key={noun} type="button" variant="outline" disabled>
						No {noun}
					</Button>
				) : (
					<Button key={noun} asChild variant="outline">
						<Link to={to}>
							View {noun}
							{count !== undefined && ` (${count})`}
							<ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
						</Link>
					</Button>
				)
			)}
		</div>
	</div>
);
