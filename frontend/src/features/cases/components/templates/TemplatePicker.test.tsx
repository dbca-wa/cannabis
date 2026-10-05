import { describe, it, expect, vi, beforeEach } from "vitest";
import { useState } from "react";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage } from "@/test/page-test-utils";
import type { DrugBag } from "../../types/drugBags.types";
import type { ISectionCTemplate } from "../../types/templates.types";

// The picker fetches templates via TanStack Query; mock the hook so the test
// controls the available templates without a network layer.
const templates: ISectionCTemplate[] = [
	{
		id: 1,
		name: "Tags",
		content: "Bags {{tag_numbers}} examined.",
		created_at: "",
		updated_at: "",
	},
	{
		id: 2,
		name: "SME",
		content:
			"Subsamples placed into Security Movement Envelope {{security_movement_envelope}}.",
		created_at: "",
		updated_at: "",
	},
];
const inertMutation = () => ({
	mutate: vi.fn(),
	mutateAsync: vi.fn(),
	isPending: false,
});
vi.mock("../../hooks/useSectionCTemplates", () => ({
	useSectionCTemplates: () => ({ data: templates, isLoading: false }),
	// The picker renders create/edit modals that consume these hooks.
	useCreateTemplate: () => inertMutation(),
	useUpdateTemplate: () => inertMutation(),
	useDeleteTemplate: () => inertMutation(),
}));

const { TemplatePicker } = await import("./TemplatePicker");

const bag = (seal: string): DrugBag =>
	({
		id: Math.floor(Math.random() * 1e6),
		seal_tag_numbers: seal,
		new_seal_tag_numbers: null,
		content_type: "plant",
		content_type_display: "Plant",
		contains_female_plants: false,
		assessment: null,
	}) as unknown as DrugBag;

const caseData = { case_number: "IR 1" };

/**
 * Mirrors how AssessmentStep wires the picker: the note is state, fed back as
 * `currentValue`, and updated when the picker applies a template. A textarea
 * lets a test simulate the user free typing. `onApply` is spied via a prop.
 */
const Harness = ({
	bags,
	initialNote = "",
	onApplySpy,
}: {
	bags: DrugBag[];
	initialNote?: string;
	onApplySpy: (text: string) => void;
}) => {
	const [note, setNote] = useState(initialNote);
	return (
		<>
			<TemplatePicker
				caseData={caseData}
				bags={bags}
				currentValue={note}
				onApply={(resolved) => {
					setNote(resolved);
					onApplySpy(resolved);
				}}
			/>
			<textarea
				aria-label="note"
				value={note}
				onChange={(e) => setNote(e.target.value)}
			/>
		</>
	);
};

const selectTagsTemplate = async (user: ReturnType<typeof userEvent.setup>) => {
	await user.click(screen.getByRole("combobox"));
	await user.click(screen.getByRole("option", { name: /tags/i }));
};

describe("TemplatePicker — re-resolves on bag changes", () => {
	beforeEach(() => vi.clearAllMocks());

	it("resolves against the current bags when a template is selected", async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();

		renderPage(<Harness bags={[bag("A"), bag("B")]} onApplySpy={onApply} />);
		await selectTagsTemplate(user);

		expect(onApply).toHaveBeenLastCalledWith("Bags A and B examined.");
	});

	it("re-applies with the new text when a bag is ADDED", async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();

		const { rerender } = renderPage(
			<Harness bags={[bag("A"), bag("B")]} onApplySpy={onApply} />
		);
		await selectTagsTemplate(user);
		onApply.mockClear();

		rerender(
			<Harness bags={[bag("A"), bag("B"), bag("C")]} onApplySpy={onApply} />
		);

		expect(onApply).toHaveBeenLastCalledWith("Bags A, B and C examined.");
	});

	it("re-applies with the new text when a bag is REMOVED", async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();

		const { rerender } = renderPage(
			<Harness bags={[bag("A"), bag("B"), bag("C")]} onApplySpy={onApply} />
		);
		await selectTagsTemplate(user);
		onApply.mockClear();

		rerender(<Harness bags={[bag("A"), bag("B")]} onApplySpy={onApply} />);

		expect(onApply).toHaveBeenLastCalledWith("Bags A and B examined.");
	});

	it("does not re-apply when no template is selected", () => {
		const onApply = vi.fn();

		const { rerender } = renderPage(
			<Harness bags={[bag("A")]} onApplySpy={onApply} />
		);
		rerender(<Harness bags={[bag("A"), bag("B")]} onApplySpy={onApply} />);

		expect(onApply).not.toHaveBeenCalled();
	});
});

