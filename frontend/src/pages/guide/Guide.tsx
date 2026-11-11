import type { ReactNode } from "react";
import { CheckCircle2, Info, Scale } from "lucide-react";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { PageHeader } from "@/shared/components/PageHeader";
import {
	ALL_FEMALE_LINE,
	BAG_LINE_PHRASES,
	FEMALE_PHRASE,
	SECTION_B_WORDING,
	type SectionBKey,
} from "@/features/cases/utils/certificateWording";
import { DETERMINATION_LABELS } from "@/features/cases/constants/determinations";
import { PHASE_DISPLAY_NAMES } from "@/shared/constants/phases.config";

/**
 * Step-by-step how-to guide for the Cannabis Identification System.
 *
 * Content is written out here rather than loaded from anywhere — edit this file
 * to update the guide. Screenshots live in public/assets/guide/ and are
 * referenced as /assets/guide/filename.png.
 *
 * The certificate wording examples are built from the same constants the
 * certificate preview uses (certificateWording.ts), so a wording change shows
 * up here without editing the guide.
 */

interface Stage {
	id: string;
	title: string;
	/** One line saying what the stage is for, shown in the contents. */
	summary: string;
}

/** Stages in the order a case moves through them, then reference sections. */
const STAGES: Stage[] = [
	{ id: "signing-in", title: "Signing in", summary: "Get into the system" },
	{
		id: "creating-a-case",
		title: "1. Creating a case",
		summary: "Police reference, defendant, officers",
	},
	{
		id: "recording-samples",
		title: "2. Recording the samples",
		summary: "Priority 3 forms, drug bags, results, Section C",
	},
	{
		id: "generating-certificates",
		title: "3. Generating certificates",
		summary: "Make, check and mark each certificate ready",
	},
	{
		id: "finalising",
		title: "4. Finalising the case",
		summary: "Hand the case over for invoicing",
	},
	{
		id: "batching",
		title: "5. Batching for invoicing",
		summary: "Group certificates and download the package",
	},
	{
		id: "invoicing",
		title: "6. Recording the invoice",
		summary: "Enter the invoice number to complete the work",
	},
	{
		id: "states",
		title: "Case states and the dashboard",
		summary: "What each state means and which step comes next",
	},
	{
		id: "certificate-rules",
		title: "Certificate wording rules",
		summary: "What prints on the certificate, and why",
	},
	{
		id: "records",
		title: "Officers, stations and defendants",
		summary: "Correct, merge or delete them",
	},
	{
		id: "practice",
		title: "Practice mode",
		summary: "Rehearse with a fake case",
	},
	{
		id: "guide",
		title: "Quick reference guide",
		summary: "Steps docked beside your real work",
	},
	{ id: "settings", title: "Settings", summary: "Rates, numbering, defaults" },
	{ id: "account", title: "Your account", summary: "Theme, password, log out" },
	{ id: "glossary", title: "Glossary", summary: "What the terms mean" },
];

/** The name of something on screen: a button, field, tab or menu item. */
const Ui = ({ children }: { children: ReactNode }) => (
	<span className="box-decoration-clone rounded border border-border bg-muted px-1.5 py-0.5 text-[0.9em] font-medium text-foreground">
		{children}
	</span>
);

/** Green "you're done" marker closing each stage. */
const Outcome = ({ children }: { children: ReactNode }) => (
	<div className="not-prose mt-4 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
		<CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
		<p>
			<strong className="font-semibold">When you&apos;re done:</strong>{" "}
			{children}
		</p>
	</div>
);

/** Blue aside for a tip that is helpful but not part of the steps. */
const Tip = ({ children }: { children: ReactNode }) => (
	<div className="not-prose my-4 flex gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
		<Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
		<div>
			<strong className="font-semibold">Tip:</strong> {children}
		</div>
	</div>
);

/** Amber aside for a confirmed rule that must be followed. */
const Rule = ({ title, children }: { title: string; children: ReactNode }) => (
	<div className="not-prose my-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
		<p className="flex items-center gap-2 font-semibold">
			<Scale className="h-4 w-4 shrink-0" aria-hidden="true" />
			{title}
		</p>
		<div className="mt-1.5 space-y-1.5">{children}</div>
	</div>
);

/** A guide section with its heading and the one-line summary under it. */
const Section = ({ id, children }: { id: string; children: ReactNode }) => {
	const stage = STAGES.find((s) => s.id === id);
	return (
		<section id={id} className="scroll-mt-6">
			<h2>{stage?.title}</h2>
			{stage && (
				<p className="lead !mt-0 text-muted-foreground">{stage.summary}.</p>
			)}
			{children}
		</section>
	);
};

/** A Section B sentence exactly as the certificate prints it. */
const SectionBExample = ({
	result,
	bags,
}: {
	result: SectionBKey;
	bags: "one" | "many";
}) => {
	const [prefix, italic, suffix] = SECTION_B_WORDING[result][bags];
	return (
		<q>
			{prefix}
			{italic && <em>{italic}</em>}
			{suffix}
		</q>
	);
};

/** An automatic Section C line exactly as the certificate prints it. */
const BagLineExample = ({
	tag,
	result,
}: {
	tag: string;
	result: keyof typeof BAG_LINE_PHRASES;
}) => (
	<q>
		Bag {tag} {BAG_LINE_PHRASES[result]}.
	</q>
);

/** Contents as cards, shown above the guide on smaller screens. */
const ContentsGrid = () => (
	<nav aria-label="Guide contents" className="not-prose @4xl:hidden">
		<h2 className="mb-3 text-lg font-semibold">Contents</h2>
		<ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{STAGES.map((stage) => (
				<li key={stage.id}>
					<a
						href={`#${stage.id}`}
						className="block h-full rounded-lg border px-3 py-2 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:hover:bg-emerald-950/30"
					>
						<span className="block text-sm font-medium">{stage.title}</span>
						<span className="block text-xs text-muted-foreground">
							{stage.summary}
						</span>
					</a>
				</li>
			))}
		</ol>
	</nav>
);

