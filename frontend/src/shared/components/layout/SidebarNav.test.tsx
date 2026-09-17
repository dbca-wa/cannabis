import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, within } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const authState = {
	user: { is_superuser: false } as { is_superuser: boolean } | null,
	hasAppAccess: true,
};
vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => authState,
}));

const invoiceState = { count: 0 };
vi.mock("@/features/batches", () => ({
	useAwaitingInvoiceCount: () => invoiceState.count,
}));

const { SidebarNav, navGroups } = await import("./SidebarNav");

describe("navGroups", () => {
	it("puts Settings in its own group, last", () => {
		const last = navGroups[navGroups.length - 1];

		expect(last.items).toHaveLength(1);
		expect(last.items[0].to).toBe("/settings");
		expect(last.pinToBottom).toBe(true);
	});

	it("no longer keeps Settings in the Casework group", () => {
		const casework = navGroups.find((group) => group.label === "Casework");

		expect(casework?.items.some((item) => item.to === "/settings")).toBe(false);
	});

	it("leaves the Settings group unlabelled", () => {
		expect(navGroups[navGroups.length - 1].label).toBeUndefined();
	});

	it("keeps the working sections above Settings", () => {
		const labels = navGroups.map((group) => group.label);

		expect(labels.slice(0, 3)).toEqual(["Casework", "Users", "Police"]);
	});
});

describe("SidebarNav", () => {
	beforeEach(() => {
		authState.user = { is_superuser: false };
		authState.hasAppAccess = true;
		invoiceState.count = 0;
	});

	it("renders the working links and Settings", () => {
		renderPage(<SidebarNav />);

		expect(
			screen.getByRole("link", { name: /dashboard/i })
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /cases/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /batches/i })).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
	});

	it("shows Settings after every other link", () => {
		renderPage(<SidebarNav />);

		const links = screen.getAllByRole("link");
		const hrefs = links.map((link) => link.getAttribute("href"));

		expect(hrefs[hrefs.length - 1]).toBe("/settings");
	});

	it("hides admin-only links from a non-admin", () => {
		renderPage(<SidebarNav />);

		expect(
			screen.queryByRole("link", { name: /invitations/i })
		).not.toBeInTheDocument();
	});

	it("shows admin-only links to an admin", () => {
		authState.user = { is_superuser: true };
		renderPage(<SidebarNav />);

		expect(
			screen.getByRole("link", { name: /invitations/i })
		).toBeInTheDocument();
	});

	it("shows only the dashboard to a user without app access", () => {
		authState.hasAppAccess = false;
		renderPage(<SidebarNav />);

		expect(
			screen.getByRole("link", { name: /dashboard/i })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /cases/i })
		).not.toBeInTheDocument();
		expect(
			screen.queryByRole("link", { name: /settings/i })
		).not.toBeInTheDocument();
	});

	describe("awaiting invoice count", () => {
		it("shows no count when nothing is outstanding", () => {
			renderPage(<SidebarNav />);

			const batches = screen.getByRole("link", { name: /batches/i });
			expect(within(batches).queryByText("3")).not.toBeInTheDocument();
		});

		it("shows the count on the batches link", () => {
			invoiceState.count = 3;
			renderPage(<SidebarNav />);

			const batches = screen.getByRole("link", { name: /batches/i });
			expect(within(batches).getByText("3")).toBeInTheDocument();
		});

		it("describes the count for assistive technology", () => {
			invoiceState.count = 2;
			renderPage(<SidebarNav />);

			expect(
				screen.getByText(/batches awaiting an invoice/i)
			).toBeInTheDocument();
		});

		it("uses the singular for one outstanding batch", () => {
			invoiceState.count = 1;
			renderPage(<SidebarNav />);

			expect(
				screen.getByText(/batch awaiting an invoice/i)
			).toBeInTheDocument();
		});

		it("does not put a count on any other link", () => {
			invoiceState.count = 4;
			renderPage(<SidebarNav />);

			const cases = screen.getByRole("link", { name: /cases/i });
			expect(within(cases).queryByText("4")).not.toBeInTheDocument();
		});
	});

	it("has no accessibility violations", async () => {
		invoiceState.count = 2;
		const { container } = renderPage(<SidebarNav />);

		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
