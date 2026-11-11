/**
 * Pages whose data has no practice copy. Practice mode isolates cases,
 * batches, officers, stations and defendants, but settings, templates, staff
 * accounts and invitations are always real, so the server refuses changes to
 * them while practice mode is on.
 */
const SHARED_DATA_PREFIXES = ["/settings", "/staff", "/invites", "/testing"];

/** Whether the page at this path shows real, shared data even in practice mode. */
export const isSharedDataPage = (pathname: string): boolean =>
	SHARED_DATA_PREFIXES.some(
		(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
	);
