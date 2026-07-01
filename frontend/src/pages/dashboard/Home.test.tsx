import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

const authState = {
	hasAppAccess: true,
	user: { id: 1, given_names: "Sam", full_name: "Sam Tester" },
};

vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => authState,
}));

vi.mock("@/features/dash/hooks/useRevenueStats", () => ({
	useRevenueStats: () => ({
		data: {
			financial_year: { total: 12500 },
			previous_year: { total: 10000, change_percentage: 25 },
		},
		isLoading: false,
		isError: false,
	}),
}));

vi.mock("@/features/dash/hooks/useMonthlyThroughput", () => ({
	useMonthlyThroughput: () => ({
		data: [
			{ month: "Jul", cases: 5, certs: 4, bags: 20, revenue: 2200 },
			{ month: "Aug", cases: 7, certs: 6, bags: 28, revenue: 3100 },
		],
	}),
}));

vi.mock("@/features/dash/hooks/usePhaseStats", () => ({
	usePhaseStats: () => ({
		data: {
			assessment: 3,
			unsigned_generation: 2,
			batching: 1,
			in_batch: 4,
		},
		isLoading: false,
		isError: false,
	}),
}));

const Home = await import("./Home").then((m) => m.default);

describe("Dashboard (Home) Page", () => {
	it("greets the user and shows the throughput and revenue cards", () => {
		renderPage(<Home />);

		expect(
			screen.getByRole("heading", { name: /welcome back, sam/i })
		).toBeInTheDocument();
		expect(screen.getByText(/monthly throughput/i)).toBeInTheDocument();
		expect(screen.getByText(/financial year revenue/i)).toBeInTheDocument();
	});

	it("shows the awaiting-role notice for users without app access", () => {
		authState.hasAppAccess = false;
		try {
			renderPage(<Home />);
			expect(
				screen.queryByRole("heading", { name: /welcome back/i })
			).not.toBeInTheDocument();
		} finally {
			authState.hasAppAccess = true;
		}
	});

	it("has no accessibility violations", async () => {
		const { container } = renderPage(<Home />);
		const results = await testAccessibility(container);
		expect(results).toHaveNoViolations();
	});
});
