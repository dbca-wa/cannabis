import { describe, it, expect } from "vitest";
import { nameFromSearch } from "./name-search.utils";

describe("nameFromSearch", () => {
	it("takes text without a comma as the surname", () => {
		expect(nameFromSearch("Nguyen")).toEqual({
			last_name: "Nguyen",
			given_names: "",
		});
	});

	it("reads the list style SURNAME, Given Names", () => {
		expect(nameFromSearch("NGUYEN, Chris")).toEqual({
			last_name: "NGUYEN",
			given_names: "Chris",
		});
	});

	it("tidies spaces", () => {
		expect(nameFromSearch("  van  der Berg ,  Anna  Marie ")).toEqual({
			last_name: "van der Berg",
			given_names: "Anna Marie",
		});
	});

	it("gives empty fields for empty text", () => {
		expect(nameFromSearch("   ")).toEqual({ last_name: "", given_names: "" });
	});
});
