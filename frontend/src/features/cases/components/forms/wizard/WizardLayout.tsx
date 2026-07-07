import { type ReactNode } from "react";
import { cn } from "@/shared/utils/style.utils";

interface WizardLayoutProps {
	formPanel: ReactNode;
	previewPanel: ReactNode;
	showPreview: boolean;
	/** When true, renders only the preview panel at full width (no form panel) */
	fullWidthPreview?: boolean;
}

/**
 * Responsive layout manager for form and preview panels.
 *
 * Layout modes:
 * - Full-width preview: Preview only, no form panel (used by certificate step)
 * - Ultra-wide (≥1920px): Side-by-side 50/50 split via CSS Grid
 * - Standard (<1920px): Single panel toggled between form and preview
 */
export const WizardLayout = ({
	formPanel,
	previewPanel,
	showPreview,
	fullWidthPreview = false,
}: WizardLayoutProps) => {
	// Full-width preview mode — no split, no toggle, just the preview
	if (fullWidthPreview) {
		return (
			<div className="h-full flex flex-col">
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-5xl mx-auto">{previewPanel}</div>
				</div>
			</div>
		);
	}

	// No preview panel — form takes full width at all breakpoints
	if (!previewPanel) {
		return (
			<div className="h-full flex flex-col">
				<div className="flex-1 overflow-y-auto">
					<div className="max-w-4xl mx-auto">{formPanel}</div>
				</div>
			</div>
		);
	}

	// Both panels available — responsive split
	return (
		<div className="h-full flex flex-col">
			<div className="flex-1 overflow-hidden">
				{/* Ultra-wide: Side-by-side layout */}
				<div className="hidden min-[1920px]:grid min-[1920px]:grid-cols-2 min-[1920px]:gap-8 h-full">
					<div className="overflow-y-auto pr-4">{formPanel}</div>
					<div className="overflow-y-auto pl-4 border-l">{previewPanel}</div>
				</div>

				{/* Standard: Toggle between form and preview */}
				<div className="min-[1920px]:hidden h-full overflow-y-auto">
					<div
						className={cn(
							"transition-opacity duration-300",
							showPreview ? "hidden" : "block"
						)}
					>
						<div className="max-w-4xl mx-auto">{formPanel}</div>
					</div>
					<div
						className={cn(
							"transition-opacity duration-300",
							showPreview ? "block" : "hidden"
						)}
					>
						<div className="max-w-4xl mx-auto">{previewPanel}</div>
					</div>
				</div>
			</div>
		</div>
	);
};