/** Contents as a list that stays in view while scrolling, on wide screens. */
const ContentsSidebar = () => (
	<nav aria-label="On this page" className="hidden @4xl:block">
		<div className="sticky top-4">
			<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
				On this page
			</p>
			<ol className="space-y-1 text-sm">
				{STAGES.map((stage) => (
					<li key={stage.id}>
						<a
							href={`#${stage.id}`}
							className="block rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-600"
						>
							{stage.title}
						</a>
					</li>
				))}
			</ol>
		</div>
	</nav>
);

/** The order work moves through the system, as numbered chips. */
const FLOW = [
	"Create a case",
	"Record the samples",
	"Generate certificates",
	"Finalise",
	"Batch",
	"Record the invoice",
];

const FlowChips = () => (
	<ol className="not-prose my-4 flex flex-wrap gap-2" aria-label="The workflow">
		{FLOW.map((step, i) => (
			<li
				key={step}
				className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-1 pr-3 text-sm"
			>
				<span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
					{i + 1}
				</span>
				{step}
			</li>
		))}
	</ol>
);

/**
 * Each case state as it is named on screen, what it means, and the step that
 * comes next. The names come from the same config as the State column.
 */
const CASE_STATES: [string, string, ReactNode][] = [
	[
		PHASE_DISPLAY_NAMES.assessment,
		"The samples are being recorded and assessed. Every new case starts here, and so does a form added to a case later.",
		<>
			<a href="#recording-samples">2. Record the samples</a>, then{" "}
			<a href="#generating-certificates">3. generate the certificates</a>.
		</>,
	],
	[
		PHASE_DISPLAY_NAMES.unsigned_generation,
		"At least one certificate has been generated and is being checked. The botanist signs the printed copy by hand; nothing is signed in the system.",
		<>
			Check each certificate and mark it ready (
			<a href="#generating-certificates">step 3</a>), then{" "}
			<a href="#finalising">4. finalise the case</a>.
		</>,
	],
	[
		PHASE_DISPLAY_NAMES.batching,
		"Finalised. Every certificate is ready, and the case is waiting to go into a batch.",
		<>
			<a href="#batching">5. Batch it</a> from the Cases list.
		</>,
	],
	[
		PHASE_DISPLAY_NAMES.in_batch,
		"In a batch, waiting for the invoice number.",
		<>
			<a href="#invoicing">6. Record the invoice</a> on Batches.
		</>,
	],
	[
		PHASE_DISPLAY_NAMES.complete,
		"The invoice number is recorded. The case is read-only, and only an administrator can change it.",
		"Nothing. The work is done.",
	],
];

/** Glossary terms and their meanings, in alphabetical order. */
const GLOSSARY: [string, string][] = [
	[
		"Approved Botanist",
		"The botanist who examines the samples and signs the certificate. Only botanists approved under the Act appear in the list.",
	],
	[
		"Awaiting invoice",
		"A batch whose invoice number has not been recorded yet. Its cases stay incomplete until it is.",
	],
	[
		"Batch",
		"A group of finished certificates bundled for invoicing. Making one works out the cost and produces a download.",
	],
	[
		"Case",
		"The record for one police submission. It ties together the officers, the defendant, the botanist and one or more Priority 3 forms.",
	],
	[
		"Certificate",
		"The official PDF made for a Priority 3 form once its bags have results. The printed copy is signed by hand.",
	],
	[
		"Content Type",
		"What a bag holds, for example plant, plant material or seed.",
	],
	[
		"Conveying Officer",
		'Recorded as the Submitting Officer. The officer who brought the samples in. Always required, named in Sections (a) and (b), and always printed as "Unsworn Officer".',
	],
	[
		"Defendant",
		'The person named on the submission. The surname prints in capitals. When nobody is named, use "Defendant is unknown" and the certificate reads UNKNOWN.',
	],
	[
		"Determination (result)",
		"The botanist's finding for a bag. It is always one of four: Cannabis sativa, Not Cannabis, Too degraded and could not be identified, or Inconclusive.",
	],
	[
		"Drug Bag",
		"One sealed drug movement bag, known by its seal tag number. It records what it holds and its result.",
	],
	[
		"Legacy Botanist",
		"A botanist from older records, hidden from the selection list while their past cases stay intact.",
	],
	[
		"Needs re-package",
		"Shown on a batch whose certificates have changed since it was packaged. Re-package it to rebuild them.",
	],
	[
		"Out of date",
		"A generated certificate that no longer matches the case because something it prints has changed. Regenerate it, or re-package its batch if it is already in one.",
	],
	[
		"Practice mode",
		"A personal mode for rehearsing the workflow on the real screens with a fake case. Only you see it. Your practice work is kept until you click Reset practice data.",
	],
	[
		"Print options",
		'The tick boxes under each officer that decide whether their station prints and whether the requesting officer\'s rank replaces "Sworn Officer".',
	],
	[
		"Priority 3 Form",
		"One certificate's worth of samples: up to five drug bags, producing exactly one certificate. More than five bags means another form.",
	],
	[
		"Ready",
		"Your confirmation that a certificate has been checked. Every certificate must be Ready before the case can be finalised.",
	],
	[
		"Re-package",
		"Rebuilds a batch's download from its cases as they are now, remaking its certificate PDFs. Use it after changing a case whose certificates are already in a batch.",
	],
	[
		"Requesting Officer",
		'The officer who made the seizure and asked for the identification. Optional; only used when the samples were brought in on their behalf, so the certificate reads "on behalf of" them. Printed as "Sworn Officer" or their rank.',
	],
	[
		"Seal Tag Number",
		"The number on a bag. The original tag is the one it arrived with; the new tag is the bag it is resealed into after examination.",
	],
	[
		"Section B",
		"The examination result sentence on the certificate. It gives one result for the whole form.",
	],
	[
		"Section C",
		'The "other matters" part of the certificate, separate for each form. It lists any bag Section B does not describe, then your notes, then which bags held female plants. It reads "None" when there is nothing to add.',
	],
	[
		"Security Movement Envelope (SME)",
		"The envelope number recorded per form when subsamples are placed into a security movement envelope. Templates can fill it in.",
	],
	[
		"State",
		"Where a case is in the workflow: Assessment, Certificates, Batching, In Batch or Complete. See Case states and the dashboard.",
	],
	[
		"Template",
		"A reusable Section C note. It uses building blocks that fill in each form's own details, so you never type case details into a template.",
	],
	[
		"Unsaved bags",
		"Bags you have entered but not saved yet. They sit in a dashed amber box until you click Confirm or Add All.",
	],
	[
		"Variable (building block)",
		"A placeholder in a template, such as a tag number, an envelope number or a count, that is replaced with the real value from the current form.",
	],
];

