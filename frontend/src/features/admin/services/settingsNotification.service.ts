/**
 * Settings Change Notification Service
 * 
 * Handles notifications for system settings changes with:
 * - Toast notifications for user feedback
 * - Change history tracking
 * - Environment-specific messaging
 * - Audit trail integration
 */

import { toast } from "sonner";
import { logger } from "@/shared/services/logger.service";
import type {
  SettingsChangeNotification,
  SystemSettings,
  SettingsAuditUser
} from "../types/settings.types";
import {
  getFieldDisplayName,
  formatCurrency,
  formatPercentage,
  isPricingField,
  isPercentageField
} from "../utils/settingsValidation.utils";

// Notification configuration
interface NotificationConfig {
  showToasts: boolean;
  trackHistory: boolean;
  maxHistoryEntries: number;
  criticalFieldsOnly: boolean;
}

// Change history entry
interface ChangeHistoryEntry extends SettingsChangeNotification {
  id: string;
  environment: string;
  isCritical: boolean;
  formattedOldValue: string;
  formattedNewValue: string;
}

// Default configuration
const DEFAULT_CONFIG: NotificationConfig = {
  showToasts: true,
  trackHistory: true,
  maxHistoryEntries: 100,
  criticalFieldsOnly: false
};

class SettingsNotificationService {
  private config: NotificationConfig;
  private changeHistory: ChangeHistoryEntry[] = [];
  private listeners: Set<(entry: ChangeHistoryEntry) => void> = new Set();

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Handle a settings change notification
   */
  handleSettingsChange(
    notification: SettingsChangeNotification,
    environment: string,
    _settings?: SystemSettings
  ): void {
    try {
      const isCritical = this.isCriticalChange(notification);
      
      // Skip non-critical changes if configured to do so
      if (this.config.criticalFieldsOnly && !isCritical) {
        return;
      }

      // Create history entry
      const historyEntry: ChangeHistoryEntry = {
        ...notification,
        id: this.generateChangeId(),
        environment,
        isCritical,
        formattedOldValue: this.formatValue(notification.field, notification.oldValue),
        formattedNewValue: this.formatValue(notification.field, notification.newValue)
      };

      // Add to history
      if (this.config.trackHistory) {
        this.addToHistory(historyEntry);
      }

      // Show toast notification
      if (this.config.showToasts) {
        this.showChangeToast(historyEntry, environment);
      }

      // Notify listeners
      this.notifyListeners(historyEntry);

      // Log the change
      this.logChange(historyEntry);

    } catch (error) {
      logger.error("Error handling settings change notification", { error, notification });
    }
  }

  /**
   * Show success notification for settings update
   */
  showUpdateSuccess(
    updatedFields: string[],
    environment: string,
    user?: SettingsAuditUser
  ): void {
    const fieldCount = updatedFields.length;
    const fieldNames = updatedFields.map(field => getFieldDisplayName(field));
    
    let message: string;
    if (fieldCount === 1) {
      message = `${fieldNames[0]} updated successfully`;
    } else if (fieldCount <= 3) {
      message = `${fieldNames.join(", ")} updated successfully`;
    } else {
      message = `${fieldCount} settings updated successfully`;
    }

    // Add environment context for production
    if (environment.toLowerCase() === 'production') {
      message += " (Production)";
    }

    toast.success(message, {
      duration: 4000,
      description: user ? `Updated by ${this.getUserDisplayName(user)}` : undefined
    });

    logger.info("Settings update success notification shown", {
      updatedFields,
      environment,
      user: user?.email
    });
  }

  /**
   * Show error notification for settings update
   */
  showUpdateError(
    error: string,
    failedFields?: string[],
    environment?: string
  ): void {
    let message = "Failed to update settings";
    
    if (failedFields && failedFields.length > 0) {
      const fieldNames = failedFields.map(field => getFieldDisplayName(field));
      if (fieldNames.length === 1) {
        message = `Failed to update ${fieldNames[0]}`;
      } else {
        message = `Failed to update ${fieldNames.length} settings`;
      }
    }

    toast.error(message, {
      duration: 6000,
      description: error,
      action: {
        label: "Retry",
        onClick: () => {
          // This would trigger a retry - implementation depends on context
          logger.debug("Settings update retry requested");
        }
      }
    });

    logger.warn("Settings update error notification shown", {
      error,
      failedFields,
      environment
    });
  }

  /**
   * Show validation error notification
   */
  showValidationError(
    fieldErrors: Record<string, string>,
    environment?: string
  ): void {
    const errorCount = Object.keys(fieldErrors).length;
    const firstError = Object.values(fieldErrors)[0];
    
    let message: string;
    if (errorCount === 1) {
      message = "Please fix the validation error";
    } else {
      message = `Please fix ${errorCount} validation errors`;
    }

    toast.warning(message, {
      duration: 5000,
      description: firstError
    });

    logger.debug("Settings validation error notification shown", {
      fieldErrors,
      environment
    });
  }

