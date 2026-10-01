import { ClipboardList } from "lucide-react";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { usePracticeMode } from "../hooks/usePracticeMode";
import { usePracticeBrief } from "../hooks/usePracticeBrief";

/** Turn a stored key like "plant_material" into "plant material". */
const humanise = (value: string): string => value.replace(/_/g, " ");

/**
 * The fake Priority 3 paperwork, shown on the case page while in practice mode
 * so the user can enter it into the real form as they go. Renders nothing when
 * not in practice mode.
 */
export const PracticeBriefPanel = () => {
	const { isOn } = usePracticeMode();
	const { data: brief, isLoading } = usePracticeBrief(isOn);

	if (!isOn) return null;

	return (
		<Card className="border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
			<CardHeader className="pb-3">
				<CardTitle className="flex items-center gap-2 text-base">
					<ClipboardList size={18} aria-hidden="true" />
					Your practice brief
					<Badge variant="secondary">Fake data</Badge>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4 text-sm">
				{isLoading || !brief ? (
					<p className="text-muted-foreground">Preparing your brief…</p>
				) : (
					<>
						<p className="text-muted-foreground">
							Enter these details into the case as you work through it. The
							officer and station below do not exist yet — add them when the
							form says they aren&apos;t found.
						</p>

						<dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
							<div>
								<dt className="font-medium">Police reference</dt>
								<dd className="font-mono text-muted-foreground">
									{brief.case_number}
								</dd>
							</div>
							<div>
								<dt className="font-medium">Submitting officer</dt>
								<dd className="text-muted-foreground">
									{brief.officer.rank_display} {brief.officer.badge_number}{" "}
									{brief.officer.last_name.toUpperCase()},{" "}
									{brief.officer.given_names}
								</dd>
							</div>
							<div>
								<dt className="font-medium">Station</dt>
								<dd className="text-muted-foreground">{brief.station}</dd>
							</div>
							<div>
								<dt className="font-medium">Defendant</dt>
								<dd className="text-muted-foreground">
									{brief.defendant.last_name.toUpperCase()},{" "}
									{brief.defendant.given_names}
								</dd>
							</div>
							<div>
								<dt className="font-medium">Approved botanist</dt>
								<dd className="text-muted-foreground">
									{brief.botanist.given_names} {brief.botanist.last_name}
								</dd>
							</div>
							{brief.security_movement_envelope && (
								<div>
									<dt className="font-medium">Security movement envelope</dt>
									<dd className="font-mono text-muted-foreground">
										{brief.security_movement_envelope}
									</dd>
								</div>
							)}
						</dl>

						<div>
							<p className="mb-2 font-medium">
								Drug bags ({brief.bags.length})
							</p>
							<ul className="space-y-2">
								{brief.bags.map((bag) => (
									<li
										key={bag.original_seal}
										className="rounded-md border bg-background/60 p-2 text-muted-foreground"
									>
										<span className="font-mono text-foreground">
											{bag.original_seal}
										</span>{" "}
										→ resealed as{" "}
										<span className="font-mono text-foreground">
											{bag.new_seal}
										</span>
										<br />
										{humanise(bag.content_type)} — determination:{" "}
										{humanise(bag.determination)}
										{bag.female_plants ? " — contains female plants" : ""}
									</li>
								))}
							</ul>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
};
