import { describe, it, expect } from "vitest";
import {
	buildCaseChecklist,
	buildFormChecklists,
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
	it("labels a bag with both the original and new seal tags", () => {
		const groups = buildFormChecklists(brief, []);
		const bag = groups[0].items.find((i) => i.label.startsWith("Bag"));
		expect(bag?.label).toContain("original T10041");
		expect(bag?.label).toContain("new N20041");
	});

	it("ticks the SME and a bag once recorded, assessed and re-sealed", () => {
		const live = [
			{
				security_movement_envelope: "SME100",
				bags: [
					{
						seal_tag_numbers: "T10041",
						new_seal_tag_numbers: "N20041",
						assessment: { determination: "cannabis_sativa" },
					},
				],
			},
		];
		const groups = buildFormChecklists(brief, live);
		const items = groups[0].items;
		expect(items.find((i) => i.label.includes("envelope"))?.done).toBe(true);
		const bag = items.find((i) => i.label.startsWith("Bag"));
		expect(bag?.done).toBe(true);
	});

	it("leaves a bag unticked until the new seal tag is entered", () => {
		const live = [
			{
				bags: [
					{
						seal_tag_numbers: "T10041",
						new_seal_tag_numbers: "",
						assessment: { determination: "cannabis_sativa" },
					},
				],
			},
		];
		const groups = buildFormChecklists(brief, live);
		expect(groups[0].items.find((i) => i.label.startsWith("Bag"))?.done).toBe(
			false
		);
	});

	it("leaves a bag unticked until it has an assessment", () => {
		const live = [
			{
				bags: [
					{
						seal_tag_numbers: "T10041",
						new_seal_tag_numbers: "N20041",
						assessment: null,
					},
				],
			},
		];
		const groups = buildFormChecklists(brief, live);
		expect(groups[0].items.find((i) => i.label.startsWith("Bag"))?.done).toBe(
			false
		);
	});
});
