/**
 * Whether a form's generated certificate no longer matches its underlying data.
 *
 * A certificate is stale when anything that feeds it was changed after the PDF
 * was generated: the form itself (its Security Movement Envelope or Section C
 * notes), or a bag (or its botanical assessment). All appear on the certificate,
 * so any of them changing means the PDF on screen is out of date and should be
 * regenerated. Only unbatched, actually-generated certificates are considered;
 * a batched certificate is frozen and a form with no generated PDF has nothing
 * to be stale against.
 */
import type { Priority3Form } from "@/shared/types/backend-api.types";

export const isFormStale = (form: Priority3Form): boolean => {
	const cert = form.certificate;
	if (!cert || cert.batch_id != null) return false;
	if (!(cert.pdf_url || cert.pdf_file)) return false;

	const certTime = new Date(cert.updated_at).getTime();

	// The form's own fields (SME, Section C notes) are on the certificate too.
	if (form.updated_at && new Date(form.updated_at).getTime() > certTime) {
		return true;
	}

	return (form.bags ?? []).some((bag) => {
		const bagTime = new Date(bag.updated_at).getTime();
		const assessmentTime = bag.assessment
			? new Date(bag.assessment.updated_at).getTime()
			: 0;
		return bagTime > certTime || assessmentTime > certTime;
	});
};
