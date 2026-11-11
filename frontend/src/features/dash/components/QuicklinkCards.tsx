import { Link } from "react-router";
import { FlaskConical, FileText, Boxes, PackageCheck } from "lucide-react";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { CountUp } from "@/shared/components/CountUp";
import { AlertCircle } from "lucide-react";
import { PHASE_DISPLAY_NAMES } from "@/shared/constants/phases.config";
import type { CasePhase } from "@/features/cases/types/cases.types";
import { usePhaseStats } from "../hooks/usePhaseStats";

import type { LucideIcon } from "lucide-react";

interface QuicklinkPhase {
	key: Exclude<CasePhase, "complete">;
	/** What a case in this state is waiting for. */
	description: string;
	/** The How To step that comes next, numbered as in the guide. */
	nextStep: string;
	icon: LucideIcon;
	accent: string;
}

const QUICKLINK_PHASES: QuicklinkPhase[] = [
	{
		key: "assessment",
		description: "Samples being recorded and assessed",
		nextStep: "Steps 2–3",
		icon: FlaskConical,
		accent: "from-emerald-500 to-teal-500",
	},
	{
		key: "unsigned_generation",
		description: "Certificates to check, mark ready and finalise",
		nextStep: "Steps 3–4",
		icon: FileText,
		accent: "from-blue-500 to-indigo-500",
	},
	{
		key: "batching",
		description: "Finalised and ready to batch",
		nextStep: "Step 5",
		icon: Boxes,
		accent: "from-violet-500 to-purple-500",
	},
	{
		key: "in_batch",
		description: "In a batch, waiting for the invoice number",
		nextStep: "Step 6",
		icon: PackageCheck,
		accent: "from-amber-500 to-orange-500",
	},
];

// Columns follow the space the cards have, not the window, so they do not
// squeeze into four narrow columns when the practice or guide panel is open.
const GRID = "grid grid-cols-1 @xl:grid-cols-2 @5xl:grid-cols-4 gap-4";

export const QuicklinkCards = () => {
	const { data, isLoading, isError } = usePhaseStats();

	if (isLoading) {
		return (
			<div className="@container">
				<div className={GRID}>
					{Array.from({ length: 4 }).map((_, i) => (
						<Skeleton key={i} className="h-[100px] w-full rounded-xl" />
					))}
				</div>
			</div>
		);
	}

	if (isError || !data) {
		return (
			<Card className="p-8 text-center">
				<AlertCircle className="h-8 w-8 text-destructive mx-auto mb-2 opacity-60" />
				<p className="text-sm text-muted-foreground">
					Failed to load phase counts
				</p>
			</Card>
		);
	}

	return (
		<div className="@container">
			<div className={GRID}>
				{QUICKLINK_PHASES.map((phase) => {
					const phaseData = data[phase.key as keyof typeof data] as
						{ cases: number; forms: number } | number | undefined;
					const caseCount =
						typeof phaseData === "object"
							? (phaseData?.cases ?? 0)
							: (phaseData ?? 0);
					const formCount =
						typeof phaseData === "object" ? (phaseData?.forms ?? 0) : 0;
					const Icon = phase.icon;

					return (
						<Link
							key={phase.key}
							to={`/cases?phase=${phase.key}`}
							className="no-underline"
						>
							<Card className="p-6 relative overflow-hidden group hover:shadow-md transition-shadow h-full cursor-pointer min-h-[140px]">
								<div
									className={`absolute -right-12 -top-12 w-48 h-48 rounded-full bg-gradient-to-br ${phase.accent} opacity-10 blur-xl group-hover:opacity-20 transition-opacity`}
								/>
								<div
									className={`absolute -left-12 -bottom-12 w-36 h-36 rounded-full bg-gradient-to-br ${phase.accent} opacity-5 blur-2xl`}
								/>
								<span
									className="absolute top-4 right-5 text-[12px] text-muted-foreground font-medium tabular-nums"
									title="The step in the How To guide that comes next"
								>
									Next: {phase.nextStep}
								</span>
								<div className="flex items-center gap-4 relative h-full">
									<div
										className={`w-14 h-14 rounded-lg bg-gradient-to-br ${phase.accent} text-white flex items-center justify-center shadow-sm shrink-0`}
									>
										<Icon className="w-7 h-7" />
									</div>
									<div className="flex-1 min-w-0">
										<div className="text-[32px] tracking-tight leading-none">
											<CountUp to={caseCount} />
										</div>
										<div className="text-[13px] font-medium mt-1">
											{PHASE_DISPLAY_NAMES[phase.key]}
										</div>
										<div className="text-[11px] text-muted-foreground">
											{phase.description}. {formCount}{" "}
											{formCount === 1 ? "form" : "forms"} belong to{" "}
											{caseCount === 1 ? "this case" : "these cases"}.
										</div>
									</div>
								</div>
							</Card>
						</Link>
					);
				})}
			</div>
		</div>
	);
};
