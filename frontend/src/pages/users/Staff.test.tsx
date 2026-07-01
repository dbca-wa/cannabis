import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const inviteUser = vi.fn();

vi.mock("@/features/user/hooks/useUsers", () => ({
	useUsers: () => ({
		users: [],
		isLoading: false,
		isError: false,
		inviteUser,
		isInviting: false,
		refreshUsers: vi.fn(),
	}),
}));

vi.mock("@/features/user/components/StaffFilters", () => ({
	StaffFilters: () => <div data-testid="staff-filters" />,
}));

const Staff = await import("./Staff").then((m) => m.default);

describe("Staff Page", () => {
	it("renders the header and an empty state with an invite action", () => {
		renderPage(<Staff />);

		expect(
			screen.getByRole("heading", { name: /staff/i, level: 1 })
		).toBeInTheDocument();
		expect(screen.getByText(/no users yet/i)).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /invite user/i })
		).toBeInTheDocument();
	});

	it("opens the invite dialog with email and role fields", async () => {
		const user = userEvent.setup();
		renderPage(<Staff />);

		await user.click(screen.getByRole("button", { name: /invite user/i }));

		expect(
			await screen.findByRole("dialog", { name: /invite user/i })
		).toBeInTheDocument();
		expect(screen.getByText("Email")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: /send invite/i })
		).toBeInTheDocument();
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Staff />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
