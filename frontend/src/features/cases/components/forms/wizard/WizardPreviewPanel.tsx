/**
 * WizardPreviewPanel — live certificate preview.
 *
 * Renders one certificate document per certificate group (max 5 bags each),
 * mirroring the backend certificate_template.html: a serif header with the rest
 * in Aptos, and the certified date shown as it will appear once generated.
 * Groups come from the CertificateGroupingStore (auto-chunked by five before it
 * is seeded). Where there is more than one certificate, a navigator pages
 * between them and stays in sync with the highlighted drug-bag group.
 */

import { observer } from "mobx-react-lite";
import { useCertificateGroupingStore } from "@/app/providers/store.provider";
import { CertificateDocument, type CaseDataBag } from "./CertificateDocument";
import { CertificateNavigator } from "./CertificateNavigator";
import type { CertGroup } from "@/app/stores/derived/certificate-grouping.store";

// Semi-Aptos: serif header, Aptos body — matches the generated certificate.
const FONTS = {
	body: "'Aptos', 'Calibri', 'Segoe UI', sans-serif",
	header: "Times, 'Times New Roman', serif",
};

const MAX_BAGS = 5;

interface WizardPreviewPanelProps {
	caseData: Record<string, unknown> | null;
}

interface PreviewGroup {
	bags: CaseDataBag[];
	notes: string;
}

/** Build certificate groups (bags + notes) from the grouping store, falling
 * back to auto-chunking by five when the store has not been seeded. */
const buildBagGroups = (
	savedBags: CaseDataBag[],
	storeGroups: CertGroup[]
): PreviewGroup[] => {
	if (storeGroups.length > 0) {
		const byId = new Map(savedBags.map((b) => [b.id as number, b]));
		const groups: PreviewGroup[] = storeGroups
			.map((g) => ({
				bags: g.bagIds
					.map((id) => byId.get(id))
					.filter(Boolean) as CaseDataBag[],
				notes: g.notes,
			}))
			.filter((g) => g.bags.length > 0);
		const grouped = new Set(storeGroups.flatMap((g) => g.bagIds));
		const leftovers = savedBags.filter((b) => !grouped.has(b.id as number));
		for (let i = 0; i < leftovers.length; i += MAX_BAGS) {
			groups.push({ bags: leftovers.slice(i, i + MAX_BAGS), notes: "" });
		}
		return groups.length > 0 ? groups : [{ bags: [], notes: "" }];
	}
	const groups: PreviewGroup[] = [];
	for (let i = 0; i < savedBags.length; i += MAX_BAGS) {
		groups.push({ bags: savedBags.slice(i, i + MAX_BAGS), notes: "" });
	}
	return groups.length > 0 ? groups : [{ bags: [], notes: "" }];
};

export const WizardPreviewPanel = observer(function WizardPreviewPanel({
	caseData,
}: WizardPreviewPanelProps) {
	const grouping = useCertificateGroupingStore();

	if (!caseData) {
		return (
			<div
				className="text-center text-muted-foreground p-8"
				style={{ fontFamily: FONTS.body }}
			>
				No case data available for preview.
			</div>
		);
	}

	const allBags = (caseData.bags as CaseDataBag[]) ?? [];
	const savedBags = allBags.filter((b) => typeof b.id === "number");
	const groups = buildBagGroups(savedBags, grouping.state.groups);

	const safeActive = Math.min(
		Math.max(grouping.state.activeIndex, 0),
		groups.length - 1
	);
	const activeGroup = groups[safeActive];
	// The preview reflects the generated certificate, which is dated today.
	const today = new Date().toISOString();

	return (
		<div className="flex flex-col items-center">
			<CertificateDocument
				caseData={caseData}
				bags={activeGroup.bags}
				fonts={FONTS}
				certifiedDate={today}
				notes={activeGroup.notes}
			/>

			{groups.length > 1 && (
				<div className="mt-4">
					<CertificateNavigator
						count={groups.length}
						activeIndex={safeActive}
						onChange={(i) => grouping.setActiveIndex(i)}
					/>
				</div>
			)}
		</div>
	);
});
