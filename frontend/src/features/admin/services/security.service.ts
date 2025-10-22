import { logger } from "@/shared/services/logger.service";
import type { User } from "@/shared/types/backend-api.types";

export interface SecurityCheck {
	allowed: boolean;
	reason?: string;
	requiresConfirmation?: boolean;
	confirmationLevel?: "standard" | "elevated" | "critical";
}

export interface SettingsChange {
	field: string;
	oldValue: string;
	newValue: string;
	isCritical?: boolean;
}

class SecurityService {
	/**
	 * Check if user has admin privileges for settings modification
	 */
	checkAdminAccess(user: User | null | undefined): SecurityCheck {
		if (!user) {
			return {
				allowed: false,
				reason: "User not authenticated"
			};
		}

		if (!user.is_staff) {
			logger.warn("Non-staff user attempted admin access", { userId: user.id });
			return {
				allowed: false,
				reason: "Staff privileges required"
			};
		}

		if (!user.is_superuser) {
			logger.warn("Non-superuser staff attempted admin settings access", { userId: user.id });
			return {
				allowed: false,
				reason: "Superuser privileges required for system settings"
			};
		}

		return { allowed: true };
	}

	/**
	 * Determine if changes require confirmation based on environment and change type
	 */
	requiresConfirmation(
		changes: SettingsChange[],
		environment: string
	): SecurityCheck {
		const env = environment.toLowerCase();
		const hasCriticalChanges = changes.some(change => this.isCriticalChange(change));
		
		// Always require confirmation in production
		if (env === "production") {
			return {
				allowed: true,
				requiresConfirmation: true,
				confirmationLevel: hasCriticalChanges ? "critical" : "elevated"
			};
		}

		// Require confirmation for critical changes in staging
		if (env === "staging" && hasCriticalChanges) {
			return {
				allowed: true,
				requiresConfirmation: true,
				confirmationLevel: "elevated"
			};
		}

		// Standard confirmation for multiple changes
		if (changes.length > 3) {
			return {
				allowed: true,
				requiresConfirmation: true,
				confirmationLevel: "standard"
			};
		}

		return { allowed: true, requiresConfirmation: false };
	}

	/**
	 * Determine if a specific change is considered critical
	 */
	private isCriticalChange(change: SettingsChange): boolean {
		const criticalFields = [
			"send_emails_to_self",
			"forward_certificate_emails_to",
			"tax_percentage"
		];

		// Check if field is in critical list
		if (criticalFields.includes(change.field)) {
			return true;
		}

		// Check for significant pricing changes (>20% change)
		const pricingFields = [
			"cost_per_certificate",
			"cost_per_bag", 
			"call_out_fee",
			"cost_per_forensic_hour",
			"cost_per_kilometer_fuel"
		];

		if (pricingFields.includes(change.field)) {
			const oldValue = parseFloat(change.oldValue);
			const newValue = parseFloat(change.newValue);
			
			if (!isNaN(oldValue) && !isNaN(newValue) && oldValue > 0) {
				const percentChange = Math.abs((newValue - oldValue) / oldValue);
				return percentChange > 0.2; // 20% change threshold
			}
		}

		return false;
	}

	/**
	 * Get confirmation dialog configuration based on changes and environment
	 */
	getConfirmationConfig(
		changes: SettingsChange[],
		environment: string
	): {
		title: string;
		description: string;
		variant: "default" | "destructive" | "warning";
		confirmText: string;
	} {
		const env = environment.toLowerCase();
		const hasCriticalChanges = changes.some(change => this.isCriticalChange(change));
		const criticalChanges = changes.filter(change => this.isCriticalChange(change));

		if (env === "production") {
			return {
				title: "Confirm Production Changes",
				description: hasCriticalChanges 
					? `You are about to make ${criticalChanges.length} critical change(s) to the production system. These changes will immediately affect live operations.`
					: "You are about to modify production system settings. These changes will take effect immediately.",
				variant: hasCriticalChanges ? "destructive" : "warning",
				confirmText: "Apply to Production"
			};
		}

		if (env === "staging" && hasCriticalChanges) {
			return {
				title: "Confirm Critical Changes",
				description: `You are about to make ${criticalChanges.length} critical change(s) to system settings. Please review carefully.`,
				variant: "warning",
				confirmText: "Apply Changes"
			};
		}

		return {
			title: "Confirm Settings Changes",
			description: `You are about to modify ${changes.length} system setting(s). Please review the changes below.`,
			variant: "default",
			confirmText: "Apply Changes"
		};
	}

	/**
	 * Format field names for display in confirmation dialogs
	 */
	formatFieldName(fieldName: string): string {
		const fieldDisplayNames: Record<string, string> = {
			cost_per_certificate: "Certificate Cost",
			cost_per_bag: "Bag Identification Cost", 
			call_out_fee: "Call Out Fee",
			cost_per_forensic_hour: "Forensic Hour Cost",
			cost_per_kilometer_fuel: "Fuel Cost per Kilometer",
			tax_percentage: "Tax Percentage",
			forward_certificate_emails_to: "Admin Email Address",
			send_emails_to_self: "Email Routing Mode"
		};

		return fieldDisplayNames[fieldName] || fieldName.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
	}

	/**
	 * Format values for display in confirmation dialogs
	 */
	formatValue(fieldName: string, value: string): string {
		// Currency fields
		if (fieldName.includes("cost_") || fieldName.includes("fee")) {
			const numValue = parseFloat(value);
			return isNaN(numValue) ? value : `$${numValue.toFixed(2)}`;
		}

		// Percentage fields
		if (fieldName.includes("percentage")) {
			const numValue = parseFloat(value);
			return isNaN(numValue) ? value : `${numValue}%`;
		}

		// Boolean fields
		if (fieldName === "send_emails_to_self") {
			return value === "true" ? "Send to Admin" : "Send to Recipients";
		}

		return value;
	}

	/**
	 * Log security events for audit purposes
	 */
	logSecurityEvent(
		event: "access_denied" | "settings_modified" | "confirmation_required",
		details: Record<string, any>
	): void {
		logger.info(`[Security] ${event}`, details);
	}
}

export const securityService = new SecurityService();