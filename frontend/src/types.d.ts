import { AuthStore } from "./authStore";
import { UIStore } from "./uiStore";

export type Role = "botanist" | "police" | "finance" | "none";
export interface User {
	id: number;
	username: string;
	email: string;
	role: Role;
	is_staff: boolean;
	is_superuser: boolean;
}

export type AuthState = {
	user: User | null;
	token: string | null;
	loading: boolean;
	error: string | null;
};

export interface RootStoreType {
	authStore: AuthStore;
	uiStore: UIStore;
}
