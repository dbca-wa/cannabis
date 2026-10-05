/**
 * Route-aware guidance for practice mode.
 *
 * Maps the current page to a short, plain-language "what to do now" so the
 * always-on brief sheet can walk an unhurried user through the whole workflow,
 * step by step, wherever they are.
 */

export interface PracticeStep {
	/** 1-based number shown to the user. */
	number: number;
	title: string;
	/** Whether this is the step the current page is for. */
	current: boolean;
}

export interface PracticeGuidance {
	/** Heading for the current page's instructions. */
	heading: string;
	/** Short, ordered instructions for what to do on this page right now. */
	instructions: string[];
	/** The full workflow as a checklist, with the current step marked. */
	steps: PracticeStep[];
}

const STEP_TITLES = [
	"Create the case",
	"Record the samples",
	"Generate certificates",
	"Finalise the case",
	"Batch the certificates",
	"Record the invoice",
];

const buildSteps = (currentNumber: number): PracticeStep[] =>
	STEP_TITLES.map((title, i) => ({
		number: i + 1,
		title,
		current: i + 1 === currentNumber,
	}));

/**
 * Pick the guidance for a pathname. Order matters: the case-creation route is a
 * prefix of the case route, so it is checked first.
 */
export const getPracticeGuidance = (pathname: string): PracticeGuidance => {
	if (pathname.startsWith("/cases/add")) {
		return {
			heading: "Step 1 — Create the case",
			instructions: [
				"Type the police reference from your brief into Police Reference Number.",
				"Set the Received Date.",
				"Add the defendant, submitting officer and station from your brief.",
				"If an officer or station is not found, use Add New to create it.",
				"Click Create Case when every field matches your brief.",
			],
			steps: buildSteps(1),
		};
	}
	if (/^\/cases\/\d+/.test(pathname)) {
		return {
			heading: "Steps 2–4 — Record, generate and finalise",
			instructions: [
				"In the Assessment section, add a Priority 3 form.",
				"Add each drug bag from your brief: tag numbers, content type, determination and whether it holds female plants.",
				"Add the Section C note or template if your brief lists a security movement envelope or female plants.",
				"In the Certificates section, Generate each certificate and mark it Ready.",
				"Click Finalise Case when every form is ready.",
			],
			steps: buildSteps(2),
		};
	}
	if (pathname.startsWith("/cases")) {
		return {
			heading: "Step 1 — Create the case",
			instructions: [
				"Click New Case to begin — the glowing prompt points to it.",
				"You will enter the details from your brief on the next page.",
			],
			steps: buildSteps(1),
		};
	}
	if (pathname.startsWith("/batches")) {
		return {
			heading: "Steps 5–6 — Batch and invoice",
			instructions: [
				"Your finalised practice case is here, waiting to be batched.",
				"Select it and click Create Batch.",
				"Open the batch, then record a practice invoice number to finish.",
			],
			steps: buildSteps(5),
		};
	}
	// Any other page (dashboard, etc.) — point them to Cases to begin.
	return {
		heading: "Start your practice case",
		instructions: [
			"Go to Cases in the sidebar to begin.",
			"Everything you do here is practice — nothing is real.",
		],
		steps: buildSteps(1),
	};
};
