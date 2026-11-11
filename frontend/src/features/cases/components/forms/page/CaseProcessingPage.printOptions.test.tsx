/**
 * Case processing page: the certificate print options and the live preview.
 *
 * Renders the real case details section and certificate preview, with the
 * officer search and other data-heavy controls stubbed. A harness feeds each
 * option change back into the case data, as the processing page does after a
 * save, so the preview can be checked against what the PDF will print.
 */
import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import type { Priority3Form } from "@/shared/types/backend-api.types";

vi.mock("../wizard/steps/AssessmentStep", () => ({
	AssessmentStep: () => <div data-testid="assessment-section" />,
}));
vi.mock("../wizard/steps/UnsignedCertificateStep", () => ({
	UnsignedCertificateStep: () => <div data-testid="certificates-section" />,
}));
vi.mock("../FormsNavigator", () => ({
	FormsNavigator: () => <div data-testid="forms-navigator" />,
}));
vi.mock("../wizard/FormPreviewToggle", () => ({
	FormPreviewToggle: () => <div data-testid="preview-toggle" />,
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => ({ isAdmin: true }),
}));
vi.mock("@/shared/components/police", () => ({
	OfficerSearchComboBox: () => <div data-testid="officer-search" />,
	StationSearchComboBox: () => <div data-testid="station-search" />,
}));
vi.mock("@/shared/components/defendants", () => ({
	DefendantSearchCombobox: () => <div data-testid="defendant-search" />,
	CreateDefendantModal: () => null,
}));
vi.mock("@/features/user/components/forms/UserSearchCombobox", () => ({
	UserSearchCombobox: () => <div data-testid="user-search" />,
}));
vi.mock("@/features/defendants/hooks/useDefendants", () => ({
	useDefendantById: () => ({ data: undefined }),
}));
vi.mock("../ocr/CasePoliceFormUpload", () => ({
	CasePoliceFormUpload: () => null,
}));

interface OfficerRecord {
	id: number;
	badge_number: string;
	given_names: string;
	last_name: string;
	rank: string;
	rank_display: string;
	station: number | null;
	station_details: { id: number; name: string } | null;
}

const OFFICERS: Record<number, OfficerRecord> = {
	1: {
		id: 1,
		badge_number: "PD56359",
		given_names: "Jade",
		last_name: "Rinaldi",
		rank: "senior_constable",
		rank_display: "Senior Constable",
		station: 7,
		station_details: { id: 7, name: "Midland Drug Receival Unit" },
	},
	2: {
		id: 2,
		badge_number: "PD17432",
		given_names: "Tahlia",
		last_name: "Barns",
		rank: "senior_constable",
		rank_display: "Senior Constable",
		station: 8,
		station_details: { id: 8, name: "Mandurah District Office" },
	},
	3: {
		id: 3,
		badge_number: "PD99999",
		given_names: "Sam",
		last_name: "Lee",
		rank: "sworn_officer",
		rank_display: "Sworn Officer",
		station: null,
		station_details: null,
	},
};

vi.mock("@/features/police/hooks", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/features/police/hooks")>()),
	useOfficerById: (id: number | null) => ({
		data: id ? OFFICERS[id] : undefined,
	}),
}));

const { CaseProcessingPage } = await import("./CaseProcessingPage");

const details = (officer: OfficerRecord) => ({
	rank: officer.rank,
	rank_display: officer.rank_display,
	badge_number: officer.badge_number,
	given_names: officer.given_names,
	last_name: officer.last_name,
	station_name: officer.station_details?.name ?? null,
});

const caseData = (conveying: number, requesting: number | null) => ({
	id: 1,
	formId: 10,
	case_number: "IR 123456789",
	received: "2026-03-20T09:00:00Z",
	submitting_officer_id: conveying,
	submitting_officer_details: details(OFFICERS[conveying]),
	requesting_officer_id: requesting,
	requesting_officer_details: requesting ? details(OFFICERS[requesting]) : {},
	approved_botanist_id: 2,
	defendants: [],
	defendants_details: [],
	print_conveying_station: true,
	print_requesting_station: true,
	print_requesting_rank: false,
	bags: [
		{
			id: 1,
			seal_tag_numbers: "T1",
			new_seal_tag_numbers: "N1",
			content_type_display: "Plant",
			assessment: { determination: "cannabis_sativa" },
		},
		{
			id: 2,
			seal_tag_numbers: "T2",
			new_seal_tag_numbers: "N2",
			content_type_display: "Plant",
			assessment: { determination: "inconclusive" },
		},
	],
	additional_notes: "",
	phase: "assessment",
});

