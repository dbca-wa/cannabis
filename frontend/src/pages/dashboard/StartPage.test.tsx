import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";
import { renderPage, testAccessibility } from "@/test/page-test-utils";

// The start page while the dashboard is off: Cases for anyone with a role,
// the awaiting-role notice for everyone else.
const authState = { hasAppAccess: true, user: { given_names: "Sam" } };
vi.mock("@/features/auth/hooks/useAuth", () => ({
	useAuth: () => authState,
}));

const StartPage = await import("./StartPage").then((m) => m.default);

const renderAtRoot = () =>
	renderPage(
		<Routes>
			<Route path="/" element={<StartPage />} />
			<Route path="/cases" element={<h1>Cases page</h1>} />
		</Routes>,
		{ initialEntries: ["/"] }
	);

describe("Start page", () => {
	it("opens Cases for someone with a role", async () => {
		authState.hasAppAccess = true;
		renderAtRoot();
		expect(
			await screen.findByRole("heading", { name: "Cases page" })
		).toBeInTheDocument();
	});

	it("explains the wait to someone without a role", () => {
		authState.hasAppAccess = false;
		renderAtRoot();
		expect(
			screen.getByRole("heading", { name: /welcome, sam/i })
		).toBeInTheDocument();
		expect(
			screen.queryByRole("heading", { name: "Cases page" })
		).not.toBeInTheDocument();
	});

	it("has no accessibility violations for someone without a role", async () => {
		authState.hasAppAccess = false;
		const { container } = renderAtRoot();
		await testAccessibility(container);
	});
});
