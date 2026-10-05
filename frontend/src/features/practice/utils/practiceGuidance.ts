/**
 * Progress- and route-aware guidance for practice mode.
 *
 * The practice guide walks an unhurried user through the whole six-step journey
 * — create, record, generate, finalise, batch, invoice — and tracks where they
 * are from beginning to end. The current step is derived from the live case and
 * its forms (their workflow phase, certificate generation and ready flags) so it
 * advances as the user works, rather than resetting with each page change.
 */
import type { CasePhase } from "@/features/cases/types/cases.types";

export interface PracticeStep {
	/** 1-based number shown to the user. */
	number: number;
	title: string;
	/** Whether this is the step the user is currently on. */
	current: boolean;
	/** Whether this step is behind the current one (already done). */
	done: boolean;
}

export interface PracticeGuidance {
	/** Heading for the current step's instructions. */
	heading: string;
	/** Short, ordered instructions for what to do right now. */
	instructions: string[];
	/** The full workflow as a checklist, with current and done states. */
	steps: PracticeStep[];
	/** The derived current step number (1–6). */
	currentStep: number;
}

const STEP_TITLES = [
	"Create the case",
	"Record the samples",
	"Generate certificates",
	"Finalise the case",
	"Batch the certificate",
	"Record the invoice",
];

export const PRACTICE_STEP_COUNT = STEP_TITLES.length;

/** A form's progress-relevant fields, as read from the live case data. */
export interface PracticeFormProgress {
	phase: CasePhase;
	marked_ready: boolean;
	certificate?: { id: number } | null;
	certificates_generated_at?: string | null;
}

/** The live progress inputs the step derivation reads. */
export interface PracticeProgressInput {
	/** Whether a practice case exists yet (saved, not just the create form). */
	caseExists: boolean;
	/** The case's aggregated workflow status. */
	derivedStatus?: CasePhase | null;
	/** This case's Priority 3 forms. */
	forms?: PracticeFormProgress[];
}

/**
 * Derive the current step (1–6) from the live case and its forms.
 *
 * - No saved case yet .................................. 1 (create)
 * - Case in assessment ................................ 2 (record samples)
 * - Certificates generated, not all marked ready ...... 3 (generate/review)
 * - All forms generated and marked ready .............. 4 (finalise)
 * - Finalised, awaiting batching ...................... 5 (batch)
 * - In a batch ........................................ 5 (batch, in progress)
 * - Complete .......................................... 6 (invoice)
 */
export const derivePracticeStep = (p: PracticeProgressInput): number => {
	if (!p.caseExists) return 1;
	const status = p.derivedStatus ?? "assessment";
	const forms = p.forms ?? [];

	if (status === "complete") return 6;
	if (status === "in_batch") return 5;
	if (status === "batching") return 5;

	if (status === "unsigned_generation") {
		// Certificates exist. If every form is reviewed and marked ready, the
		// user's next action is to finalise; otherwise they are still generating
		// and reviewing certificates.
		const allReady = forms.length > 0 && forms.every((f) => f.marked_ready);
		return allReady ? 4 : 3;
	}

	// assessment (or anything earlier): still recording the samples.
	return 2;
};

const INSTRUCTIONS: Record<
	number,
	{ heading: string; instructions: string[] }
> = {
	1: {
		heading: "Step 1 — Create the case",
		instructions: [
			"Type the police reference from your brief into Police Reference Number.",
			"Set the Received Date.",
			"Add the defendant, submitting officer and station from your brief.",
			"If an officer or station is not found, use Add New to create it.",
			"Click Create Case when every field matches your brief.",
		],
	},
	2: {
		heading: "Step 2 — Record the samples",
		instructions: [
			"In the Assessment section, add a Priority 3 form.",
			"Add each drug bag from your brief: the original and new seal tag numbers, content type and determination.",
			"Mark whether a bag holds female plants where your brief says so.",
			"Add the Section C note or template if your brief lists a security movement envelope or female plants.",
			"Every bag in the checklist ticks off as you record it.",
		],
	},
	3: {
		heading: "Step 3 — Generate the certificates",
		instructions: [
			"In the Certificates section, click Generate for each form.",
			"Review the generated certificate against your brief.",
			"Click Mark Ready on each certificate once it looks right.",
		],
	},
	4: {
		heading: "Step 4 — Finalise the case",
		instructions: [
			"Every certificate is generated and marked ready.",
			"Click Finalise Case to send the certificates for batching.",
			"You will then move on to batching from the Batches page.",
		],
	},
	5: {
		heading: "Step 5 — Batch the certificate",
		instructions: [
			"Go to Batches in the sidebar — your finalised practice case is waiting.",
			"Select it and click Create Batch.",
			"Open the batch to continue to the invoice.",
		],
	},
	6: {
		heading: "Step 6 — Record the invoice",
		instructions: [
			"Open your batch from the Batches page.",
			"Record a practice invoice number to finish the journey.",
			"That completes the practice run — well done.",
		],
	},
};

const buildSteps = (currentNumber: number): PracticeStep[] =>
	STEP_TITLES.map((title, i) => ({
		number: i + 1,
		title,
		current: i + 1 === currentNumber,
		done: i + 1 < currentNumber,
	}));

/**
 * Guidance for the given step number. The step is derived from live progress
 * (see derivePracticeStep); the pathname only nudges the number when the user
 * is somewhere the case data cannot be read, so the guide still points forward.
 */
export const getPracticeGuidance = (
	pathname: string,
	step: number
): PracticeGuidance => {
	let n = step;

	// On the batches area, the user is acting on an already-finalised case; keep
	// them in the batch/invoice half even if no case data is loaded here.
	if (pathname.startsWith("/batches") && n < 5) {
		n = 5;
	}

	const copy = INSTRUCTIONS[n] ?? INSTRUCTIONS[1];
	return {
		heading: copy.heading,
		instructions: copy.instructions,
		steps: buildSteps(n),
		currentStep: n,
	};
};
