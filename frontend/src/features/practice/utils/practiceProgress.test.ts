import { describe, it, expect } from "vitest";
import {
	buildCaseChecklist,
	buildFormChecklists,
	buildCertificateChecklists,
	buildBatchChecklist,
	isCaseChecklistComplete,
	areFormChecklistsComplete,
	type LiveCase,
} from "./practiceProgress";
import type { IPracticeBrief } from "../types/practice.types";

const brief: IPracticeBrief = {
	label: "t",
	case_number: "PRACTICE-480021",
	officer: {
		rank_display: "Senior Constable",
		badge_number: "PD1",
		given_names: "Alex",
		last_name: "Turner",
		station: "Fremantle",
	},
	station: "Fremantle",
	defendant: { given_names: "Chris", last_name: "Nguyen" },
	forms: [
		{
			security_movement_envelope: "SME100",
			bags: [
				{
					original_seal: "T10041",
					new_seal: "N20041",
					content_type: "plant",
					determination: "cannabis_sativa",
					female_plants: true,
				},
			],
		},
	],
};

describe("buildCaseChecklist", () => {
	it("marks nothing done for an empty case", () => {
		const group = buildCaseChecklist(brief, null);
		expect(group.items.every((i) => !i.done)).toBe(true);
	});

	it("ticks the police reference once it matches", () => {
		const live: LiveCase = { case_number: "PRACTICE-480021" };
		const group = buildCaseChecklist(brief, live);
		const ref = group.items.find((i) => i.label === "Police reference");
		expect(ref?.done).toBe(true);
	});

	it("ticks the defendant, officer and station on a loose match", () => {
		const live: LiveCase = {
			defendant_names: ["NGUYEN, Chris"],
			submitting_officer: 5,
			submitting_officer_name: "Alex Turner",
			station: 2,
			station_name: "Fremantle Police Station",
		};
		const group = buildCaseChecklist(brief, live);
		const done = Object.fromEntries(group.items.map((i) => [i.label, i.done]));
		expect(done["Defendant"]).toBe(true);
		expect(done["Submitting officer"]).toBe(true);
		expect(done["Station"]).toBe(true);
	});

	it("ticks officer, station and defendant from the detail serializer shape", () => {
		// The case-detail serializer (process-case page) nests names under
		// *_details rather than exposing flat *_name fields. The checklist must
		// stay ticked after the case is saved and the guide reads detail data.
		const live: LiveCase = {
			case_number: "PRACTICE-480021",
			submitting_officer: 5,
			submitting_officer_details: { full_name: "Alex Turner" },
			station: 2,
			station_details: { name: "Fremantle" },
			defendants_details: [{ full_name: "NGUYEN, Chris" }],
		};
		const group = buildCaseChecklist(brief, live);
		const done = Object.fromEntries(group.items.map((i) => [i.label, i.done]));
		expect(done["Police reference"]).toBe(true);
		expect(done["Defendant"]).toBe(true);
		expect(done["Submitting officer"]).toBe(true);
		expect(done["Station"]).toBe(true);
	});

	it("leaves officer and station unticked when only ids are present", () => {
		// Reproduces the reported bug: the create flow had set the officer/station
		// ids but not their display names, so the guide could not match them.
		const live: LiveCase = {
			submitting_officer: 5,
			submitting_officer_name: null,
			station: 2,
			station_name: null,
		};
		const group = buildCaseChecklist(brief, live);
		const done = Object.fromEntries(group.items.map((i) => [i.label, i.done]));
		expect(done["Submitting officer"]).toBe(false);
		expect(done["Station"]).toBe(false);
	});

	it("ticks the botanist once one is set (the default)", () => {
		const group = buildCaseChecklist(brief, { approved_botanist: 9 });
		const bot = group.items.find((i) =>
			i.label.startsWith("Approved botanist")
		);
		expect(bot?.done).toBe(true);
	});
});

