import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";
import { PageHeader } from "@/shared/components/PageHeader";

/**
 * Static how-to guide for the Cannabis Identification System.
 * Content is hardcoded — edit this file to update the guide.
 * Add screenshots to public/assets/guide/ and reference them as /assets/guide/filename.png
 */
const Guide = () => {
	useDocumentTitle("How To");

	return (
		<>
			<PageHeader
				title="How To"
				subtitle="A quick guide on how to use the Cannabis Identification System."
			/>

			<article className="prose prose-sm dark:prose-invert max-w-none space-y-8">
				{/* Getting Started */}
				<section>
					<h2>Getting Started</h2>
					<p>
						The Cannabis Identification System manages the workflow for
						identifying cannabis samples submitted by WA Police. This version of
						the application focuses on data entry and certificate genration
						following an assessment.
					</p>
				</section>

				<hr />

				{/* Creating a Case */}
				<section>
					<h2>Creating a New Case</h2>
					<ol>
						<li>
							Click <strong>New Case</strong> from the Dashboard or Cases page.
						</li>
						<li>
							Fill in the <strong>Police Reference Number</strong> and{" "}
							<strong>Received Date</strong>.
						</li>
						<li>
							Select the <strong>Approved Botanist</strong> who will examine the
							samples.
						</li>
						<li>
							Add at least one <strong>Defendant</strong> (or mark as unknown).
						</li>
						<li>
							Select the <strong>Submitting Officer</strong> (conveying officer)
							and optionally the Requesting Officer and Station.
						</li>
						<li>
							Click <strong>Create Case</strong>.
						</li>
					</ol>
					<br />
					<img
						src="/assets/guide/create-case.png"
						alt="Create case form"
						className="rounded-lg border shadow-sm"
					/>
				</section>

				<hr />

				{/* Officer Roles */}
				<section>
					<h2>Officer Roles</h2>
					<p>
						When creating a case, two officer roles may be assigned. These map
						to common police terminology as follows:
					</p>
					<ul>
						<li>
							<strong>Submitting Officer (Conveying Officer)</strong> — The
							officer who physically delivers the samples to the laboratory for
							examination. This is usually an unsworn officer stationed at
							Midland, where the botanist performs identifications.
						</li>
						<li>
							<strong>Requesting Officer (On Behalf Of)</strong> — The sworn
							officer who made the original seizure or arrest and requested the
							botanical identification. This officer typically works at a
							station other than Midland.
						</li>
					</ul>
					<p>
						If only one officer is involved (e.g. the Conveying Officer -
						Unsworn Officer is submitting the samples for favour of
						examination), select them as the Submitting Officer and leave the
						Requesting Officer blank.
					</p>
					<p className="text-sm text-muted-foreground">
						Tip: The Requesting Officer field is optional. Only fill it in when
						the samples were conveyed on behalf of another officer.
					</p>
				</section>

				<hr />

				{/* Adding Forms and Bags */}
				<section>
					<h2>Adding Priority 3 Forms and Drug Bags</h2>
					<p>
						After creating a case, you land on the <strong>Assessment</strong>{" "}
						step. Each case can have multiple Priority 3 Forms, and each form
						holds up to 5 drug bags.
					</p>
					<ol>
						<li>
							Click <strong>Add Priority 3 Form</strong> to create a form.
						</li>
						<li>
							Use <strong>Add Bag</strong> or <strong>Add Multiple</strong> to
							add drug bags to that specific form.
						</li>
						<li>
							For each bag, enter the seal tag numbers, content type, and
							botanical determination. These are prefilled with defaults to
							speed things up.
						</li>
						<li>
							Click <strong>Add All</strong> to save unsaved bags to the form.
						</li>
						<li>
							Fill in <strong>Section C Notes</strong> if there are other
							matters to note on the certificate/priority 3 form assessment.
						</li>
						<li>
							Optionally fill out case-wide notes which are internal only and do
							not appear on the certificate.
						</li>
					</ol>
					<p className="text-sm text-muted-foreground">
						Tip: Each form produces one certificate. If you have more than 5
						bags, add a second form.
					</p>
					<p className="text-sm text-muted-foreground">
						Tip: You can click the step numbers at the top of the wizard to
						navigate directly to any completed step. The Back button at the
						bottom left will take you to the previous step (greyed out if you
						are already on step 1). Use these to review previously entered data
						without losing your progress.
					</p>
					<br />
					<img
						src="/assets/guide/create-drug.png"
						alt="Create case form"
						className="rounded-lg border shadow-sm"
					/>
				</section>

				<hr />

				{/* Certificate Generation */}
				<section>
					<h2>Generating Certificates</h2>
					<p>
						Once all bags are assessed, click <strong>Save and Continue</strong>{" "}
						to reach the Certificate step.
					</p>
					<ol>
						<li>
							Click <strong>Generate</strong> on each form card (or{" "}
							<strong>Generate All</strong>).
						</li>
						<li>Review the generated PDF for each form.</li>
						<li>
							Use <strong>Regenerate</strong> if you made changes and need a
							fresh version.
						</li>
						<li>
							Mark each form as <strong>Ready</strong> using the circular
							checkbox.
						</li>
						<li>
							Once all forms are marked ready, click{" "}
							<strong>Finalise Case</strong>.
						</li>
					</ol>
					<br />
					<img
						src="/assets/guide/generate-cert.png"
						alt="Create case form"
						className="rounded-lg border shadow-sm"
					/>
				</section>

				<hr />

				{/* Batching */}
				<section>
					<h2>Batching Cases</h2>
					<p>
						Finalised cases appear on the <strong>Cases</strong> page with a
						&quot;Batching&quot; state and a checkbox. To create a batch:
					</p>
					<ol>
						<li>Select one or more cases using the checkboxes.</li>
						<li>
							Click <strong>Create Batch</strong> (purple button at the top
							right of page).
						</li>
						<li>
							The batch calculates costs based on certificate and bag rates.
						</li>
						<li>
							Download the <strong>Package</strong> (ZIP containing certificate
							PDFs + cost summary). You can do this by clicking the entry for
							the batch and selecting "Download Package".
						</li>
						<li>
							When the invoice is raised externally, record the invoice number
							on the batch to mark it complete. You can do this by clicking the
							entry and selecting "Set Invoice Number"
						</li>
					</ol>
					<br />
					<img
						src="/assets/guide/batches-1.png"
						alt="Create case form"
						className="rounded-lg border shadow-sm"
					/>
					<br />
					<img
						src="/assets/guide/batches-2.png"
						alt="Create case form"
						className="rounded-lg border shadow-sm"
					/>
				</section>

				<hr />

				{/* Settings */}
				<section>
					<h2>Settings</h2>
					<p>
						The <strong>Settings</strong> page (accessible from the sidebar)
						lets you configure:
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
							<strong>Certificate Counter</strong> — the next certificate number
							to be assigned.
						</li>
					</ul>
					<br />
					<img
						src="/assets/guide/settings.png"
						alt="Create case form"
						className="rounded-lg border shadow-sm"
					/>
				</section>

				<hr />

				{/* Account & Navigation */}
				<section>
					<h2>Account Menu</h2>
					<p>
						At the bottom of the sidebar, you&apos;ll find your{" "}
						<strong>avatar</strong> (initials circle). Clicking it opens the
						account menu with the following options:
					</p>
					<ul>
						<li>
							<strong>Theme</strong> — Toggle between light mode, dark mode, or
							system default.
						</li>
						<li>
							<strong>Change Password</strong> — Update your account password.
							You&apos;ll need your current password to set a new one.
						</li>
						<li>
							<strong>Log Out</strong> — End your session and return to the
							login page.
						</li>
					</ul>
					<p className="text-sm text-muted-foreground">
						Tip: If you&apos;ve forgotten your password, use the &quot;Forgot
						Password&quot; link on the login page. An administrator can also
						send you a password reset email from the Staff page.
					</p>
				</section>

				<hr />

				{/* Tips */}
				<section>
					<h2>Tips</h2>
					<ul>
						<li>
							Use the <strong>Forms Navigator</strong> to switch between forms
							on a case.
						</li>
						<li>
							Forms with 0 bags are highlighted red — add bags before
							proceeding.
						</li>
						<li>
							The certificate preview updates in real-time as you add bags and
							fill in details.
						</li>
						<li>
							Section C notes are per-form (each certificate gets its own
							notes).
						</li>
						<li>
							Internal comments are shared across the case and are not shown on
							certificates.
						</li>
					</ul>
				</section>

				<hr />

				{/* Glossary */}
				<section>
					<h2>Glossary of Terms</h2>
					<p>A plain-language guide to the terms used throughout the system.</p>
					<dl className="space-y-3">
						<div>
							<dt className="font-semibold">Case</dt>
							<dd className="text-muted-foreground">
								The overall record for one police submission. A case ties
								together the officers, the defendant, the botanist, and one or
								more Priority 3 Forms.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Priority 3 Form</dt>
							<dd className="text-muted-foreground">
								A single certificate&apos;s worth of samples. Each form holds up
								to 5 drug bags and produces exactly one certificate. If you have
								more than 5 bags, add another form.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Drug Bag (Bag)</dt>
							<dd className="text-muted-foreground">
								One sealed drug movement bag, identified by its seal tag
								number(s). Each bag records its content type (e.g. plant) and
								the botanist&apos;s determination.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Seal Tag Number</dt>
							<dd className="text-muted-foreground">
								The tag number printed on the drug movement bag. &quot;Original
								Tag&quot; is the number it arrived with; &quot;New Tag&quot; is
								the number of the fresh bag it&apos;s resealed into after
								examination.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Determination</dt>
							<dd className="text-muted-foreground">
								The botanist&apos;s finding for a bag — for example, whether the
								material is cannabis and its species.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Content Type</dt>
							<dd className="text-muted-foreground">
								What the bag contains — for example plant, seed, or cutting.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Female Plants</dt>
							<dd className="text-muted-foreground">
								A tick on a bag indicating it contains female plants, as noted
								by the botanist. This can be referenced in Section C note
								templates.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Unsaved Bags</dt>
							<dd className="text-muted-foreground">
								Bags you&apos;ve typed in but not yet committed. They appear in
								a dashed amber box. Click <strong>Confirm</strong> on a bag (or{" "}
								<strong>Add All</strong>) to save them to the form.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Save and Continue</dt>
							<dd className="text-muted-foreground">
								Moves you to the next step of the case. It stays greyed out
								until the current step has all the information it needs — when
								everything is complete, each section shows a green tick and the
								button becomes active.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Conveying Officer (Submitting)</dt>
							<dd className="text-muted-foreground">
								The unsworn officer who physically delivered the samples to the
								laboratory.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">
								Requesting Officer (On Behalf Of)
							</dt>
							<dd className="text-muted-foreground">
								The sworn officer who made the seizure or arrest and requested
								the identification.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Approved Botanist</dt>
							<dd className="text-muted-foreground">
								The botanist assigned to examine the samples and sign the
								certificate. Only botanists approved under the Act appear here.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">
								Security Movement Envelope (SME)
							</dt>
							<dd className="text-muted-foreground">
								The envelope number recorded per form when subsamples are placed
								into a security movement envelope. Available for use in Section
								C note templates.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Section C Notes</dt>
							<dd className="text-muted-foreground">
								The &quot;other matters&quot; notes that appear on the
								certificate under Section C. These are specific to each form.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Template</dt>
							<dd className="text-muted-foreground">
								A reusable, generically-worded Section C note. Templates use
								building blocks (variables) that automatically fill in each
								form&apos;s specific data — so you never type case-specific
								details like tag numbers directly into a template.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Variable (Building Block)</dt>
							<dd className="text-muted-foreground">
								A placeholder in a template (e.g. seal tag numbers or SME
								number) that the system swaps for the real value from the
								current form when the certificate is generated.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Certificate</dt>
							<dd className="text-muted-foreground">
								The official PDF document produced for a form once its bags are
								assessed. The printed copy is signed by hand by the botanist.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Generate / Regenerate</dt>
							<dd className="text-muted-foreground">
								Generate creates the certificate PDF. Regenerate produces a
								fresh version after you&apos;ve made changes — available until
								the certificate is placed into a batch.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Ready</dt>
							<dd className="text-muted-foreground">
								A mark you place on a form to confirm its certificate has been
								reviewed and is ready to finalise.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Batch</dt>
							<dd className="text-muted-foreground">
								A group of finished certificates bundled together for invoicing
								and download. Creating a batch calculates the costs and produces
								a downloadable package.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Repackage</dt>
							<dd className="text-muted-foreground">
								Rebuilds a batch&apos;s download package with the latest data.
								Use this if you&apos;ve made template or certificate changes
								after a batch was created — it regenerates the certificate PDFs
								for you.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Legacy Botanist</dt>
							<dd className="text-muted-foreground">
								A botanist from historical records who is hidden from the
								selection dropdown to reduce clutter, while their past cases
								stay intact.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Defendant</dt>
							<dd className="text-muted-foreground">
								The person named on the submission. Recorded with surname (shown
								in capitals on the certificate) and given names.
							</dd>
						</div>
						<div>
							<dt className="font-semibold">Forms Navigator</dt>
							<dd className="text-muted-foreground">
								The row of form tabs at the top of the case wizard. Click a form
								to switch to it, or use the step numbers to move between stages.
							</dd>
						</div>
					</dl>
				</section>
			</article>
		</>
	);
};

export default Guide;
