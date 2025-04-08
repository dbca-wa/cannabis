import { AuthStore } from "./authStore";
import { UIStore } from "./uiStore";

export interface User {
	id: number;
	username: string;
	email: string;
	isAdmin: boolean;
	createdAt?: string;
	lastLogin?: string;
	activities?: Array<{
		action: string;
		timestamp: string;
	}>;
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
