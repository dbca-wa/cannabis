/**
 * Axe-core test utilities for accessibility testing.
 *
 * Configures axe-core for WCAG 2.2 Level AA compliance, matching the project's
 * accessibility target.
 */

import { configureAxe, type JestAxeConfigureOptions } from "jest-axe";
import type { RunOptions } from "axe-core";

/** WCAG 2.2 Level AA rule configuration for axe-core. */
export const WCAG_22_AA_CONFIG: RunOptions = {
	runOnly: {
		type: "tag",
		values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"],
	},
};

/** Axe runner configured for WCAG 2.2 Level AA. */
export const axe = configureAxe({
	...WCAG_22_AA_CONFIG,
	resultTypes: ["violations"],
} as JestAxeConfigureOptions);