  /**
   * Show environment-specific warning
   */
  showEnvironmentWarning(
    environment: string,
    action: string,
    details?: string
  ): void {
    const envLower = environment.toLowerCase();
    
    if (envLower === 'production') {
      toast.warning(`Production ${action}`, {
        duration: 8000,
        description: details || "Changes will affect live operations immediately"
      });
    } else if (envLower === 'staging') {
      toast.info(`Staging ${action}`, {
        duration: 4000,
        description: details || "Safe testing environment"
      });
    }

    logger.info("Environment warning shown", { environment, action, details });
  }

  /**
   * Get change history
   */
  getChangeHistory(options: {
    limit?: number;
    criticalOnly?: boolean;
    field?: string;
    since?: Date;
  } = {}): ChangeHistoryEntry[] {
    let history = [...this.changeHistory];

    // Filter by critical changes
    if (options.criticalOnly) {
      history = history.filter(entry => entry.isCritical);
    }

    // Filter by field
    if (options.field) {
      history = history.filter(entry => entry.field === options.field);
    }

    // Filter by date
    if (options.since) {
      const sinceTime = options.since.getTime();
      history = history.filter(entry => new Date(entry.timestamp).getTime() >= sinceTime);
    }

    // Apply limit
    if (options.limit) {
      history = history.slice(0, options.limit);
    }

    return history;
  }

  /**
   * Subscribe to change notifications
   */
  onChangeNotification(callback: (entry: ChangeHistoryEntry) => void): () => void {
    this.listeners.add(callback);
    
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Clear change history
   */
  clearHistory(): void {
    this.changeHistory = [];
    logger.debug("Settings change history cleared");
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    logger.debug("Settings notification config updated", { config: this.config });
  }

  // Private helper methods

  private isCriticalChange(notification: SettingsChangeNotification): boolean {
    //   oldValue: notification.oldValue,
    //   newValue: notification.newValue
    // };

    // Check for significant pricing changes (>20% change)
    if (isPricingField(notification.field)) {
      const oldValue = parseFloat(notification.oldValue);
      const newValue = parseFloat(notification.newValue);
      
      if (!isNaN(oldValue) && !isNaN(newValue) && oldValue > 0) {
        const percentChange = Math.abs((newValue - oldValue) / oldValue);
        return percentChange > 0.2; // 20% change threshold
      }
    }

    // Critical fields
    const criticalFields = [
      'send_emails_to_self',
      'forward_certificate_emails_to',
      'tax_percentage'
    ];

    return criticalFields.includes(notification.field);
  }

  private formatValue(field: string, value: string): string {
    if (isPricingField(field)) {
      return `$${formatCurrency(value, field === 'cost_per_kilometer_fuel' ? 3 : 2)}`;
    }

    if (isPercentageField(field)) {
      return formatPercentage(value);
    }

    if (field === 'send_emails_to_self') {
      return value === 'true' ? 'Send to Admin' : 'Send to Recipients';
    }

    return value;
  }

  private showChangeToast(entry: ChangeHistoryEntry, environment: string): void {
    const fieldName = getFieldDisplayName(entry.field);
    const message = `${fieldName} changed`;
    const description = `${entry.formattedOldValue} → ${entry.formattedNewValue}`;

    if (entry.isCritical) {
      toast.warning(message, {
        duration: 6000,
        description,
        action: environment.toLowerCase() === 'production' ? {
          label: "View Details",
          onClick: () => {
            logger.debug("Critical change details requested", { entry });
          }
        } : undefined
      });
    } else {
      toast.info(message, {
        duration: 3000,
        description
      });
    }
  }

  private addToHistory(entry: ChangeHistoryEntry): void {
    this.changeHistory.unshift(entry);

    // Maintain history size limit
    if (this.changeHistory.length > this.config.maxHistoryEntries) {
      this.changeHistory = this.changeHistory.slice(0, this.config.maxHistoryEntries);
    }
  }

  private notifyListeners(entry: ChangeHistoryEntry): void {
    this.listeners.forEach(callback => {
      try {
        callback(entry);
      } catch (error) {
        logger.error("Error in change notification listener", { error });
      }
    });
  }

  private logChange(entry: ChangeHistoryEntry): void {
    const logLevel = entry.isCritical ? 'warn' : 'info';
    
    logger[logLevel]("Settings change notification", {
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
      user: entry.user.email,
      environment: entry.environment,
      isCritical: entry.isCritical,
      timestamp: entry.timestamp
    });
  }

  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUserDisplayName(user: SettingsAuditUser): string {
    if (user.email) {
      return user.email;
    }
    if (user.first_name || user.last_name) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    }
    return `User ${user.id}`;
  }
}

// Export singleton instance
export const settingsNotificationService = new SettingsNotificationService();

// Export class for testing or custom configurations
export { SettingsNotificationService };