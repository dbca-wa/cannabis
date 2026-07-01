/**
 * Page test utilities.
 *
 * Renders pages with the app's providers (TanStack Query, MobX store, router)
 * and exposes an accessibility helper.
 */

import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, type MemoryRouterProps } from "react-router";
import type { ReactElement, ReactNode } from "react";

import { StoreProvider } from "@/app/providers/store.provider";
import { axe } from "./axe-utils";

export interface PageTestOptions extends Omit<RenderOptions, "wrapper"> {
	initialEntries?: MemoryRouterProps["initialEntries"];
	initialIndex?: MemoryRouterProps["initialIndex"];
	queryClient?: QueryClient;
}

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: { retry: false, gcTime: 0, staleTime: 0 },
			mutations: { retry: false },
		},
	});
}

/** Build a provider wrapper (Query + MobX store + Router). */
export function createTestWrapper(options: PageTestOptions = {}) {
	const { initialEntries = ["/"], initialIndex } = options;
	const testQueryClient = options.queryClient ?? makeQueryClient();

	return function Wrapper({ children }: { children: ReactNode }) {
		return (
			<QueryClientProvider client={testQueryClient}>
				<StoreProvider>
					<MemoryRouter
						initialEntries={initialEntries}
						initialIndex={initialIndex}
					>
						{children}
					</MemoryRouter>
				</StoreProvider>
			</QueryClientProvider>
		);
	};
}

/** Render a page (or any UI) wrapped in all required providers. */
export function renderPage(ui: ReactElement, options: PageTestOptions = {}) {
	const { initialEntries, initialIndex, queryClient, ...renderOptions } =
		options;
	const Wrapper = createTestWrapper({
		initialEntries,
		initialIndex,
		queryClient,
	});
	return render(ui, { wrapper: Wrapper, ...renderOptions });
}

/** Run axe accessibility checks against a rendered container. */
export async function testAccessibility(container: Element) {
	return await axe(container);
}
