/**
 * Navigation state asking the layout to keep the reader's scroll position.
 *
 * The layout scrolls back to the top whenever the address changes, so a new
 * page always starts at the top. Some address changes stay on the same page,
 * such as switching or adding a form on a case. Pass
 * `keepScrollState("/cases/12")` as the navigation state for those: the
 * position is kept when the previous address was within that path, and reset
 * as usual otherwise (for example on Back from another page).
 */
export const keepScrollState = (within: string) => ({
	keepScrollWithin: within,
});

const isWithin = (pathname: string, base: string): boolean =>
	pathname === base || pathname.startsWith(`${base}/`);

/** Whether to keep the scroll position when moving to a location. */
export const shouldKeepScroll = (
	state: unknown,
	previousPathname: string | null
): boolean => {
	if (previousPathname === null) return false;
	if (typeof state !== "object" || state === null) return false;
	if (!("keepScrollWithin" in state)) return false;
	const within = state.keepScrollWithin;
	return typeof within === "string" && isWithin(previousPathname, within);
};
