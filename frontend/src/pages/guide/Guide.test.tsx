/**
 * How To page: structure, accessibility, and the certificate wording examples.
 *
 * The wording examples are built from the same constants as the certificate
 * preview, so these tests also pin that the guide shows the approved wording.
 */
import { describe, it, expect } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";
import Guide from "./Guide";

const text = () => (document.body.textContent ?? "").replace(/\s+/g, " ");

describe("Guide page", () => {
	it("has one page heading and a section for every contents link", () => {
		const { container } = renderPage(<Guide />);

		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
		const contents = screen.getByRole("navigation", { name: "Guide contents" });
		const links = within(contents).getAllByRole("link");
		expect(links.length).toBeGreaterThan(10);
		for (const link of links) {
			const id = link.getAttribute("href")!.slice(1);
			const section = container.querySelector(`section#${id}`);
			expect(section, `section #${id}`).not.toBeNull();
			const title = link.querySelector("span")?.textContent ?? "";
			expect(
				within(section as HTMLElement).getAllByRole("heading")[0]
			).toHaveTextContent(title);
		}
	});

	it("never skips a heading level", () => {
		const { container } = renderPage(<Guide />);

		const levels = [...container.querySelectorAll("h1, h2, h3, h4")].map((h) =>
			Number(h.tagName[1])
		);
		levels.reduce((previous, level) => {
			expect(level - previous).toBeLessThanOrEqual(1);
			return level;
		});
	});

	it("lists the four results word for word", () => {
		renderPage(<Guide />);

		const all = text();
		for (const result of [
			"Cannabis sativa",
			"Not Cannabis",
			"Too degraded and could not be identified",
			"Inconclusive",
		]) {
			expect(all).toContain(result);
		}
		expect(all).toContain(
			'"Insufficient, could not identify" is recorded as Inconclusive'
		);
	});

	it("shows every Section B sentence and the Section C lines as printed", () => {
		renderPage(<Guide />);

		const all = text();
		for (const sentence of [
			"I identified the items as Cannabis sativa.",
			"I identified the item as Cannabis sativa.",
			"The items did not contain Cannabis.",
			"The items were too degraded and could not be identified.",
			"The items were inconclusive.",
			"No item could be identified as Cannabis sativa.",
			"Bag T1234 did not contain Cannabis.",
			"Bag T1245 was too degraded and could not be identified.",
			"Bag T9045 was inconclusive.",
		]) {
			expect(all).toContain(sentence);
		}
	});

	it("states the confirmed officer rules", () => {
		renderPage(<Guide />);

		const all = text();
		expect(all).toContain("Station and rank stay on the certificate");
		expect(all).toContain("Always Unsworn Officer");
		expect(all).toContain(
			"The system will not let you choose one person for both"
		);
		expect(all).toContain("A missing station never stops you");
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Guide />);

		expect(await testAccessibility(container)).toHaveNoViolations();
	});
});
