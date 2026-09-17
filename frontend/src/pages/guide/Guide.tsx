import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { PageHeader } from "@/shared/components/PageHeader";

/**
 * Step-by-step how-to guide for the Cannabis Identification System.
 *
 * Content is written out here rather than loaded from anywhere — edit this file
 * to update the guide. Screenshots live in public/assets/guide/ and are
 * referenced as /assets/guide/filename.png
 */

interface Stage {
	id: string;
	title: string;
}

/** Stages in the order a case moves through them, for the contents list. */
const STAGES: Stage[] = [
	{ id: "signing-in", title: "1. Signing in" },
	{ id: "creating-a-case", title: "2. Creating a case" },
	{ id: "recording-samples", title: "3. Recording the samples" },
	{ id: "generating-certificates", title: "4. Generating certificates" },
	{ id: "finalising", title: "5. Finalising the case" },
	{ id: "batching", title: "6. Batching for invoicing" },
	{ id: "invoicing", title: "7. Recording the invoice" },
	{ id: "settings", title: "Settings" },
	{ id: "account", title: "Your account" },
	{ id: "glossary", title: "Glossary" },
];

/** Green "you're done" marker closing each stage. */
const Outcome = ({ children }: { children: React.ReactNode }) => (
	<p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100">
		<strong className="font-semibold">When you&apos;re done:</strong> {children}
	</p>
);

/** Aside for a tip that is helpful but not part of the steps. */
const Tip = ({ children }: { children: React.ReactNode }) => (
	<p className="text-sm text-muted-foreground">
		<strong className="font-medium text-foreground">Tip:</strong> {children}
	</p>
);

