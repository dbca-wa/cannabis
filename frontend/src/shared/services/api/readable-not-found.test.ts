import { describe, expect, it } from "vitest";
import { readableNotFound } from "./client.service";

describe("readableNotFound", () => {
	it("rewords the framework's not-found message", () => {
		expect(readableNotFound(404, "No Case matches the given query.")).toBe(
			"This record could not be found. It may have been deleted, or it may not be visible in practice mode."
		);
		expect(
			readableNotFound(404, "No PoliceOfficer matches the given query")
		).toMatch(/^This record could not be found/);
	});

	it("keeps the server's own wording otherwise", () => {
		expect(readableNotFound(404, "Case with pk 5 not found")).toBe(
			"Case with pk 5 not found"
		);
		expect(readableNotFound(400, "No Case matches the given query.")).toBe(
			"No Case matches the given query."
		);
	});
});
