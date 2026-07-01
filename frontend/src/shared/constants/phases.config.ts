/**
 * Canonical phase configuration — single source of truth for the 5-phase workflow.
 *
 * All phase metadata (keys, labels, icons, colours, descriptions, ordering)
 * is defined here. Every other file imports from this module.
 */

import {
	FlaskConical,
	FileText,
	Boxes,
	PackageCheck,
	CheckCircle2,
} from "lucide-react";
import type { ComponentType } from "react";
import type { CasePhase } from "@/features/cases/types/cases.types";

export interface PhaseStepConfig {
	key: CasePhase;
	label: string;
	shortLabel: string;
	icon: ComponentType<{ className?: string }>;
	description: string;
	badgeColour: string;
	hexColour: string;
}

/**
 * Ordered phase steps — defines the entire workflow progression.
 */
export const PHASE_STEPS: PhaseStepConfig[] = [
	{
		key: "assessment",
		label: "Assessment",
		shortLabel: "Assessment",
		icon: FlaskConical,
		description: "Botanist assesses drug bag contents",
		badgeColour:
			"bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900 dark:text-teal-200 dark:border-teal-700",
		hexColour: "#14b8a6",
	},
	{
		key: "unsigned_generation",
		label: "Unsigned Certificate",
		shortLabel: "Certificate",
		icon: FileText,
		description: "Generate the certificate PDF(s)",
		badgeColour:
			"bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700",
		hexColour: "#3b82f6",
	},
	{
		key: "batching",
		label: "Batching",
		shortLabel: "Batching",
		icon: Boxes,
		description: "Ready to be batched for cost tallying and packaging",
		badgeColour:
			"bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900 dark:text-violet-200 dark:border-violet-700",
		hexColour: "#8b5cf6",
	},
	{
		key: "in_batch",
		label: "In Batch",
		shortLabel: "In Batch",
		icon: PackageCheck,
		description: "Added to a batch, awaiting the invoice-raised number",
		badgeColour:
			"bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700",
		hexColour: "#f59e0b",
	},
	{
		key: "complete",
		label: "Complete",
		shortLabel: "Complete",
		icon: CheckCircle2,
		description: "Case workflow completed successfully",
		badgeColour:
			"bg-green-200 text-green-900 border-green-400 dark:bg-green-950 dark:text-green-100 dark:border-green-700",
		hexColour: "#10b981",
	},
];

/** Ordered array of phase keys */
export const PHASE_KEYS: CasePhase[] = PHASE_STEPS.map((s) => s.key);

/** Phase key → display label */
export const PHASE_DISPLAY_NAMES: Record<CasePhase, string> =
	Object.fromEntries(PHASE_STEPS.map((s) => [s.key, s.label])) as Record<
		CasePhase,
		string
	>;

/** Phase key → badge CSS classes */
export const PHASE_BADGE_COLOURS: Record<CasePhase, string> =
	Object.fromEntries(PHASE_STEPS.map((s) => [s.key, s.badgeColour])) as Record<
		CasePhase,
		string
	>;

/** Phase key → hex colour for charts/indicators */
export const PHASE_HEX_COLOURS: Record<CasePhase, string> = Object.fromEntries(
	PHASE_STEPS.map((s) => [s.key, s.hexColour])
) as Record<CasePhase, string>;

// ============================================================================
// Helper Functions
// ============================================================================

/** Get the index of a phase in the workflow (0-based) */
export const getPhaseIndex = (phase: CasePhase): number =>
	PHASE_KEYS.indexOf(phase);

/** Calculate progress percentage (0–100) for a given phase */
export const getPhaseProgress = (phase: CasePhase): number => {
	const index = getPhaseIndex(phase);
	if (index === -1) return 0;
	return Math.round((index / (PHASE_KEYS.length - 1)) * 100);
};

/** Get the next phase in the workflow, or null if already complete */
export const getNextPhase = (currentPhase: CasePhase): CasePhase | null => {
	const index = getPhaseIndex(currentPhase);
	if (index === -1 || index === PHASE_KEYS.length - 1) return null;
	return PHASE_KEYS[index + 1];
};

/** Get all phases completed before the current phase */
export const getCompletedPhases = (currentPhase: CasePhase): CasePhase[] => {
	const index = getPhaseIndex(currentPhase);
	if (index <= 0) return [];
	return PHASE_KEYS.slice(0, index);
};

/** Check if a string is a valid CasePhase */
export const isValidPhase = (value: string): value is CasePhase =>
	PHASE_KEYS.includes(value as CasePhase);