const Guide = () => {
	useDocumentTitle("How To");

	return (
		<>
			<PageHeader
				title="How To"
				subtitle="A step-by-step walkthrough, from signing in to a completed invoice."
			/>

			<article className="prose prose-sm dark:prose-invert max-w-none">
				{/* Orientation */}
				<section>
					<h2>Before you start</h2>
					<p>
						This system records the identification of suspected cannabis samples
						submitted by WA Police, and produces the certificate that reports
						each result.
					</p>
					<p>Work moves through the system in one direction:</p>
					<p className="rounded-lg border bg-muted/40 px-4 py-3 font-medium not-prose">
						Create a case → record the samples → generate certificates →
						finalise → batch → record the invoice
					</p>
					<p>
						You do not have to finish a case in one sitting. Everything you type
						is saved as you go, so you can leave a case and come back to it.
					</p>
				</section>

				<hr />

				{/* Contents */}
				<section>
					<h2>Contents</h2>
					<ol className="not-prose space-y-1">
						{STAGES.map((stage) => (
							<li key={stage.id}>
								<a
									href={`#${stage.id}`}
									className="text-blue-600 hover:underline dark:text-blue-400"
								>
									{stage.title}
								</a>
							</li>
						))}
					</ol>
				</section>

				<hr />

				{/* 1. Signing in */}
				<section id="signing-in" className="scroll-mt-6">
					<h2>1. Signing in</h2>
					<ol>
						<li>Open the application and enter your email and password.</li>
						<li>
							If you have forgotten your password, use{" "}
							<strong>Forgot Password</strong> on the login page. An
							administrator can also send you a reset email from the Staff page.
						</li>
					</ol>
					<p>
						What you can see depends on your role. Approved botanists and
						finance officers see the full workflow; anyone without a role sees
						only the Dashboard until an administrator assigns one.
					</p>
					<Outcome>
						You land on the Dashboard, with Cases and Batches in the sidebar on
						the left.
					</Outcome>
				</section>

				<hr />

				{/* 2. Creating a case */}
				<section id="creating-a-case" className="scroll-mt-6">
					<h2>2. Creating a case</h2>
					<p>
						A case is one police submission. Create it first, then record the
						samples against it.
					</p>
					<ol>
						<li>
							Go to <strong>Cases</strong> and click <strong>New Case</strong>.
						</li>
						<li>
							Enter the <strong>Police Reference Number</strong>. If it matches
							a case that already exists, the form will say so and point you to
							it — use that case rather than creating a duplicate.
						</li>
						<li>
							Set the <strong>Received Date</strong> — the day the samples
							arrived.
						</li>
						<li>
							Add the <strong>Defendant</strong>. If the submission does not
							name one, tick the unknown-defendant box instead; the certificate
							will read &quot;Unknown&quot;.
						</li>
						<li>
							Choose the <strong>Submitting Officer</strong>. This is the
							officer who physically delivered the samples, and the one named on
							the certificate.
						</li>
						<li>
							Only if the samples were delivered on someone else&apos;s behalf,
							choose the <strong>Requesting Officer</strong> as well. Otherwise
							leave it blank.
						</li>
						<li>
							Check the <strong>Approved Botanist</strong>. If a default
							botanist has been set, this is already filled in — change it if
							this case belongs to someone else.
						</li>
						<li>
							Click <strong>Create Case</strong>.
						</li>
					</ol>
					<Tip>
						The station fills itself in from the officer you chose. You only
						need to set it by hand if that officer has no station recorded.
					</Tip>
					<br />
					<img
						src="/assets/guide/create-case.png"
						alt="The new case form, showing the police reference, received date, defendant and officer fields"
						className="rounded-lg border shadow-sm"
					/>
					<Outcome>
						The case is created and you are taken straight to it, ready to
						record the samples.
					</Outcome>
				</section>

				<hr />

				{/* 3. Recording the samples */}
				<section id="recording-samples" className="scroll-mt-6">
					<h2>3. Recording the samples</h2>
					<p>
						Everything for a case is on one page. Case Details, Assessment and
						Certificates sit one below the other, and you can scroll or use the
						section list at the top to jump between them. Nothing is locked
						behind anything else — you can correct any part at any time.
					</p>
					<p>
						Each section shows a tick once it holds everything it needs, so you
						can see at a glance what is left to do.
					</p>

					<h3>Add a Priority 3 form</h3>
					<p>
						A Priority 3 form is one certificate&apos;s worth of samples. It
						holds up to five drug bags. If the submission has more than five
						bags, add a second form.
					</p>
					<ol>
						<li>
							In the <strong>Assessment</strong> section, click{" "}
							<strong>Add Priority 3 Form</strong>.
						</li>
						<li>
							Use the row of form tabs to switch between forms once you have
							more than one. The form you are looking at is part of the page
							address, so a refresh brings you back to the same one.
						</li>
					</ol>

					<h3>Add the drug bags</h3>
					<ol>
						<li>
							Click <strong>Add Bag</strong> for one bag, or{" "}
							<strong>Add Multiple</strong> to enter several at once.
						</li>
						<li>
							For each bag, enter the <strong>seal tag number</strong> it
							arrived with, the <strong>new seal tag number</strong> it was
							resealed into, the <strong>content type</strong>, and your{" "}
							<strong>determination</strong>. Common values are prefilled.
						</li>
						<li>
							Tick <strong>contains female plants</strong> where that applies.
						</li>
						<li>
							Click <strong>Add All</strong> to save them. Unsaved bags sit in a
							dashed amber box until you do.
						</li>
					</ol>
					<Tip>
						If a bag is rejected — usually a tag number already used elsewhere —
						the problem is shown under that bag. Fix it and click Add All again.
					</Tip>

					<h3>Add the Section C notes</h3>
					<p>
						Section C is the &quot;other matters&quot; paragraph on the
						certificate. It is per form, so each certificate gets its own.
					</p>
					<ol>
						<li>
							Pick a <strong>template</strong> if one fits. Templates fill in
							this form&apos;s tag numbers, envelope number and counts for you.
						</li>
						<li>
							Or type the note yourself. Press Enter for a new line — line
							breaks are kept on the certificate.
						</li>
						<li>
							Leave it empty if there is nothing to note; the certificate will
							read &quot;None&quot;.
						</li>
					</ol>
					<Outcome>
						Every form has at least one bag, every bag has a determination, and
						the Assessment section shows a tick.
					</Outcome>
				</section>

				<hr />

				{/* 4. Generating certificates */}
				<section id="generating-certificates" className="scroll-mt-6">
					<h2>4. Generating certificates</h2>
					<p>
						The <strong>Certificates</strong> section lists every form on the
						case. Each one produces a single certificate.
					</p>
					<ol>
						<li>
							Click <strong>Generate</strong> on a form, or{" "}
							<strong>Generate All</strong> to do the lot.
						</li>
						<li>Open the generated PDF and read it through.</li>
						<li>
							If something needs changing, correct it in the section above and
							click <strong>Regenerate</strong>.
						</li>
						<li>
							Once a certificate is right, mark that form <strong>Ready</strong>{" "}
							using the round tick button.
						</li>
					</ol>
					<Tip>
						The botanist signs the printed copy by hand. There is no digital
						signature.
					</Tip>
					<Outcome>
						Every form has a generated certificate and is marked Ready.
					</Outcome>
				</section>

				<hr />

				{/* 5. Finalising */}
				<section id="finalising" className="scroll-mt-6">
					<h2>5. Finalising the case</h2>
					<p>
						Finalising hands the case over for invoicing. Do it once every
						certificate is generated and reviewed.
					</p>
					<ol>
						<li>
							Click <strong>Finalise Case</strong> at the top right of the case
							page.
						</li>
						<li>
							If anything is still outstanding, the button stays greyed out.
							Hover over it to see what is missing, or look for the section
							without a tick.
						</li>
					</ol>
					<Outcome>
						You are returned to the Cases list and the case shows as{" "}
						<strong>Batching</strong>, with a checkbox for selecting it.
					</Outcome>
				</section>

				<hr />

				{/* 6. Batching */}
				<section id="batching" className="scroll-mt-6">
					<h2>6. Batching for invoicing</h2>
					<p>
						A batch groups finished certificates together, works out the cost,
						and produces one downloadable package. You can batch several cases
						at once.
					</p>
					<ol>
						<li>
							On the <strong>Cases</strong> page, tick the cases you want to
							batch. Only cases in the Batching state can be selected.
						</li>
						<li>
							Click <strong>Create Batch</strong> at the top right. The button
							shows how many certificates you have selected.
						</li>
						<li>
							You are taken to <strong>Batches</strong>, where the new batch
							appears with its certificate count, bag count and total.
						</li>
						<li>
							Click the batch, then <strong>Download Package</strong> to get a
							ZIP containing every certificate PDF plus the cost summary.
						</li>
					</ol>
					<Tip>
						If you need to change a certificate after batching, use{" "}
						<strong>Re-package</strong> on the batch. That regenerates the PDFs
						and rebuilds the ZIP without unbatching anything.
					</Tip>
					<br />
					<img
						src="/assets/guide/batches-1.png"
						alt="The batches list, showing batch numbers, totals and invoice status"
						className="rounded-lg border shadow-sm"
					/>
					<br />
					<img
						src="/assets/guide/batches-2.png"
						alt="A single batch opened, showing its certificates and the download and invoice actions"
						className="rounded-lg border shadow-sm"
					/>
					<Outcome>
						The batch exists, you have the package, and the batch shows{" "}
						<strong>Awaiting invoice</strong>.
					</Outcome>
				</section>

				<hr />

				{/* 7. Invoicing */}
				<section id="invoicing" className="scroll-mt-6">
					<h2>7. Recording the invoice</h2>
					<p>
						The invoice itself is raised outside this system. Recording its
						number here is what marks the work complete.
					</p>
					<ol>
						<li>Raise the invoice in the usual way, using the cost summary.</li>
						<li>
							Come back to <strong>Batches</strong>. Any batch still waiting
							shows <strong>Awaiting invoice</strong>, and the count also
							appears next to Batches in the sidebar.
						</li>
						<li>
							Click <strong>Awaiting invoice</strong> on the batch, or use the
							prompt at the top of the page.
						</li>
						<li>
							Enter the invoice number and save. Each number can only be used
							once.
						</li>
					</ol>
					<Tip>
						Recorded the wrong number? Open the batch&apos;s menu and choose{" "}
						<strong>Unset invoice number</strong>, then record the right one.
					</Tip>
					<Outcome>
						The batch shows its invoice number with a tick, its cases read{" "}
						<strong>Complete</strong>, and the sidebar count clears.
					</Outcome>
				</section>

				<hr />

				{/* Settings */}
				<section id="settings" className="scroll-mt-6">
					<h2>Settings</h2>
					<p>
						<strong>Settings</strong> sits at the bottom of the sidebar, in its
						own section. It holds:
					</p>
					<ul>
						<li>
							<strong>Certificate Cost</strong> — charged per certificate
							generated.
						</li>
						<li>
							<strong>Bag Identification Cost</strong> — charged per bag
							examined.
						</li>
						<li>
							<strong>Tax Percentage</strong> — GST applied to batch totals.
						</li>
						<li>
							<strong>Certificate Numbering</strong> — the next certificate
							number to be issued.
						</li>
						<li>
							<strong>Default Botanist</strong> — pre-selected when a new case
							is created. Changing it never affects existing cases.
						</li>
						<li>
							<strong>Section C Templates</strong> — the reusable notes offered
							when writing Section C.
						</li>
					</ul>
					<p>
						Rates apply from the moment you change them. Batches already created
						keep the rates they were costed at.
					</p>
					<br />
					<img
						src="/assets/guide/settings.png"
						alt="The settings page, showing the pricing cards and certificate numbering"
						className="rounded-lg border shadow-sm"
					/>
				</section>

				<hr />

				{/* Account */}
				<section id="account" className="scroll-mt-6">
					<h2>Your account</h2>
					<p>
						Your initials sit at the very bottom of the sidebar. Click them to:
					</p>
					<ul>
						<li>
							<strong>Switch theme</strong> — light, dark, or follow your
							system.
						</li>
						<li>
							<strong>Change password</strong> — you will need your current one.
						</li>
						<li>
							<strong>Log out</strong>.
						</li>
					</ul>
				</section>

				<hr />

				{/* Glossary */}
				<section id="glossary" className="scroll-mt-6">
					<h2>Glossary</h2>
					<p>Plain-language definitions of the terms used above.</p>
					<dl className="space-y-3">
						<div>
							<dt className="font-semibold">Case</dt>
							<dd className="text-muted-foreground">
								The record for one police submission. Ties together the
								officers, the defendant, the botanist, and one or more Priority
								3 forms.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Priority 3 Form</dt>
							<dd className="text-muted-foreground">
								A single certificate&apos;s worth of samples. Holds up to five
								drug bags and produces exactly one certificate. More than five
								bags means another form.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Drug Bag</dt>
							<dd className="text-muted-foreground">
								One sealed drug movement bag, identified by its seal tag number.
								Records what it contains and the determination.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Seal Tag Number</dt>
							<dd className="text-muted-foreground">
								The number printed on the bag. The original tag is the one it
								arrived with; the new tag is the fresh bag it is resealed into
								after examination.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Determination</dt>
							<dd className="text-muted-foreground">
								The botanist&apos;s finding for a bag — whether the material is
								cannabis, and its species.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Content Type</dt>
							<dd className="text-muted-foreground">
								What the bag holds — for example plant, seed or cutting.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Conveying Officer</dt>
							<dd className="text-muted-foreground">
								Recorded as the Submitting Officer. The unsworn officer who
								physically delivered the samples, and the officer named on the
								certificate. Always required.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Requesting Officer</dt>
							<dd className="text-muted-foreground">
								The sworn officer who made the seizure and asked for the
								identification. Optional, and only used when the samples were
								delivered on their behalf — in which case the certificate reads
								&quot;on behalf of&quot; them.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Approved Botanist</dt>
							<dd className="text-muted-foreground">
								The botanist who examines the samples and signs the certificate.
								Only botanists approved under the Act appear in the list.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">
								Security Movement Envelope (SME)
							</dt>
							<dd className="text-muted-foreground">
								The envelope number recorded per form when subsamples are placed
								into a security movement envelope. Available to Section C
								templates.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Section C Notes</dt>
							<dd className="text-muted-foreground">
								The &quot;other matters&quot; paragraph on the certificate.
								Specific to each form. Reads &quot;None&quot; if left empty.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Template</dt>
							<dd className="text-muted-foreground">
								A reusable, generically worded Section C note. Templates use
								building blocks that fill in each form&apos;s own data, so you
								never type case-specific details into a template.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Variable (Building Block)</dt>
							<dd className="text-muted-foreground">
								A placeholder in a template — a tag number, an envelope number,
								a count — that the system replaces with the real value from the
								current form.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Unsaved Bags</dt>
							<dd className="text-muted-foreground">
								Bags you have typed but not yet committed. They sit in a dashed
								amber box until you click <strong>Add All</strong>.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Certificate</dt>
							<dd className="text-muted-foreground">
								The official PDF produced for a form once its bags are assessed.
								The printed copy is signed by hand.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Ready</dt>
							<dd className="text-muted-foreground">
								Your confirmation that a form&apos;s certificate has been
								reviewed. Every form must be Ready before the case can be
								finalised.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Batch</dt>
							<dd className="text-muted-foreground">
								A group of finished certificates bundled for invoicing. Creating
								one works out the cost and produces a downloadable package.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Re-package</dt>
							<dd className="text-muted-foreground">
								Rebuilds a batch&apos;s package with the latest data,
								regenerating its certificate PDFs. Use it after changing a
								certificate that has already been batched.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Awaiting invoice</dt>
							<dd className="text-muted-foreground">
								A batch that has been created but whose invoice number has not
								been recorded yet. Its cases stay incomplete until it is.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Legacy Botanist</dt>
							<dd className="text-muted-foreground">
								A botanist from historical records, hidden from the selection
								list to reduce clutter while their past cases stay intact.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Defendant</dt>
							<dd className="text-muted-foreground">
								The person named on the submission. Recorded with surname, which
								appears in capitals on the certificate, and given names.
							</dd>
						</div>
					</dl>
				</section>
			</article>
		</>
	);
};

export default Guide;
