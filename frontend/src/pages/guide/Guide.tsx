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
							matters to note on the certificate/priorty 3 form assessment.
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
			</article>
		</>
	);
};

export default Guide;
