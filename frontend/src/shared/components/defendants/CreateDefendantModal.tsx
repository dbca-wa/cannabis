/**
 * Re-export of CreateDefendantModal for cross-feature consumption.
 *
 * The implementation lives in the defendants feature (where its internal hooks reside),
 * but is re-exported here because it's used by multiple features.
 */
export { CreateDefendantModal } from "@/features/defendants/components/CreateDefendantModal";