const forms = [
	{ id: 10, bags: [], certificate: null },
] as unknown as Priority3Form[];

/** Holds the case data and applies each field change, as a save would. */
const Harness = ({ initial }: { initial: Record<string, unknown> }) => {
	const [data, setData] = useState(initial);
	return (
		<CaseProcessingPage
			caseData={data}
			caseId={1}
			activeFormId={10}
			forms={forms}
			onFieldChange={(field, value) =>
				setData((prev) => ({ ...prev, [field]: value }))
			}
			onSubmit={vi.fn()}
			onDiscard={vi.fn()}
			onDelete={vi.fn()}
		/>
	);
};

const previewText = () =>
	(document.body.textContent ?? "").replace(/\s+/g, " ");

describe("CaseProcessingPage — certificate print options", () => {
	it("labels each option with what it will print", () => {
		renderPage(<Harness initial={caseData(1, 2)} />);

		expect(
			screen.getByRole("checkbox", {
				name: "Print station on the certificate (Midland Drug Receival Unit)",
			})
		).toBeChecked();
		expect(
			screen.getByRole("checkbox", {
				name: "Print station on the certificate (Mandurah District Office)",
			})
		).toBeChecked();
		expect(
			screen.getByRole("checkbox", {
				name: "Print rank instead of Sworn Officer (Senior Constable)",
			})
		).not.toBeChecked();
	});

	it("prints both stations and the Sworn/Unsworn labels by default", () => {
		renderPage(<Harness initial={caseData(1, 2)} />);

		expect(previewText()).toContain(
			"from Unsworn Officer PD56359 RINALDI, Jade of Midland Drug Receival Unit " +
				"on behalf of Sworn Officer PD17432 BARNS, Tahlia of Mandurah District Office"
		);
	});

	it("updates the preview when an option changes", async () => {
		const user = userEvent.setup();
		renderPage(<Harness initial={caseData(1, 2)} />);

		await user.click(
			screen.getByRole("checkbox", {
				name: "Print station on the certificate (Midland Drug Receival Unit)",
			})
		);
		await user.click(
			screen.getByRole("checkbox", {
				name: "Print rank instead of Sworn Officer (Senior Constable)",
			})
		);

		const text = previewText();
		expect(text).toContain(
			"from Unsworn Officer PD56359 RINALDI, Jade on behalf of " +
				"Senior Constable PD17432 BARNS, Tahlia of Mandurah District Office"
		);
		expect(text).not.toContain("RINALDI, Jade of Midland");
	});

	it("disables options the officer's record cannot satisfy", () => {
		renderPage(<Harness initial={caseData(1, 3)} />);

		const station = screen.getByRole("checkbox", {
			name: "No station on record, so none prints",
		});
		const rank = screen.getByRole("checkbox", {
			name: "No rank on record, so Sworn Officer prints",
		});
		expect(station).toBeDisabled();
		expect(rank).toBeDisabled();
		expect(previewText()).toContain(
			"on behalf of Sworn Officer PD99999 LEE, Sam on"
		);
	});

	it("hides the requesting officer's options when there is none", () => {
		renderPage(<Harness initial={caseData(1, null)} />);

		expect(
			screen.queryByRole("checkbox", { name: /print rank/i })
		).not.toBeInTheDocument();
		expect(screen.getAllByRole("checkbox")).toHaveLength(1);
		// Section (a) names only the conveying officer.
		expect(previewText()).toContain(
			"from Unsworn Officer PD56359 RINALDI, Jade of Midland Drug Receival Unit on 20 March 2026."
		);
	});

	it("shows Section B and the automatic Section C line for mixed results", () => {
		renderPage(<Harness initial={caseData(1, 2)} />);

		const text = previewText();
		expect(text).toContain("I identified the items as Cannabis sativa.");
		expect(text).toContain("Bag T2 was inconclusive.");
	});

	it("has no accessibility violations across the case details", async () => {
		const { container } = renderPage(<Harness initial={caseData(1, 3)} />);

		const details = container.querySelector("section#details");
		expect(details).not.toBeNull();
		expect(await testAccessibility(details!)).toHaveNoViolations();
	});

	it.each([
		["available options", 2],
		["disabled options", 3],
	])("has no accessibility violations with %s", async (_name, requesting) => {
		renderPage(<Harness initial={caseData(1, requesting)} />);

		for (const id of ["summary-conveying", "summary-requesting"]) {
			const options = screen.getByTestId(`${id}-print-options`);
			expect(within(options).getAllByRole("checkbox").length).toBeGreaterThan(
				0
			);
			const results = await testAccessibility(options);
			expect(results).toHaveNoViolations();
		}
	});
});
