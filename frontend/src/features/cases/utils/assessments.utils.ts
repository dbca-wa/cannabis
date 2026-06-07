/**
 * Get determination colour class for UI display.
 */
export const getDeterminationColorClass = (
	determination: string,
	isDark: boolean = false
): string => {
	const colorMap: Record<string, { light: string; dark: string }> = {
		pending: { light: "text-gray-600", dark: "text-gray-400" },
		cannabis_sativa: { light: "text-green-600", dark: "text-green-400" },
		cannabis_indica: { light: "text-green-600", dark: "text-green-400" },
		cannabis_hybrid: { light: "text-green-600", dark: "text-green-400" },
		mixed: { light: "text-green-600", dark: "text-green-400" },
		papaver_somniferum: { light: "text-red-600", dark: "text-red-400" },
		degraded: { light: "text-yellow-600", dark: "text-yellow-400" },
		not_cannabis: { light: "text-blue-600", dark: "text-blue-400" },
		unidentifiable: { light: "text-gray-600", dark: "text-gray-400" },
		inconclusive: { light: "text-orange-600", dark: "text-orange-400" },
	};

	const colors = colorMap[determination];
	if (!colors) return isDark ? "text-gray-400" : "text-gray-600";

	return isDark ? colors.dark : colors.light;
};

/**
 * Get determination badge class for UI display.
 */
export const getDeterminationBadgeClass = (determination: string): string => {
	const badgeMap: Record<string, string> = {
		pending: "bg-gray-100 text-gray-800",
		cannabis_sativa: "bg-green-100 text-green-800",
		cannabis_indica: "bg-green-100 text-green-800",
		cannabis_hybrid: "bg-green-100 text-green-800",
		mixed: "bg-green-100 text-green-800",
		papaver_somniferum: "bg-red-100 text-red-800",
		degraded: "bg-yellow-100 text-yellow-800",
		not_cannabis: "bg-blue-100 text-blue-800",
		unidentifiable: "bg-gray-100 text-gray-800",
		inconclusive: "bg-orange-100 text-orange-800",
	};

	return badgeMap[determination] || "bg-gray-100 text-gray-800";
};

/**
 * Check if determination indicates cannabis.
 */
export const isCannabis = (determination: string): boolean => {
	const cannabisTypes = [
		"cannabis_sativa",
		"cannabis_indica",
		"cannabis_hybrid",
		"mixed",
	];
	return cannabisTypes.includes(determination);
};

/**
 * Check if determination indicates a controlled substance.
 */
export const isControlledSubstance = (determination: string): boolean => {
	const controlledSubstances = [
		"cannabis_sativa",
		"cannabis_indica",
		"cannabis_hybrid",
		"mixed",
		"papaver_somniferum",
	];
	return controlledSubstances.includes(determination);
};
