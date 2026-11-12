/**
 * Parity with the PDF: the preview's certificate wording is checked against
 * every entry of the fixture generated from the backend wording module, which
 * covers every result sequence for one to five bags, every Section C
 * composition case and every officer option pairing.
 */
import fixtureText from "../../../../../backend/cases/tests/fixtures/certificate_wording.json?raw";
import {
	composeSectionC,
	femalePlantLine,
	formatOfficer,
	sectionBText,
	smeLine,
	summariseResults,
	type OfficerFacts,
	type SectionBKey,
} from "./certificateWording";

interface ResultCase {
	bags: string[];
	section_b: {
		key: SectionBKey;
		prefix: string;
		italic: string;
		suffix: string;
	};
	bag_lines: string[];
}

interface SectionCCase {
	bag_lines: string[];
	note: string | null;
	female_line: string | null;
	envelope: string | null;
	expected: string | null;
}

interface FemaleCase {
	bags: [string, boolean][];
	expected: string | null;
}

interface OfficerCase {
	conveying: OfficerFacts | null;
	print_conveying_station: boolean;
	requesting: OfficerFacts | null;
	print_requesting_station: boolean;
	print_requesting_rank: boolean;
	expected_conveying: string;
	expected_requesting: string | null;
}

const fixture = JSON.parse(fixtureText) as {
	wording_version: number;
	results: ResultCase[];
	section_c: SectionCCase[];
	female: FemaleCase[];
	officers: OfficerCase[];
};

const describeBags = (bags: string[]) => bags.join(", ");

describe("certificate wording parity with the PDF", () => {
	it("covers every combination", () => {
		expect(fixture.results).toHaveLength(1364);
		expect(fixture.section_c).toHaveLength(360);
		expect(fixture.female).toHaveLength(584);
		expect(fixture.officers).toHaveLength(420);
	});

	it.each(fixture.results.map((c) => [describeBags(c.bags), c] as const))(
		"Section B and lines for %s",
		(_name, c) => {
			const results = summariseResults(
				c.bags.map((determination, i) => ({ tag: `T${i + 1}`, determination }))
			);
			expect(results).not.toBeNull();
			expect(results!.sectionB).toEqual(c.section_b);
			expect(results!.bagLines).toEqual(c.bag_lines);
		}
	);

	it.each(fixture.section_c.map((c, i) => [i, c] as const))(
		"Section C case %i",
		(_i, c) => {
			expect(
				composeSectionC(c.bag_lines, c.note, c.female_line, smeLine(c.envelope))
			).toBe(c.expected);
		}
	);

	it.each(fixture.female.map((c, i) => [i, c] as const))(
		"female plant case %i",
		(_i, c) => {
			expect(
				femalePlantLine(
					c.bags.map(([determination, female], i) => ({
						tag: `T${i + 1}`,
						determination,
						female,
					}))
				)
			).toBe(c.expected);
		}
	);

	it.each(fixture.officers.map((c, i) => [i, c] as const))(
		"officer case %i",
		(_i, c) => {
			expect(
				formatOfficer(c.conveying, {
					role: "conveying",
					printStation: c.print_conveying_station,
				})
			).toBe(c.expected_conveying);
			const requesting = c.requesting
				? formatOfficer(c.requesting, {
						role: "requesting",
						printStation: c.print_requesting_station,
						printRank: c.print_requesting_rank,
					})
				: null;
			expect(requesting).toBe(c.expected_requesting);
		}
	);
});

describe("summariseResults outside the printable set", () => {
	it.each([
		[[]],
		[[{ tag: "T1", determination: "pending" }]],
		[[{ tag: "T1", determination: null }]],
		[
			[
				{ tag: "T1", determination: "cannabis_sativa" },
				{ tag: "T2", determination: "mixed" },
			],
		],
	])("returns null for %j", (bags) => {
		expect(summariseResults(bags)).toBeNull();
	});

	it("reads Ben's phrase for differing non-cannabis results", () => {
		const results = summariseResults([
			{ tag: "A", determination: "not_cannabis" },
			{ tag: "B", determination: "inconclusive" },
		]);
		expect(sectionBText(results!.sectionB)).toBe(
			"No item could be identified as Cannabis sativa."
		);
		expect(results!.bagLines).toEqual([
			"Bag A did not contain Cannabis.",
			"Bag B was inconclusive.",
		]);
	});
});

describe("formatOfficer", () => {
	it("prints [Pending] without an officer", () => {
		expect(formatOfficer(null, { role: "conveying", printStation: true })).toBe(
			"[Pending]"
		);
	});
});
