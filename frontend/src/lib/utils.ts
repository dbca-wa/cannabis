import { Role } from "@/types";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

const roleMapping: Map<Role, string> = new Map([
	["none", "None"],
	["police", "Police"],
	["botanist", "Approved Botanist"],
	["finance", "Finance Officer"],
]);

export const roleToReadable = (role: Role) => {
	return roleMapping.get(role) || "Unset";
};
