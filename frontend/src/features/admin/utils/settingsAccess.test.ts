import { describe, it, expect } from "vitest";
import type { User, UserRole } from "@/shared/types/backend-api.types";
import { getSettingsAccess } from "./settingsAccess";

const makeUser = (overrides: Partial<User> = {}): User =>
	({
		id: 1,
		email: "sam@dbca.wa.gov.au",
		role: "none" as UserRole,
		is_staff: false,
		is_superuser: false,
		practice_mode: false,
		...overrides,
	}) as User;

describe("getSettingsAccess", () => {
	it.each(["finance", "botanist"] as UserRole[])(
		"lets a %s change settings but not the system flags",
		(role) => {
			expect(getSettingsAccess(makeUser({ role }))).toEqual({
				canEdit: true,
				canEditSystemFlags: false,
				hasRole: true,
			});
		}
	);

	it.each([
		["staff", { is_staff: true }],
		["superuser", { is_superuser: true }],
	])("lets a %s change everything", (_label, overrides) => {
		expect(getSettingsAccess(makeUser(overrides))).toEqual({
			canEdit: true,
			canEditSystemFlags: true,
			hasRole: true,
		});
	});

	it("shows settings read-only to someone without an app role", () => {
		const access = getSettingsAccess(makeUser());

		expect(access.canEdit).toBe(false);
		expect(access.hasRole).toBe(false);
		expect(access.canEdit === false && access.reason).toMatch(
			/only finance officers, botanists and administrators/i
		);
	});

	it("shows settings read-only to a signed-out visitor", () => {
		expect(getSettingsAccess(null).canEdit).toBe(false);
	});

	it("shows settings read-only in practice mode, even to an administrator", () => {
		const access = getSettingsAccess(
			makeUser({ is_superuser: true, practice_mode: true })
		);

		expect(access).toMatchObject({ canEdit: false, canEditSystemFlags: false });
		expect(access.canEdit === false && access.reason).toMatch(/practice mode/i);
	});
});