const Guide = () => {
	useDocumentTitle("How To");

	return (
		<>
			<PageHeader
				title="How To"
				subtitle="A step-by-step walkthrough, from signing in to a completed invoice."
			/>

			{/* Sized by the space the guide has, not the window, so the side
			    contents list only appears when the practice or reference guide
			    panel leaves room for it. */}
			<div className="@container">
				<div className="@4xl:grid @4xl:grid-cols-[13rem_minmax(0,1fr)] @4xl:gap-10">
					<ContentsSidebar />

					<article className="prose prose-sm dark:prose-invert max-w-3xl">
						{/* Orientation */}
						<section>
							<h2>Before you start</h2>
							<p>
								This system records the identification of suspected cannabis
								samples sent in by WA Police, and produces the certificate that
								reports each result.
							</p>
							<p>
								Work always moves through the same six steps, in this order:
							</p>
							<FlowChips />
							<p>
								You do not have to finish a case in one sitting. Everything you
								enter is saved as you go, so you can leave a case and come back
								to it.
							</p>
							<p>
								In these instructions, words in a box such as <Ui>New Case</Ui>{" "}
								are the names of buttons, fields and menu items, written exactly
								as they appear on screen.
							</p>
							<div className="not-prose space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
								<p>
									<strong className="font-semibold">New here?</strong> Switch on{" "}
									<strong>Practice mode</strong> in the menu under your
									initials. You get a fake case to work through on the real
									screens, without touching real data. See{" "}
									<a href="#practice" className="underline">
										Practice mode
									</a>
									.
								</p>
								<p>
									<strong className="font-semibold">Want a reminder?</strong>{" "}
									Switch on <strong>Guide</strong> in the same menu to keep
									these steps beside the page you are working on. See{" "}
									<a href="#guide" className="underline">
										Quick reference guide
									</a>
									.
								</p>
								<p>
									<strong className="font-semibold">
										Wondering why the certificate reads the way it does?
									</strong>{" "}
									The wording was confirmed by the approved botanist and is the
									same on every certificate. See{" "}
									<a href="#certificate-rules" className="underline">
										Certificate wording rules
									</a>
									.
								</p>
							</div>
						</section>

						<hr />
						<ContentsGrid />
						<hr className="@4xl:hidden" />

						{/* Signing in */}
						<Section id="signing-in">
							<p>
								<strong>The first time</strong>, you sign in from your
								invitation email:
							</p>
							<ol>
								<li>
									Click <Ui>Accept Invitation</Ui> in the email. The page shows
									your name, email and role, and when the invitation expires.
									Opening it does not use the invitation up, so you can come
									back to it.
								</li>
								<li>
									Click <Ui>Set Up Password Now</Ui>. This creates your account.
								</li>
								<li>Choose your password. You land on the Dashboard.</li>
							</ol>
							<p>
								An invitation expires after 24 hours and can only be accepted
								once. If yours has expired, ask an administrator for a new one.
							</p>
							<p>
								<strong>After that</strong>:
							</p>
							<ol>
								<li>Open the system and enter your email and password.</li>
								<li>
									Forgotten your password? Use <Ui>Forgot Password</Ui> on the
									login page. An administrator can also send you a reset email
									from the <Ui>Staff</Ui> page, using{" "}
									<Ui>Send Password Reset</Ui>.
								</li>
							</ol>
							<p>
								What you see depends on your role. Approved botanists and
								finance officers see the whole workflow. Anyone without a role
								sees only the Dashboard and a read-only <Ui>Settings</Ui> page
								until an administrator gives them one.
							</p>
							<Outcome>
								You are on the Dashboard, with <Ui>Cases</Ui> and{" "}
								<Ui>Batches</Ui> in the sidebar on the left.
							</Outcome>
						</Section>

						<hr />

						{/* 1. Creating a case */}
						<Section id="creating-a-case">
							<p>
								A case is one police submission. You create the case first, then
								record the samples against it.
							</p>
							<h3>Case details and defendant</h3>
							<ol>
								<li>
									Go to <Ui>Cases</Ui> and click <Ui>New Case</Ui> (top right).
								</li>
								<li>
									Enter the <Ui>Police Reference No.</Ui> If a case with that
									number already exists, the form tells you and offers{" "}
									<Ui>Add a form to this case</Ui>. Use that case instead of
									making a second one.
								</li>
								<li>
									Check the <Ui>Received Date</Ui>. It starts as today; change
									it to the day the samples arrived if that was earlier.
								</li>
								<li>
									Add the <Ui>Defendant</Ui>. Search for them, or click{" "}
									<Ui>Add</Ui> to create a new one.
								</li>
								<li>
									If the submission names no defendant, click{" "}
									<Ui>Defendant is unknown</Ui>. The certificate then reads
									UNKNOWN. Do not create a defendant called &quot;Unknown&quot;;
									the system will not allow it.
								</li>
								<li>
									Check the <Ui>Approved Botanist</Ui>. If a default botanist is
									set, they are already chosen. Change it if the case belongs to
									someone else.
								</li>
							</ol>

							<h3>Officers</h3>
							<ol>
								<li>
									Choose the <Ui>Submitting Officer (Conveying Officer)</Ui>:
									the officer who brought the samples in. This is required.
								</li>
								<li>
									Only if the samples were brought in on someone else&apos;s
									behalf, choose the <Ui>Requesting Officer (On Behalf Of)</Ui>{" "}
									too. Otherwise leave it blank. The two must be different
									people. (A few older cases brought over from the previous
									system name the same officer twice; they can still be opened
									and edited, but not changed to a different officer in both
									places.)
								</li>
								<li>
									If an officer is not in the list, click <Ui>Add</Ui> next to
									the search box to create them.
								</li>
								<li>
									Under each officer, check the tick boxes. They decide how the
									officer is named on the certificate (see below).
								</li>
							</ol>
							<p>The tick boxes under each officer:</p>
							<ul>
								<li>
									<Ui>Print station on the certificate</Ui> adds &quot;of&quot;
									and the officer&apos;s station after their name, for example
									&quot;… RINALDI, Jade of Midland Drug Receival Unit&quot;.
								</li>
								<li>
									<Ui>Print rank instead of Sworn Officer</Ui> (requesting
									officer only) prints their recorded rank, for example
									&quot;Senior Constable&quot;, in place of &quot;Sworn
									Officer&quot;.
								</li>
								<li>
									Each label shows exactly what will print. If the
									officer&apos;s record has no station or rank, the box is
									greyed out and says so. Nothing prints in its place, and
									nothing stops you carrying on.
								</li>
								<li>
									The boxes start ticked the way they are set under{" "}
									<Ui>Certificate defaults</Ui> in <Ui>Settings</Ui>. Normally
									both stations are ticked and rank is not.
								</li>
							</ul>
							<Tip>
								The <Ui>Police Station</Ui> field fills itself in from the
								requesting officer, or from the conveying officer when there is
								no requesting officer. It is optional. It does not change the
								certificate: each officer&apos;s own station prints, if ticked.
							</Tip>
							<p>
								Click <Ui>Create Case</Ui>. It stays greyed out until the police
								reference, received date, conveying officer, botanist and
								defendant (or <Ui>Defendant is unknown</Ui>) are filled in.
							</p>
							<img
								src="/assets/guide/create-case.png"
								alt="The new case form, showing the police reference, received date, defendant and officer fields"
								className="rounded-lg border shadow-sm"
							/>
							<Outcome>
								The case is created and opens straight away, ready for you to
								record the samples.
							</Outcome>
						</Section>

						<hr />

						{/* 2. Recording the samples */}
						<Section id="recording-samples">
							<p>
								Everything for a case is on one page, in three sections one
								below the other: <Ui>Case Details</Ui>,{" "}
								<Ui>Priority Form Assessment</Ui> and <Ui>Certificates</Ui>.
								Scroll, or click a section in the bar at the top of the page to
								jump to it. You can correct any part at any time until the
								invoice is recorded. After that the case is{" "}
								<strong>Complete</strong> and read-only, and only an
								administrator can change it.
							</p>
							<p>
								Each section shows a tick once it has everything it needs. A
								section that still needs something says what is missing.
							</p>

							<h3>Add a Priority 3 form</h3>
							<p>
								A Priority 3 form is one certificate&apos;s worth of samples: up
								to five drug bags. If the submission has more than five bags,
								add a second form.
							</p>
							<ol>
								<li>
									In <Ui>Priority Form Assessment</Ui>, click{" "}
									<Ui>Add Priority 3 Form</Ui> for the first form.
								</li>
								<li>
									For another form, click <Ui>Add Form</Ui> in the row of form
									tabs. Click a tab to switch between forms. A refresh brings
									you back to the same form.
								</li>
							</ol>

							<h3>Add the drug bags</h3>
							<ol>
								<li>
									Click <Ui>Add Bag</Ui> for one bag, or <Ui>Add Multiple</Ui>{" "}
									for several at once.
								</li>
								<li>
									For each bag, fill in the <Ui>Original Tag</Ui> (the seal tag
									it arrived with), the <Ui>New Tag</Ui> (the bag it was
									resealed into), the <Ui>Content Type</Ui> and the{" "}
									<Ui>Determination</Ui>. Common values are already filled in.
								</li>
								<li>
									Tick <Ui>Contains female plants</Ui> where that applies. The
									box only appears for cannabis plant material. The certificate
									then says which bags held female plants by itself.
								</li>
								<li>
									Click <Ui>Confirm</Ui> on a bag, or <Ui>Add All</Ui> to save
									every new bag at once. Bags that are not saved yet sit in a
									dashed amber box.
								</li>
								<li>
									To change a saved bag, click <Ui>Edit</Ui> on it, make the
									change and click <Ui>Update</Ui>.
								</li>
							</ol>
							<Rule title="Choose one of the four results">
								<p>
									Every bag gets exactly one of these, worded as listed. There
									is no free-text result.
								</p>
								<ul className="list-disc space-y-0.5 pl-5">
									<li>
										<em>{DETERMINATION_LABELS.cannabis_sativa}</em>
									</li>
									<li>{DETERMINATION_LABELS.not_cannabis}</li>
									<li>{DETERMINATION_LABELS.degraded}</li>
									<li>{DETERMINATION_LABELS.inconclusive}</li>
								</ul>
								<p>
									If the sample was insufficient or could not be identified,
									choose <strong>{DETERMINATION_LABELS.inconclusive}</strong>.
									Anything else worth saying about a bag goes in Section C.
								</p>
							</Rule>
							<Tip>
								If a bag is rejected, usually because its tag number is already
								used elsewhere, the problem shows under that bag. Fix it and
								save again.
							</Tip>
							<img
								src="/assets/guide/create-drug.png"
								alt="The Priority Form Assessment section, showing three saved drug bags with their tags, content type, result and a Female badge"
								className="rounded-lg border shadow-sm"
							/>

							<h3>Write the Section C notes</h3>
							<p>
								Section C is the &quot;other matters&quot; part of the
								certificate. Each form has its own.
							</p>
							<ol>
								<li>
									The system adds two kinds of line by itself: one for each bag
									with a different result, and one saying which bags held female
									plants. They appear in a grey box headed{" "}
									<Ui>Added automatically from the bag results</Ui>. You do not
									need to type them.
								</li>
								<li>
									For anything else, such as the security movement envelope,
									choose one under <Ui>Use Template</Ui> if one fits. It fills
									in this form&apos;s tag numbers, envelope number and counts
									for you.
								</li>
								<li>
									Or type the note yourself in{" "}
									<Ui>Other Matters (Section C)</Ui>. Press Enter for a new
									line; line breaks are kept on the certificate.
								</li>
								<li>
									If there is nothing to add, leave it empty. When nothing is
									added automatically either, Section C reads &quot;None&quot;.
								</li>
							</ol>
							<Tip>
								Click <Ui>Preview</Ui> at the top of the section to see the
								certificate as it will print, then <Ui>Form</Ui> to go back. On
								a very wide screen the preview sits beside the form instead, so
								there is no switch.
							</Tip>
							<img
								src="/assets/guide/section-c.png"
								alt="The Section C Notes card, showing the template picker, the grey box of lines added automatically from the bag results, and the botanist's own note"
								className="rounded-lg border shadow-sm"
							/>
							<Outcome>
								Every form has at least one bag, every bag has a result, and{" "}
								<Ui>Priority Form Assessment</Ui> shows a tick.
							</Outcome>
						</Section>

						<hr />

						{/* 3. Generating certificates */}
						<Section id="generating-certificates">
							<p>
								The <Ui>Certificates</Ui> section lists every form on the case.
								Each form produces one certificate.
							</p>
							<ol>
								<li>
									Click <Ui>Generate</Ui> on a form, or <Ui>Generate All</Ui> to
									do every form at once.
								</li>
								<li>
									Open the certificate and read it through. Check the officers,
									Section B and Section C against{" "}
									<a href="#certificate-rules">the wording rules</a>.
								</li>
								<li>
									If something is wrong, correct it in the section above, then
									click <Ui>Regenerate</Ui>. The certificate keeps its number.
								</li>
								<li>
									When a certificate is right, click <Ui>Mark ready</Ui> on it.
									It turns green and reads <Ui>Ready</Ui>. Once every
									certificate is generated you can also use{" "}
									<Ui>Mark All Ready</Ui>.
								</li>
							</ol>
							<h3>When a certificate says &quot;Out of date&quot;</h3>
							<p>
								A certificate is marked <Ui>Out of date</Ui> when something it
								prints has changed since it was generated: a bag or its result,
								the Section C notes, an officer, an officer&apos;s tick boxes,
								the defendant, the police reference, the botanist, or the
								certificate wording itself. Its <Ui>Ready</Ui> mark is taken
								off. Click <Ui>Regenerate</Ui> (or <Ui>Regenerate All</Ui>),
								check it again, and mark it ready again.
							</p>
							<p>
								A certificate that is already in a batch is not regenerated
								here. If its case changes, the certificate shows{" "}
								<strong>Out of date</strong> with the batch it belongs to, and
								that batch shows <Ui>Needs re-package</Ui> on the{" "}
								<Ui>Batches</Ui> page (see{" "}
								<a href="#batching">Batching for invoicing</a>).
							</p>
							<Tip>
								A certificate cannot be generated while any bag is still{" "}
								<em>Pending Assessment</em>, or has an old result from the
								previous system such as &quot;Mixed&quot; (the message names
								that bag). Give the bag one of the four results and try again.
							</Tip>
							<Tip>
								The botanist signs the printed copy by hand. There is no digital
								signature.
							</Tip>
							<img
								src="/assets/guide/generate-cert.png"
								alt="The Certificates section, showing a generated certificate marked Ready with its PDF open below"
								className="rounded-lg border shadow-sm"
							/>
							<Outcome>
								Every form has a certificate and every certificate reads{" "}
								<Ui>Ready</Ui>.
							</Outcome>
						</Section>

						<hr />

						{/* 4. Finalising */}
						<Section id="finalising">
							<p>
								Finalising hands the case over for invoicing. Do it once every
								certificate is generated and checked.
							</p>
							<ol>
								<li>
									Scroll to the bottom of the case page and click{" "}
									<Ui>Finalise Case</Ui>.
								</li>
								<li>
									If something is still outstanding, the button is greyed out
									and the reason is written just above it, for example &quot;A
									certificate is out of date — regenerate it before
									finalising&quot;. Sections that still need work also show
									without a tick in the bar at the top.
								</li>
							</ol>
							<Outcome>
								You are back on the <Ui>Cases</Ui> list. The case shows as{" "}
								<strong>Batching</strong>, with a tick box for selecting it.
							</Outcome>
						</Section>

						<hr />

						{/* 5. Batching */}
						<Section id="batching">
							<p>
								A batch groups finished certificates together, works out the
								cost and makes one download. You can batch several cases at
								once.
							</p>
							<ol>
								<li>
									On the <Ui>Cases</Ui> page, tick the cases you want to batch.
									Only cases showing <strong>Batching</strong> can be ticked.
								</li>
								<li>
									Click <Ui>Create Batch</Ui> (top right). The button shows how
									many certificates you have selected.
								</li>
								<li>
									You are taken to <Ui>Batches</Ui>, where the new batch is
									listed with its certificate count, bag count and total.
								</li>
								<li>
									Click the batch to open it, then click{" "}
									<Ui>Download Package</Ui>. You can also use{" "}
									<Ui>Download package</Ui> in the row&apos;s <Ui>⋯</Ui> menu.
								</li>
							</ol>
							<p>The package is a ZIP file holding:</p>
							<ul>
								<li>each certificate as its own PDF;</li>
								<li>
									<strong>all_certificates</strong>, every certificate in one
									PDF in certificate-number order, so the batch prints in one
									go;
								</li>
								<li>
									<strong>cost_summary</strong>, the totals for the invoice.
								</li>
							</ul>
							<Tip>
								Need to change a certificate after batching? Correct the case,
								then use <Ui>Re-package</Ui> on the batch. That rebuilds the
								PDFs and the ZIP from the case as it is now, without taking
								anything out of the batch. A batch whose cases have changed
								since it was packaged shows <Ui>Needs re-package</Ui> under its
								number, and opening it names the certificates that changed.
								Batches made before this check was added are never flagged, so
								re-package those yourself after a correction.
							</Tip>
							<img
								src="/assets/guide/batches-1.png"
								alt="The batches list, showing batch numbers, totals and invoice status"
								className="rounded-lg border shadow-sm"
							/>
							<img
								src="/assets/guide/batches-2.png"
								alt="A single batch opened, showing its certificates and the download and invoice actions"
								className="rounded-lg border shadow-sm"
							/>
							<Outcome>
								The batch exists, you have the package, and the batch shows{" "}
								<Ui>Awaiting invoice</Ui>.
							</Outcome>
						</Section>

						<hr />

						{/* 6. Invoicing */}
						<Section id="invoicing">
							<p>
								The invoice itself is raised outside this system. Recording its
								number here is what marks the work complete.
							</p>
							<ol>
								<li>Raise the invoice as usual, using the cost summary.</li>
								<li>
									Go back to <Ui>Batches</Ui>. A banner at the top lists the
									batches still waiting, and the count also shows next to{" "}
									<Ui>Batches</Ui> in the sidebar.
								</li>
								<li>
									Click <Ui>Awaiting invoice</Ui> on the batch, the{" "}
									<Ui>Record invoice for …</Ui> button in the banner, or{" "}
									<Ui>Set Invoice Number</Ui> in the opened batch.
								</li>
								<li>
									Enter the invoice number and click{" "}
									<Ui>Record &amp; complete</Ui> (or press Enter). Each number
									can only be used once.
								</li>
							</ol>
							<Tip>
								Entered the wrong number? Open the batch&apos;s <Ui>⋯</Ui> menu,
								choose <Ui>Unset invoice number</Ui>, then record the right one.
							</Tip>
							<Outcome>
								The batch shows its invoice number with a tick, its cases read{" "}
								<strong>Complete</strong>, and the sidebar count goes away.
							</Outcome>
						</Section>

						<hr />

						{/* Case states and the dashboard */}
						<Section id="states">
							<p>
								Every case shows a <Ui>State</Ui> on the <Ui>Cases</Ui> list.
								The same names are used by the <Ui>All States</Ui> filter and
								the cards at the top of the Dashboard. The state moves on by
								itself as you work; you never set it by hand.
							</p>
							<div className="not-prose my-4 overflow-x-auto">
								<table className="w-full border-collapse text-sm">
									<caption className="sr-only">
										What each case state means and what to do next
									</caption>
									<thead>
										<tr className="border-b text-left">
											<th scope="col" className="py-2 pr-4 font-semibold">
												State
											</th>
											<th scope="col" className="py-2 pr-4 font-semibold">
												What it means
											</th>
											<th scope="col" className="py-2 font-semibold">
												What to do next
											</th>
										</tr>
									</thead>
									<tbody className="align-top">
										{CASE_STATES.map(([state, meaning, next]) => (
											<tr key={state} className="border-b">
												<th scope="row" className="py-2 pr-4 font-medium">
													{state}
												</th>
												<td className="py-2 pr-4 text-muted-foreground">
													{meaning}
												</td>
												<td className="py-2">{next}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							<h3>Cases with more than one form</h3>
							<p>
								Each Priority 3 form moves through these states on its own. The
								case&apos;s <Ui>State</Ui> is the earliest one among its forms
								that are not yet complete, and it reads{" "}
								<strong>Complete</strong> only once every form is. So adding a
								form to a case that is already in a batch shows the case as{" "}
								<strong>Assessment</strong> again until the new form catches up.
							</p>
							<p>
								The <Ui>All States</Ui> filter and the Dashboard cards count a
								case under every state one of its forms is in. A case with forms
								at two stages appears under both, while its <Ui>State</Ui>{" "}
								column shows the earlier one.
							</p>
							<h3>The Dashboard</h3>
							<ul>
								<li>
									The four cards count the cases waiting at{" "}
									<strong>Assessment</strong>, <strong>Certificates</strong>,{" "}
									<strong>Batching</strong> and <strong>In Batch</strong>, and
									how many forms those cases hold. Each card names the step in
									this guide that comes next. Click a card to open the{" "}
									<Ui>Cases</Ui> list filtered to that state.
								</li>
								<li>
									<strong>Monthly Throughput</strong> shows, for each month of
									the financial year, the cases received, the certificates first
									generated, the bags on the cases received, and the revenue
									from invoices recorded.
								</li>
								<li>
									<strong>Financial Year Revenue</strong> totals the batches
									whose invoice number was recorded this financial year.
								</li>
							</ul>
						</Section>

						<hr />

						{/* Certificate wording rules */}
						<Section id="certificate-rules">
							<p>
								The approved botanist confirmed these rules in October 2026.
								They are built into the system, so every certificate reads the
								same way and nobody has to remember them. They have been checked
								against every mix of results a form can hold.
							</p>

							<h3>Officers</h3>
							<Rule title="Station and rank stay on the certificate">
								<p>
									Certificates have always named the officers this way, and the
									wording has stood up to legal argument. It stays until WA
									Police advise otherwise.
								</p>
							</Rule>
							<div className="overflow-x-auto">
								<table>
									<thead>
										<tr>
											<th scope="col">Officer</th>
											<th scope="col">Prints as</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td>Conveying (submitting) officer</td>
											<td>
												Always <strong>Unsworn Officer</strong>, then badge,
												SURNAME, given names, then &quot;of&quot; their station.
												For example: &quot;Unsworn Officer PD56359 RINALDI, Jade
												of Midland Drug Receival Unit&quot;.
											</td>
										</tr>
										<tr>
											<td>Requesting officer (only if there is one)</td>
											<td>
												<strong>Sworn Officer</strong>, or their recorded rank
												when <Ui>Print rank instead of Sworn Officer</Ui> is
												ticked. For example: &quot;on behalf of Senior Constable
												PD17432 BARNS, Tahlia of Mandurah District Office&quot;.
											</td>
										</tr>
									</tbody>
								</table>
							</div>
							<ul>
								<li>
									A station prints only when its tick box is ticked and the
									officer has one on record. If not, the name simply ends there.
									A missing station never stops you.
								</li>
								<li>
									The conveying and requesting officers are almost never the
									same person. The system will not let you choose one person for
									both.
								</li>
							</ul>

							<h3>Results</h3>
							<p>
								Each bag gets one of the four results:{" "}
								<em>{DETERMINATION_LABELS.cannabis_sativa}</em>,{" "}
								{DETERMINATION_LABELS.not_cannabis},{" "}
								{DETERMINATION_LABELS.degraded}, or{" "}
								{DETERMINATION_LABELS.inconclusive}. These are the exact words
								used on the certificate. There is no free-text result.
								&quot;Insufficient, could not identify&quot; is recorded as{" "}
								{DETERMINATION_LABELS.inconclusive}.
							</p>

							<h3>Section B: the result sentence</h3>
							<p>
								Section B gives one result for the whole form. Section C then
								lists any bag that Section B does not describe.
							</p>
							<div className="overflow-x-auto">
								<table>
									<thead>
										<tr>
											<th scope="col">The bags on the form are…</th>
											<th scope="col">Section B reads</th>
											<th scope="col">Section C adds a line for…</th>
										</tr>
									</thead>
									<tbody>
										<tr>
											<td>
												All <em>Cannabis sativa</em>
											</td>
											<td>
												<SectionBExample result="cannabis_sativa" bags="many" />
											</td>
											<td>No bags</td>
										</tr>
										<tr>
											<td>
												Some <em>Cannabis sativa</em>, some not
											</td>
											<td>
												<SectionBExample result="cannabis_sativa" bags="many" />
											</td>
											<td>
												Each bag that is not <em>Cannabis sativa</em>
											</td>
										</tr>
										<tr>
											<td>All {DETERMINATION_LABELS.not_cannabis}</td>
											<td>
												<SectionBExample result="not_cannabis" bags="many" />
											</td>
											<td>No bags</td>
										</tr>
										<tr>
											<td>All {DETERMINATION_LABELS.degraded}</td>
											<td>
												<SectionBExample result="degraded" bags="many" />
											</td>
											<td>No bags</td>
										</tr>
										<tr>
											<td>All {DETERMINATION_LABELS.inconclusive}</td>
											<td>
												<SectionBExample result="inconclusive" bags="many" />
											</td>
											<td>No bags</td>
										</tr>
										<tr>
											<td>
												No <em>Cannabis sativa</em>, and the results differ
											</td>
											<td>
												<SectionBExample
													result="mixed_not_cannabis"
													bags="many"
												/>
											</td>
											<td>Every bag</td>
										</tr>
									</tbody>
								</table>
							</div>
							<p>
								With a single bag the sentence says &quot;item&quot; instead of
								&quot;items&quot;, for example{" "}
								<SectionBExample result="cannabis_sativa" bags="one" />
							</p>

							<h3>Section C: other matters</h3>
							<p>The lines Section C adds for a bag read, word for word:</p>
							<ul>
								<li>
									<BagLineExample tag="T1234" result="not_cannabis" />
								</li>
								<li>
									<BagLineExample tag="T1245" result="degraded" />
								</li>
								<li>
									<BagLineExample tag="T9045" result="inconclusive" />
								</li>
							</ul>
							<p>
								Section C also says which <em>Cannabis sativa</em> bags held
								female plants, from the <Ui>Contains female plants</Ui> tick
								box, for example <q>Bags T1001 and T1003 {FEMALE_PHRASE}.</q> or{" "}
								<q>{ALL_FEMALE_LINE}</q> when every bag on the form did.
							</p>
							<ul>
								<li>
									The lines use each bag&apos;s original tag number and follow
									the order the bags were added.
								</li>
								<li>
									The order is always: the bag result lines, then your own notes
									(for example the envelope number), then the female plants
									line.
								</li>
								<li>
									These lines always come from the current bags. If your notes
									contain one, including one left by a template, it is replaced
									by the up-to-date line, so it never prints twice or goes out
									of date.
								</li>
								<li>
									When there are no added lines and no notes, Section C reads
									&quot;None&quot;. The heading always stays, as on Form M.D.14.
								</li>
							</ul>

							<h3>A worked example</h3>
							<p>
								A form holds three bags: T1001 is <em>Cannabis sativa</em> and
								holds female plants, T1002 is{" "}
								{DETERMINATION_LABELS.not_cannabis} and T1003 is{" "}
								{DETERMINATION_LABELS.inconclusive}. The botanist&apos;s note
								says where the subsamples went. The certificate reads:
							</p>
							<div className="not-prose space-y-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
								<div>
									<p className="font-semibold">(b) Examination Results</p>
									<p>
										<SectionBExample result="cannabis_sativa" bags="many" />
									</p>
								</div>
								<div>
									<p className="font-semibold">(c) Additional Notes</p>
									<p>
										<BagLineExample tag="T1002" result="not_cannabis" />
										<br />
										<BagLineExample tag="T1003" result="inconclusive" />
										<br />
										<q>
											Subsamples placed into Security Movement Envelope
											WW00564835.
										</q>
										<br />
										<q>Bag T1001 {FEMALE_PHRASE}.</q>
									</p>
								</div>
							</div>
						</Section>

						<hr />

						{/* Officers, stations and defendants */}
						<Section id="records">
							<p>
								<Ui>Officers</Ui>, <Ui>Stations</Ui> and <Ui>Defendants</Ui> in
								the sidebar list the records that cases choose from. Each case
								points at the record, so a correction made here shows on every
								case that uses it.
							</p>
							<h3>Correcting a record</h3>
							<p>
								Click the row to open it, change the details, and click{" "}
								<Ui>Update Officer</Ui>, <Ui>Update Station</Ui> or{" "}
								<Ui>Update Defendant</Ui>. Certificates that print the changed
								details show <Ui>Out of date</Ui> until they are regenerated, or
								their batch re-packaged.
							</p>
							<h3>Merging duplicates</h3>
							<p>
								If the same officer, station or defendant has been entered
								twice, click <Ui>Merge</Ui> at the top of the page. The cases
								(and, for stations, the officers based there) move to the record
								you keep, and the duplicate is removed. Two officers cannot be
								merged while they are the conveying and requesting officers on
								the same case, because that would name one person twice. Merging
								changes the cases that use the duplicate, so if any of them is
								complete, only an administrator can merge it.
							</p>
							<h3>Deleting a record</h3>
							<ol>
								<li>
									Open the record and click <Ui>Delete officer</Ui>,{" "}
									<Ui>Delete station</Ui> or <Ui>Delete defendant</Ui> under the
									form.
								</li>
								<li>
									If no case uses it, confirm and it is deleted. Otherwise the
									dialog lists every case that uses it (and, for a station, the
									officers based there), with links to open each case.
								</li>
								<li>
									Choose a replacement under <Ui>Replace with</Ui>, then click{" "}
									<Ui>Move … and delete</Ui>. The cases move to the replacement
									first, so no case is left without an officer, station or
									defendant.
								</li>
							</ol>
							<Tip>
								Only an administrator can delete or merge away a record used by
								a complete case, because that changes the case. An officer
								cannot be replaced by someone who is already the other officer
								on one of the same cases.
							</Tip>
						</Section>

						<hr />

						{/* Practice mode */}
						<Section id="practice">
							<p>
								Practice mode is a safe way to learn the workflow on the real
								screens. While it is on, an amber banner stays at the top of
								every page, and <Ui>Cases</Ui> and <Ui>Batches</Ui> show only
								your practice work.
							</p>
							<ol>
								<li>
									Click your initials at the bottom of the sidebar and switch on{" "}
									<Ui>Practice mode</Ui>.
								</li>
								<li>
									You are given a fake Priority 3 brief. Work it through like a
									real case: create the case, record the samples, generate the
									certificates, finalise, batch and record the invoice. Short
									hints guide each step.
								</li>
								<li>
									If the officer or station on your brief is not found, add them
									with the <Ui>Add</Ui> button. In practice mode these are fake
									too.
								</li>
								<li>
									To run the same example again, click{" "}
									<Ui>Restart this practice case</Ui> at the bottom of the
									practice panel. To try a different example, restart the case,
									then use the arrows beside <Ui>Your Priority 3 brief</Ui>.
								</li>
								<li>
									When you are done, click <Ui>Leave practice mode</Ui> in the
									banner, or switch it off in the same menu.
								</li>
							</ol>
							<p>
								Nothing you do in practice mode is real. Practice cases,
								certificates, batches, invoices, officers, stations and
								defendants are kept apart from live work: nobody else sees them,
								they never change the real dashboard figures, and they never use
								a real certificate or invoice number.
							</p>
							<p>
								Your practice work is kept when you leave, so you can pick up
								where you stopped next time. To clear it all and start again,
								click <Ui>Reset practice data</Ui> in the banner.
							</p>
							<Tip>
								<Ui>Settings</Ui>, <Ui>Staff</Ui> and <Ui>Invitations</Ui> have
								no practice copy, so they show real data even in practice mode.
								You can look at them, but changes are refused until you leave
								practice mode. Section C templates are the same: you can use
								them on a practice case, but not add, edit or delete them.
							</Tip>
							<Outcome>
								You have taken a fake case all the way to a recorded invoice,
								and know what each step looks like before doing it for real.
							</Outcome>
						</Section>

						<hr />

						{/* Quick reference guide */}
						<Section id="guide">
							<p>
								The <Ui>Guide</Ui> switch shows the same step-by-step
								instructions as practice mode, beside whatever page you are on,
								but for your real work instead of a fake case.
							</p>
							<ol>
								<li>
									Click your initials at the bottom of the sidebar and switch on{" "}
									<Ui>Guide</Ui>.
								</li>
								<li>
									A panel opens on the right with the same six numbered steps as
									this page. The page makes room for it, so nothing is covered.
								</li>
								<li>
									Click any step to read it. You can move between steps freely;
									the guide does not follow a case.
								</li>
								<li>
									Switch <Ui>Guide</Ui> off in the menu, or close the panel,
									when you are done.
								</li>
							</ol>
							<p>
								The <Ui>Guide</Ui> switch is hidden while practice mode is on,
								because the practice panel already shows these steps.
							</p>
							<Outcome>
								The steps sit beside your work for quick reference, and switch
								off again from the same menu.
							</Outcome>
						</Section>

						<hr />

						{/* Settings */}
						<Section id="settings">
							<p>
								<Ui>Settings</Ui> is at the bottom of the sidebar. It holds:
							</p>
							<ul>
								<li>
									<strong>Pricing configuration</strong>: the{" "}
									<Ui>Certificate Cost</Ui> charged per certificate, the{" "}
									<Ui>Bag Identification</Ui> cost charged per bag, and the{" "}
									<Ui>Tax Percentage</Ui> (GST) added to batch totals. Click a
									rate to change it. New rates apply straight away; batches
									already made keep the rates they were costed at.
								</li>
								<li>
									<strong>Certificate Numbering</strong>: the number the next
									certificate will get.
								</li>
								<li>
									<strong>Default Botanist</strong>: chosen automatically on
									each new case.
								</li>
								<li>
									<strong>Certificate defaults</strong>: how the officer tick
									boxes start on each new case (both stations ticked, rank not
									ticked, unless changed here).
								</li>
								<li>
									<strong>Remembered searches</strong> (administrators only):
									lets list pages keep each person&apos;s search between visits.
									It is off by default, because a remembered search can hide a
									case that was just created.
								</li>
								<li>
									<strong>Section C Templates</strong>: the reusable notes
									offered under <Ui>Use Template</Ui>.
								</li>
							</ul>
							<p>
								Changing a default never changes cases that already exist. Each
								case keeps its own choices, which you can still change on the
								case.
							</p>
							<p>
								Finance officers, botanists and administrators can change the
								rates, numbering and defaults, and manage the Section C
								templates. Only an administrator can change remembered searches.
								Anyone without a role can view the page but not change it. In
								practice mode it is read-only for everyone, because settings are
								shared; a note at the top says why.
							</p>
							<img
								src="/assets/guide/settings.png"
								alt="The settings page, showing the pricing cards and certificate numbering"
								className="rounded-lg border shadow-sm"
							/>
						</Section>

						<hr />

						{/* Account */}
						<Section id="account">
							<p>
								Your initials are at the very bottom of the sidebar. Click them
								to:
							</p>
							<ul>
								<li>
									switch <Ui>Theme</Ui> between light and dark;
								</li>
								<li>
									choose a <Ui>Loader style</Ui>, the animation shown while a
									page loads;
								</li>
								<li>
									switch <Ui>Practice mode</Ui> or the <Ui>Guide</Ui> on or off;
								</li>
								<li>
									<Ui>Change password</Ui> (you need your current one);
								</li>
								<li>
									<Ui>Log out</Ui>.
								</li>
							</ul>
						</Section>

						<hr />

						{/* Glossary */}
						<Section id="glossary">
							<p>
								Plain-language meanings of the terms used in this guide, A to Z.
							</p>
							<dl className="not-prose space-y-3 text-sm">
								{GLOSSARY.map(([term, meaning]) => (
									<div key={term}>
										<dt className="font-semibold">{term}</dt>
										<dd className="text-muted-foreground">{meaning}</dd>
									</div>
								))}
							</dl>
						</Section>
					</article>
				</div>
			</div>
		</>
	);
};

export default Guide;
