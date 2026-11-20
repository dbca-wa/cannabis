import { useEffect } from "react";
import { useSearchParams } from "react-router";

/**
 * Apply record ids passed in the address to a list's filters, once.
 *
 * The "View cases" and "View officers" buttons on an officer, station or
 * defendant link to e.g. /cases?officer=12. The ids are handed to `apply`
 * and then removed from the address, so a reload or the back button does
 * not keep re-applying them over the user's own filters. Anything that is
 * not a positive whole number is ignored.
 */
export const useLinkedFilters = <K extends string>(
	keys: readonly K[],
	apply: (ids: Partial<Record<K, number>>) => void
): void => {
	const [searchParams, setSearchParams] = useSearchParams();

	useEffect(() => {
		const present = keys.filter((key) => searchParams.has(key));
		if (present.length === 0) return;
		const ids: Partial<Record<K, number>> = {};
		for (const key of present) {
			const id = Number(searchParams.get(key));
			if (Number.isInteger(id) && id > 0) ids[key] = id;
		}
		const next = new URLSearchParams(searchParams);
		present.forEach((key) => next.delete(key));
		setSearchParams(next, { replace: true });
		if (Object.keys(ids).length > 0) apply(ids);
		// Runs when the address changes; `keys` and `apply` are fixed per page.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchParams]);
};
