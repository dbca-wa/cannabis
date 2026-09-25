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
