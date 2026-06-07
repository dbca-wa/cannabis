/**
 * Re-export of OfficerSearchComboBox for cross-feature consumption.
 *
 * The implementation lives in the police feature (where its internal hooks reside),
 * but is re-exported here because it's used by multiple features.
 */
export { OfficerSearchComboBox } from "@/features/police/components/officers/OfficerSearchComboBox";