describe("buildFormChecklists", () => {
	it("includes an 'Add a Priority 3 form' item that ticks when a form exists", () => {
		const empty = buildFormChecklists(brief, []);
		const addItem = empty[0].items.find((i) =>
			i.label.includes("Add a Priority 3 form")
		);
		expect(addItem?.done).toBe(false);

		const withForm = buildFormChecklists(brief, [{ bags: [] }]);
		expect(
			withForm[0].items.find((i) => i.label.includes("Add a Priority 3 form"))
				?.done
		).toBe(true);
	});

	// A fully-correct live bag matching the brief's single bag.
	const correctBag = {
		seal_tag_numbers: "T10041",
		new_seal_tag_numbers: "N20041",
		content_type: "plant",
		contains_female_plants: true,
		assessment: { determination: "cannabis_sativa" },
	};

	it("labels a bag 'Add Bag' with both the original and new seal tags", () => {
		const groups = buildFormChecklists(brief, []);
		const bag = groups[0].items.find((i) => i.label.startsWith("Add Bag"));
		expect(bag?.label).toContain("original T10041");
		expect(bag?.label).toContain("new N20041");
	});

	it("ticks the SME and a bag once every detail matches the brief", () => {
		const live = [
			{ security_movement_envelope: "SME100", bags: [{ ...correctBag }] },
		];
		const groups = buildFormChecklists(brief, live);
		const items = groups[0].items;
		expect(items.find((i) => i.label.includes("envelope"))?.done).toBe(true);
		expect(items.find((i) => i.label.startsWith("Add Bag"))?.done).toBe(true);
	});

	it("leaves a bag unticked when the content type is wrong", () => {
		const live = [{ bags: [{ ...correctBag, content_type: "seed" }] }];
		const groups = buildFormChecklists(brief, live);
		expect(
			groups[0].items.find((i) => i.label.startsWith("Add Bag"))?.done
		).toBe(false);
	});

	it("leaves a bag unticked when the determination is wrong", () => {
		const live = [
			{
				bags: [
					{ ...correctBag, assessment: { determination: "not_cannabis" } },
				],
			},
		];
		const groups = buildFormChecklists(brief, live);
		expect(
			groups[0].items.find((i) => i.label.startsWith("Add Bag"))?.done
		).toBe(false);
	});

	it("leaves a bag unticked when the female-plants flag is wrong", () => {
		const live = [{ bags: [{ ...correctBag, contains_female_plants: false }] }];
		const groups = buildFormChecklists(brief, live);
		expect(
			groups[0].items.find((i) => i.label.startsWith("Add Bag"))?.done
		).toBe(false);
	});

	it("leaves a bag unticked until the new seal tag is entered", () => {
		const live = [{ bags: [{ ...correctBag, new_seal_tag_numbers: "" }] }];
		const groups = buildFormChecklists(brief, live);
		expect(
			groups[0].items.find((i) => i.label.startsWith("Add Bag"))?.done
		).toBe(false);
	});

	it("leaves a bag unticked until it has an assessment", () => {
		const live = [{ bags: [{ ...correctBag, assessment: null }] }];
		const groups = buildFormChecklists(brief, live);
		expect(
			groups[0].items.find((i) => i.label.startsWith("Add Bag"))?.done
		).toBe(false);
	});
});

describe("buildCertificateChecklists", () => {
	it("ticks generate then mark-ready as the certificate progresses", () => {
		// No certificate yet.
		let groups = buildCertificateChecklists(brief, [{ bags: [] }]);
		let done = Object.fromEntries(groups[0].items.map((i) => [i.label, i.done]));
		expect(done["Generate the certificate"]).toBe(false);
		expect(done["Review and mark it ready"]).toBe(false);

		// Certificate generated, not yet marked ready.
		groups = buildCertificateChecklists(brief, [
			{ bags: [], certificate: { id: 1 }, marked_ready: false },
		]);
		done = Object.fromEntries(groups[0].items.map((i) => [i.label, i.done]));
		expect(done["Generate the certificate"]).toBe(true);
		expect(done["Review and mark it ready"]).toBe(false);

		// Generated and marked ready.
		groups = buildCertificateChecklists(brief, [
			{ bags: [], certificate: { id: 1 }, marked_ready: true },
		]);
		done = Object.fromEntries(groups[0].items.map((i) => [i.label, i.done]));
		expect(done["Generate the certificate"]).toBe(true);
		expect(done["Review and mark it ready"]).toBe(true);
	});
});

describe("buildBatchChecklist", () => {
	it("ticks nothing before a batch exists for the case", () => {
		const group = buildBatchChecklist("PRACTICE-480021", []);
		expect(group.items.every((i) => !i.done)).toBe(true);
	});

	it("ticks create-batch once a batch covers the case, invoice still open", () => {
		const group = buildBatchChecklist("PRACTICE-480021", [
			{ case_numbers: ["PRACTICE-480021"], is_invoiced: false },
		]);
		const done = Object.fromEntries(group.items.map((i) => [i.label, i.done]));
		expect(done["Create a batch for this case"]).toBe(true);
		expect(done["Record the invoice number"]).toBe(false);
	});

	it("ticks everything once the batch is invoiced", () => {
		const group = buildBatchChecklist("PRACTICE-480021", [
			{ case_numbers: ["PRACTICE-480021"], is_invoiced: true },
		]);
		expect(group.items.every((i) => i.done)).toBe(true);
	});

	it("ignores batches that do not cover this case", () => {
		const group = buildBatchChecklist("PRACTICE-480021", [
			{ case_numbers: ["PRACTICE-999999"], is_invoiced: true },
		]);
		expect(group.items.every((i) => !i.done)).toBe(true);
	});
});

describe("completeness helpers", () => {
	const fullCase: LiveCase = {
		case_number: "PRACTICE-480021",
		submitting_officer: 5,
		submitting_officer_name: "Alex Turner",
		station: 2,
		station_name: "Fremantle",
		approved_botanist: 9,
		defendant_names: ["NGUYEN, Chris"],
	};

	it("isCaseChecklistComplete is false until every item matches, then true", () => {
		expect(isCaseChecklistComplete(brief, null)).toBe(false);
		expect(isCaseChecklistComplete(brief, fullCase)).toBe(true);
	});

	it("areFormChecklistsComplete is false until the form, SME and bag are recorded", () => {
		expect(areFormChecklistsComplete(brief, [])).toBe(false);
		// Form added but nothing else — still incomplete.
		expect(areFormChecklistsComplete(brief, [{ bags: [] }])).toBe(false);
		// Fully recorded: SME + the assessed, re-sealed bag.
		const complete = [
			{
				security_movement_envelope: "SME100",
				bags: [
					{
						seal_tag_numbers: "T10041",
						new_seal_tag_numbers: "N20041",
						content_type: "plant",
						contains_female_plants: true,
						assessment: { determination: "cannabis_sativa" },
					},
				],
			},
		];
		expect(areFormChecklistsComplete(brief, complete)).toBe(true);
	});
});
