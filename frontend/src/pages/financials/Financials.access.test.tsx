import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

// Who can change Settings: finance officers, botanists and administrators.
// The rest of the page (and practice mode) shows the settings read-only.

const authState: { user: Record<string, unknown> } = { user: {} };
vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => authState,
}));

vi.mock("@/features/admin/hooks/useSystemSettings", () => ({
	useSystemSettings: () => ({
		settings: {
			cost_per_certificate: "110.00",
			cost_per_bag: "22.00",
			tax_percentage: "10.00",
			certificate_counter: 41,
			ocr_enabled: false,
			allow_saved_searches: false,
			environment: "local",
			default_approved_botanist: null,
			default_approved_botanist_details: null,
			default_print_conveying_station: true,
			default_print_requesting_station: true,
			default_print_requesting_rank: false,
			last_modified_by: null,
			last_modified_at: null,
		},
		isUpdating: false,
		error: null,
		validationErrors: {},
		updateSettings: vi.fn(),
		clearError: vi.fn(),
	}),
}));

vi.mock("@/features/cases/components/templates/TemplatesSettingsCard", () => ({
	TemplatesSettingsCard: () => <div data-testid="templates" />,
}));
vi.mock("@/features/user/components/forms/UserSearchCombobox", () => ({
	UserSearchCombobox: ({
		id,
		disabled,
	}: {
		id?: string;
		disabled?: boolean;
	}) => <input id={id} disabled={disabled} readOnly />,
}));

const Settings = await import("./Financials").then((m) => m.default);

const asUser = (overrides: Record<string, unknown>) => {
	authState.user = {
		id: 1,
		role: "none",
		is_staff: false,
		is_superuser: false,
		practice_mode: false,
		...overrides,
	};
};

describe("Settings Page access", () => {
	beforeEach(() => asUser({}));

	it.each(["finance", "botanist"])(
		"lets a %s change rates, numbering and defaults",
		(role) => {
			asUser({ role });
			renderPage(<Settings />);

			expect(
				screen.getByRole("button", { name: /change certificate cost/i })
			).toBeInTheDocument();
			// The certificate counter and the default botanist each save.
			expect(screen.getAllByRole("button", { name: "Save" })).toHaveLength(2);
			expect(screen.getByLabelText(/counter value/i)).not.toHaveAttribute(
				"readonly"
			);
			expect(screen.queryByRole("status")).not.toBeInTheDocument();
		}
	);

	it("keeps the remembered-searches switch for administrators", () => {
		asUser({ role: "finance" });
		const { unmount } = renderPage(<Settings />);
		expect(
			screen.queryByRole("switch", { name: /allow remembered searches/i })
		).not.toBeInTheDocument();
		unmount();

		asUser({ is_superuser: true, is_staff: true });
		renderPage(<Settings />);
		expect(
			screen.getByRole("switch", { name: /allow remembered searches/i })
		).toBeEnabled();
	});

	it("shows the settings read-only in practice mode", () => {
		asUser({ role: "finance", practice_mode: true });
		renderPage(<Settings />);

		expect(screen.getByRole("status")).toHaveTextContent(/practice mode/i);
		expect(
			screen.queryByRole("button", { name: /change certificate cost/i })
		).not.toBeInTheDocument();
		expect(screen.getByText("$110.00")).toBeInTheDocument();
		expect(screen.getByLabelText(/counter value/i)).toHaveAttribute("readonly");
		expect(
			screen.queryByRole("button", { name: "Save" })
		).not.toBeInTheDocument();
		for (const toggle of screen.getAllByRole("switch")) {
			expect(toggle).toBeDisabled();
		}
	});

	it("shows the settings read-only to someone without a role", () => {
		asUser({ role: "none" });
		renderPage(<Settings />);

		expect(screen.getByRole("status")).toHaveTextContent(
			/only finance officers, botanists and administrators can change them/i
		);
		expect(
			screen.queryByRole("button", { name: /change certificate cost/i })
		).not.toBeInTheDocument();
		expect(screen.getByText("$110.00")).toBeInTheDocument();
		expect(screen.getByLabelText(/counter value/i)).toHaveAttribute("readonly");
		// The default botanist is shown as text, with no search box.
		expect(screen.getByText("No default set")).toBeInTheDocument();
		// Templates need a role, so the card says so instead of loading them.
		expect(screen.queryByTestId("templates")).not.toBeInTheDocument();
		expect(
			screen.getByText(/templates are available to finance officers/i)
		).toBeInTheDocument();
	});

	it("has no accessibility violations without a role", async () => {
		asUser({ role: "none" });
		const { container } = renderPage(<Settings />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});

	it("has no accessibility violations when read-only", async () => {
		asUser({ role: "botanist", practice_mode: true });
		const { container } = renderPage(<Settings />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
