import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/shared/hooks";
import { checkCaseNumberExists } from "../services/cases.service";

interface CaseNumberAvailability {
	/** True while the user is still typing (debouncing) or the check is in flight. */
	isChecking: boolean;
	/** True only when the latest completed check found the number on another case. */
	alreadyExists: boolean;
}

/**
 * Debounced uniqueness check for a case's police reference number.
 *
 * Calls the backend a short while after the user stops typing. Results are
 * cached/deduped by TanStack Query, so calling this hook in multiple components
 * with the same arguments issues only one request.
 *
 * @param caseNumber - the current police reference value
 * @param excludeId - a case id to ignore (when editing an existing case)
 */
export const useCaseNumberAvailability = (
	caseNumber: string,
	excludeId?: number | null
): CaseNumberAvailability => {
	const trimmed = (caseNumber ?? "").trim();
	const debounced = useDebounce(trimmed, 500);
	const enabled = debounced.length > 0;

	const query = useQuery({
		queryKey: ["cases", "check-number", debounced, excludeId ?? null],
		queryFn: () => checkCaseNumberExists(debounced, excludeId),
		enabled,
		staleTime: 30_000,
	});

	// Still settling if the debounced value hasn't caught up, or a request is live
	const isDebouncing = trimmed !== debounced;
	const isChecking = trimmed.length > 0 && (isDebouncing || query.isFetching);

	const alreadyExists = enabled && !isChecking && query.data === true;

	return { isChecking, alreadyExists };
};
