export {
	login,
	logout,
	getCurrentUser,
	refreshToken,
	register,
	activateInvitation,
	hasValidTokens,
	shouldRefreshToken,
	getAccessToken,
	setCachedUser,
	clearCache,
	getDebugInfo,
	// Deprecated — use password.service directly
	validatePassword,
	updatePassword,
	forgotPassword,
} from "./auth.service";

export {
	validatePassword as validatePasswordDirect,
	updatePassword as updatePasswordDirect,
	forgotPassword as forgotPasswordDirect,
} from "./password.service";
