/**
 * Whether a form's generated certificate no longer matches its underlying data.
 *
 * A certificate is stale when a bag, or its botanical assessment, was changed
 * after the PDF was generated — the "the bags changed after generating" case.
 * Those are the only live inputs the rendered certificate reads; the Section C
 * notes are snapshotted onto the certificate at generation, and the case-level
 * fields (officers, defendants, dates) are not treated as staleness triggers
 * here.
 *
 * The form's own row timestamp is deliberately NOT used: it is bumped by actions
 * that do not change the certificate — marking a form ready, phase advances,
 * recording who last actioned it — which previously flagged a freshly generated
 * certificate as out of date the moment it was marked ready, with no way to
 * clear it.
 *
 * Only unbatched, actually-generated certificates are considered; a batched
 * certificate is frozen and a form with no generated PDF has nothing to be stale
 * against.
 */
import type { Priority3Form } from "@/shared/types/backend-api.types";

export const isFormStale = (form: Priority3Form): boolean => {
	const cert = form.certificate;
	if (!cert || cert.batch_id != null) return false;
	if (!(cert.pdf_url || cert.pdf_file)) return false;

	const certTime = new Date(cert.updated_at).getTime();

	return (form.bags ?? []).some((bag) => {
		const bagTime = new Date(bag.updated_at).getTime();
		const assessmentTime = bag.assessment
			? new Date(bag.assessment.updated_at).getTime()
			: 0;
		return bagTime > certTime || assessmentTime > certTime;
	});
};
