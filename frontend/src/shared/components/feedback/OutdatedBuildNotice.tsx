import { useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useDeployedVersion } from "@/shared/hooks/useDeployedVersion";

/**
 * Tells the user when this tab is running an older build than the one deployed,
 * and offers a cache-bypassing reload.
 *
 * A tab running superseded code can fail to show data that has genuinely saved,
 * which is indistinguishable from the application losing the data. Saying so
 * removes the guesswork.
 */
export const OutdatedBuildNotice = () => {
	const { isOutdated, reload } = useDeployedVersion();
	const [dismissed, setDismissed] = useState(false);

	if (!isOutdated || dismissed) return null;

	return (
		<div
			role="status"
			aria-live="polite"
			className="fixed bottom-4 left-1/2 z-50 w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-lg dark:border-amber-700 dark:bg-amber-950"
		>
			<div className="flex items-start gap-3">
				<RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
				<div className="min-w-0 flex-1">
					<p className="text-sm font-medium text-amber-900 dark:text-amber-100">
						A newer version of this application is available
					</p>
					<p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
						This tab is running an older version, which can stop recent changes
						from appearing. Reload to get the current version.
					</p>
					<div className="mt-3 flex items-center gap-2">
						<Button size="sm" onClick={reload}>
							Reload now
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setDismissed(true)}
						>
							Not now
						</Button>
					</div>
				</div>
				<Button
					size="icon"
					variant="ghost"
					className="h-7 w-7 shrink-0"
					onClick={() => setDismissed(true)}
					aria-label="Dismiss update notice"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
};
