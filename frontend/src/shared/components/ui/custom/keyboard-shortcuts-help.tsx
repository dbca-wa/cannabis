import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../dialog";
import { Badge } from "../badge";
import { Keyboard } from "lucide-react";
import {
	type KeyboardShortcut,
	formatShortcut,
} from "@/shared/hooks/ui/useKeyboardShortcuts";

export interface KeyboardShortcutsHelpProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	shortcuts: KeyboardShortcut[];
	title?: string;
	description?: string;
}

// Help dialog showing available keyboard shortcuts
export function KeyboardShortcutsHelp({
	open,
	onOpenChange,
	shortcuts,
	title = "Keyboard Shortcuts",
	description = "Use these keyboard shortcuts to navigate and interact with the application more efficiently.",
}: KeyboardShortcutsHelpProps) {
	// Group shortcuts by category (based on description prefix)
	const groupedShortcuts = shortcuts
		.filter((s) => s.description && !s.disabled)
		.reduce((groups, shortcut) => {
			// Extract category from description (e.g., "Navigation: Go to home" -> "Navigation")
			const description = shortcut.description!;
			const colonIndex = description.indexOf(":");
			const category =
				colonIndex > 0
					? description.substring(0, colonIndex)
					: "General";
			const cleanDescription =
				colonIndex > 0
					? description.substring(colonIndex + 1).trim()
					: description;

			if (!groups[category]) {
				groups[category] = [];
			}

			groups[category].push({
				keys: formatShortcut(shortcut),
				description: cleanDescription,
			});

			return groups;
		}, {} as Record<string, Array<{ keys: string; description: string }>>);

	const categories = Object.keys(groupedShortcuts).sort();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Keyboard className="h-5 w-5" />
						{title}
					</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{categories.map((category) => (
						<div key={category}>
							<h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
								{category}
							</h3>
							<div className="space-y-2">
								{groupedShortcuts[category].map(
									(shortcut, index) => (
										<div
											key={index}
											className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
										>
											<span className="text-sm text-gray-700 dark:text-gray-300">
												{shortcut.description}
											</span>
											<Badge
												variant="secondary"
												className="font-mono text-xs bg-white dark:bg-gray-700 border"
											>
												{shortcut.keys}
											</Badge>
										</div>
									)
								)}
							</div>
						</div>
					))}

					{categories.length === 0 && (
						<div className="text-center py-8 text-gray-500 dark:text-gray-400">
							<Keyboard className="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>
								No keyboard shortcuts available for this page.
							</p>
						</div>
					)}
				</div>

				<div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
					<div className="text-xs text-gray-500 dark:text-gray-400 text-center">
						Press{" "}
						<Badge variant="outline" className="font-mono text-xs">
							Esc
						</Badge>{" "}
						to close this dialog
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// Trigger button for keyboard shortcuts help
export function KeyboardShortcutsHelpTrigger({
	onClick,
	className,
}: {
	onClick: () => void;
	className?: string;
}) {
	return (
		<button
			onClick={onClick}
			className={`inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors ${className}`}
			title="Show keyboard shortcuts (Shift + ?)"
		>
			<Keyboard className="h-3 w-3" />
			<span>Shortcuts</span>
		</button>
	);
}
