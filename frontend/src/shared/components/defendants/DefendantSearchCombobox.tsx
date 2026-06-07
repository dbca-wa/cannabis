/**
 * Re-export of DefendantSearchCombobox for cross-feature consumption.
 *
 * The implementation lives in the defendants feature (where its internal hooks reside),
 * but is re-exported here because it's used by multiple features.
 */
export { DefendantSearchCombobox } from "@/features/defendants/components/DefendantSearchCombobox";
