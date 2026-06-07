import type { DrugBag } from "@/shared/types/backend-api.types";

/**
 * Format drug bag display name for UI.
 */
export const formatDrugBagDisplayName = (drugBag: DrugBag): string => {
	return `${drugBag.seal_tag_numbers} - ${drugBag.content_type_display}`;
};

/**
 * Get content type colour class for UI display.
 */
export const getContentTypeColorClass = (
	contentType: string,
	isDark: boolean = false
): string => {
	const colorMap: Record<string, { light: string; dark: string }> = {
		plant: { light: "text-green-600", dark: "text-green-400" },
		plant_material: { light: "text-green-600", dark: "text-green-400" },
		cutting: { light: "text-emerald-600", dark: "text-emerald-400" },
		seed: { light: "text-yellow-600", dark: "text-yellow-400" },
		seed_material: { light: "text-yellow-600", dark: "text-yellow-400" },
		poppy: { light: "text-red-600", dark: "text-red-400" },
		poppy_plant: { light: "text-red-600", dark: "text-red-400" },
		unknown: { light: "text-gray-600", dark: "text-gray-400" },
		unsure: { light: "text-gray-600", dark: "text-gray-400" },
	};

	const colors = colorMap[contentType];
	if (!colors) return isDark ? "text-gray-400" : "text-gray-600";

	return isDark ? colors.dark : colors.light;
};

/**
 * Get content type badge class for UI display.
 */
export const getContentTypeBadgeClass = (contentType: string): string => {
	const badgeMap: Record<string, string> = {
		plant: "bg-green-100 text-green-800",
		plant_material: "bg-green-100 text-green-800",
		cutting: "bg-emerald-100 text-emerald-800",
		seed: "bg-yellow-100 text-yellow-800",
		seed_material: "bg-yellow-100 text-yellow-800",
		poppy: "bg-red-100 text-red-800",
		poppy_plant: "bg-red-100 text-red-800",
		unknown: "bg-gray-100 text-gray-800",
		unsure: "bg-gray-100 text-gray-800",
	};

	return badgeMap[contentType] || "bg-gray-100 text-gray-800";
};