describe("TemplatePicker — free typing after a template", () => {
	beforeEach(() => vi.clearAllMocks());

	it("shows a free-typing notice once the note is edited away from the template", async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();

		renderPage(<Harness bags={[bag("A"), bag("B")]} onApplySpy={onApply} />);
		await selectTagsTemplate(user);

		expect(screen.queryByRole("status")).not.toBeInTheDocument();

		await user.type(screen.getByRole("textbox", { name: "note" }), " Potatoes");

		expect(screen.getByRole("status")).toHaveTextContent(/free typing/i);
	});

	it("does NOT overwrite free-typed text when a bag changes afterwards", async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();

		const { rerender } = renderPage(
			<Harness bags={[bag("A"), bag("B")]} onApplySpy={onApply} />
		);
		await selectTagsTemplate(user);
		await user.type(screen.getByRole("textbox", { name: "note" }), " Potatoes");
		onApply.mockClear();

		// A bag arrives after the user has free-typed.
		rerender(
			<Harness bags={[bag("A"), bag("B"), bag("C")]} onApplySpy={onApply} />
		);

		// The picker must not re-apply the template over the custom text.
		expect(onApply).not.toHaveBeenCalled();
		expect(screen.getByRole("textbox", { name: "note" })).toHaveValue(
			"Bags A and B examined. Potatoes"
		);
	});

	it("clears the free-typing notice when a template is reselected", async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();

		renderPage(<Harness bags={[bag("A"), bag("B")]} onApplySpy={onApply} />);
		await selectTagsTemplate(user);
		await user.type(screen.getByRole("textbox", { name: "note" }), " Potatoes");
		expect(screen.getByRole("status")).toHaveTextContent(/free typing/i);

		await selectTagsTemplate(user);

		expect(screen.queryByRole("status")).not.toBeInTheDocument();
	});
});

describe("TemplatePicker — never applies an unresolvable template", () => {
	beforeEach(() => vi.clearAllMocks());

	it("disables a template whose data is missing on this form", async () => {
		const user = userEvent.setup();
		// No security_movement_envelope in caseData, so the SME template cannot
		// resolve and must be offered disabled, not applicable.
		renderPage(<Harness bags={[bag("A")]} onApplySpy={vi.fn()} />);
		await user.click(screen.getByRole("combobox"));

		const smeOption = screen.getByRole("option", { name: /SME/i });
		expect(smeOption).toHaveAttribute("aria-disabled", "true");
		expect(smeOption).toHaveTextContent(/missing data/i);
	});

	it("never emits a note containing [Pending] when data would re-resolve short", () => {
		// Select the Tags template with bags, then re-render with NO bags so the
		// template can no longer resolve. The picker must not push "[Pending]".
		const onApply = vi.fn();
		const { rerender } = renderPage(
			<Harness bags={[bag("A")]} onApplySpy={onApply} />
		);
		// Simulate a selection having been applied, then the data going missing.
		rerender(<Harness bags={[]} onApplySpy={onApply} />);

		for (const call of onApply.mock.calls) {
			expect(call[0]).not.toContain("[Pending]");
		}
	});
});

describe("TemplatePicker — per-form isolation", () => {
	beforeEach(() => vi.clearAllMocks());

	// AssessmentStep keys the picker by formId, so switching forms remounts it.
	// A template selected on one form must not carry over and re-resolve onto
	// another form's note (the reported SME "[Pending]" leak).
	it("does not carry a selected template across a form switch", async () => {
		const user = userEvent.setup();
		const onApply = vi.fn();

		// Form 2: has an SME, pick the SME template — it resolves and applies.
		const { rerender } = renderPage(
			<div>
				<TemplatePicker
					key={2}
					caseData={{ case_number: "IR 2", security_movement_envelope: "WW1" }}
					bags={[bag("A")]}
					currentValue=""
					onApply={onApply}
				/>
			</div>
		);
		await user.click(screen.getByRole("combobox"));
		await user.click(screen.getByRole("option", { name: /SME/i }));
		expect(onApply).toHaveBeenLastCalledWith(
			"Subsamples placed into Security Movement Envelope WW1."
		);
		onApply.mockClear();

		// Switch to form 1 (no SME) — the keyed remount starts with no selection,
		// so nothing is applied to form 1's note.
		rerender(
			<div>
				<TemplatePicker
					key={1}
					caseData={{ case_number: "IR 1" }}
					bags={[bag("A")]}
					currentValue=""
					onApply={onApply}
				/>
			</div>
		);

		expect(onApply).not.toHaveBeenCalled();
	});
});
