/**
 * Whether a form's generated certificate no longer matches its underlying data.
 *
 * A certificate is stale when something it actually renders has changed since it
 * was generated:
 *
 *  - a bag, or its botanical assessment, was updated after the PDF was built
 *    (the "the bags changed after generating" case); or
 *  - the form's Section C "other matters" note no longer matches the note
 *    snapshotted onto the certificate at generation.
 *
 * Section C is compared by content, not by timestamp. The form's row timestamp
 * is deliberately NOT used: it is bumped by actions that do not change the
 * certificate — marking a form ready, phase advances, recording who last
 * actioned it — which previously flagged a freshly generated certificate as out
 * of date the moment it was marked ready, with no way to clear it.
 *
 * Only unbatched, actually-generated certificates are considered; a batched
 * certificate is frozen and a form with no generated PDF has nothing to be stale
 * against.
 */
import type { Priority3Form } from "@/shared/types/backend-api.types";

/** Normalise a note the way the backend does: trimmed, with empty becoming null. */
const normaliseNote = (value: string | null | undefined): string | null => {
	const trimmed = (value ?? "").trim();
	return trimmed === "" ? null : trimmed;
};

export const isFormStale = (form: Priority3Form): boolean => {
	const cert = form.certificate;
	if (!cert || cert.batch_id != null) return false;
	if (!(cert.pdf_url || cert.pdf_file)) return false;

	// Section C note edited after generation — the note is printed on the
	// certificate, which stores its own snapshot taken at generation.
	if (
		normaliseNote(form.additional_notes) !==
		normaliseNote(cert.additional_notes)
	) {
		return true;
	}

	const certTime = new Date(cert.updated_at).getTime();

	return (form.bags ?? []).some((bag) => {
		const bagTime = new Date(bag.updated_at).getTime();
		const assessmentTime = bag.assessment
			? new Date(bag.assessment.updated_at).getTime()
			: 0;
		return bagTime > certTime || assessmentTime > certTime;
	});
};
