/**
 * System Settings Service
 * 
 * Provides comprehensive API interactions for system settings with:
 * - Caching strategy for performance
 * - Error handling and retry logic
 * - Optimistic updates for better UX
 * - Settings validation utilities
 * - Change notifications
 */

import { apiClient, ENDPOINTS } from "@/shared/services/api";
import { errorHandlingService } from "@/shared/services/errorHandling.service";
import { logger } from "@/shared/services/logger.service";
import type { ServiceResult } from "@/shared/types/backend-api.types";
import type {
  SystemSettings,
  SystemSettingsUpdateRequest,
  SettingsValidationError,
  SettingsChangeNotification,
  SettingsCacheMetadata,
  SettingsServiceConfig
} from "../types/settings.types";

// Default service configuration
const DEFAULT_CONFIG: SettingsServiceConfig = {
  cacheTimeout: 10 * 60 * 1000, // 10 minutes (increased to reduce API calls)
  retryAttempts: 1, // Very conservative - only 1 retry
  retryDelay: 2000, // 2 second base delay
  enableOptimisticUpdates: true,
  enableChangeNotifications: true
};

// Change notification callback type
type ChangeNotificationCallback = (notification: SettingsChangeNotification) => void;

class SystemSettingsService {
  private cache: SystemSettings | null = null;
  private cacheMetadata: SettingsCacheMetadata | null = null;
  private config: SettingsServiceConfig;
  private changeListeners: Set<ChangeNotificationCallback> = new Set();
  private optimisticUpdates: Map<string, any> = new Map();
  
  // Circuit breaker for rate limiting
  private rateLimitedUntil: number = 0;
  private consecutiveRateLimits: number = 0;
  
  // Request deduplication
  private pendingRequests: Map<string, Promise<ServiceResult<SystemSettings>>> = new Map();
  
  // Global request lock to prevent request storms
  private static globalRequestLock = false;

  constructor(config: Partial<SettingsServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get system settings with caching
   */
  async getSettings(options: {
    forceRefresh?: boolean;
    skipCache?: boolean;
  } = {}): Promise<ServiceResult<SystemSettings>> {
    try {
      // Check cache first unless force refresh or skip cache
      if (!options.forceRefresh && !options.skipCache && this.isCacheValid()) {
        logger.debug("Returning cached system settings");
        return {
          data: this.applyOptimisticUpdates(this.cache!),
          success: true,
          metadata: {
            cached: true,
            duration: 0
          }
        };
      }

      // Global request lock to prevent request storms
      if (SystemSettingsService.globalRequestLock) {
        logger.warn("Global request lock active, preventing duplicate request");
        if (this.cache) {
          return {
            data: this.applyOptimisticUpdates(this.cache),
            success: true,
            metadata: {
              cached: true,
              duration: 0
            }
          };
        }
        return {
          data: {} as SystemSettings,
          success: false,
          error: "Request already in progress"
        };
      }

      // Check if we're rate limited
      if (Date.now() < this.rateLimitedUntil) {
        const waitTime = Math.ceil((this.rateLimitedUntil - Date.now()) / 1000);
        logger.warn(`Settings service is rate limited, returning cached data if available`);
        
        if (this.cache) {
          return {
            data: this.applyOptimisticUpdates(this.cache),
            success: true,
            metadata: {
              cached: true,
              duration: 0
            }
          };
        }
        
        return {
          data: {} as SystemSettings,
          success: false,
          error: `Rate limited. Please wait ${waitTime} seconds before trying again.`
        };
      }

      // Request deduplication - check if there's already a pending request
      const requestKey = `get_settings_${options.forceRefresh ? 'force' : 'normal'}`;
      if (this.pendingRequests.has(requestKey)) {
        logger.debug("Returning existing pending request for settings");
        return this.pendingRequests.get(requestKey)!;
      }

      const startTime = Date.now();
      logger.debug("Fetching system settings from API", {
        forceRefresh: options.forceRefresh,
        skipCache: options.skipCache,
        cacheValid: this.isCacheValid(),
        rateLimited: Date.now() < this.rateLimitedUntil,
        pendingRequests: this.pendingRequests.size,
        globalLock: SystemSettingsService.globalRequestLock
      });

      // Set global lock
      SystemSettingsService.globalRequestLock = true;

      // Create the request promise and store it for deduplication
      const requestPromise = this.makeApiCall<SystemSettings>(
        () => {
          logger.debug("Making API call", { endpoint: ENDPOINTS.SYSTEM.SETTINGS });
          return apiClient.get(ENDPOINTS.SYSTEM.SETTINGS);
        },
        "fetch_settings"
      );

      this.pendingRequests.set(requestKey, requestPromise);

      const response = await requestPromise;

      // Clean up pending request and global lock
      this.pendingRequests.delete(requestKey);
      SystemSettingsService.globalRequestLock = false;

      if (response.success) {


        // Update cache
        this.cache = response.data;
        this.cacheMetadata = {
          lastFetched: Date.now(),
          version: (this.cacheMetadata?.version || 0) + 1
        };

        // Clear optimistic updates on successful fetch
        this.optimisticUpdates.clear();

        logger.info("System settings fetched successfully", {
          cacheVersion: this.cacheMetadata.version,
          duration: Date.now() - startTime
        });

        const result = {
          ...response,
          metadata: {
            ...response.metadata,
            duration: Date.now() - startTime,
            cached: false
          }
        };



        return result;
      }

      return response;
    } catch (error) {
      // Clean up pending request and global lock on error
      const requestKey = `get_settings_${options.forceRefresh ? 'force' : 'normal'}`;
      this.pendingRequests.delete(requestKey);
      SystemSettingsService.globalRequestLock = false;
      
      return this.handleServiceError(error, "getSettings");
    }
  }

  /**
   * Update system settings with optimistic updates and validation
   */
  async updateSettings(
    updates: SystemSettingsUpdateRequest,
    options: {
      skipOptimistic?: boolean;
      skipValidation?: boolean;
    } = {}
  ): Promise<ServiceResult<SystemSettings>> {
    try {
      const startTime = Date.now();
      
      // Client-side validation if enabled
      if (!options.skipValidation) {
        const validationResult = this.validateSettings(updates);
        if (!validationResult.isValid) {
          return {
            data: {} as SystemSettings,
            success: false,
            error: validationResult.errors.join("; ")
          };
        }
      }

      // Apply optimistic updates if enabled
      if (this.config.enableOptimisticUpdates && !options.skipOptimistic) {
        this.applyOptimisticUpdate(updates);
      }

      logger.debug("Updating system settings", { updates });

      const response = await this.makeApiCall<SystemSettings>(
        () => apiClient.patch(ENDPOINTS.SYSTEM.SETTINGS, updates),
        "update_settings"
      );

      if (response.success) {
        // Update cache with new data
        const oldSettings = this.cache;
        this.cache = response.data;
        this.cacheMetadata = {
          lastFetched: Date.now(),
          version: (this.cacheMetadata?.version || 0) + 1
        };

        // Clear optimistic updates
        this.optimisticUpdates.clear();

        // Notify change listeners
        if (this.config.enableChangeNotifications && oldSettings) {
          this.notifyChanges(oldSettings, response.data);
        }

        logger.info("System settings updated successfully", {
          updatedFields: Object.keys(updates),
          cacheVersion: this.cacheMetadata.version,
          duration: Date.now() - startTime
        });

        return {
          ...response,
          metadata: {
            ...response.metadata,
            duration: Date.now() - startTime
          }
        };
      } else {
        // Rollback optimistic updates on failure
        if (this.config.enableOptimisticUpdates && !options.skipOptimistic) {
          this.rollbackOptimisticUpdates(Object.keys(updates));
        }
      }

      return response;
    } catch (error) {
      // Rollback optimistic updates on error
      if (this.config.enableOptimisticUpdates && !options.skipOptimistic) {
        this.rollbackOptimisticUpdates(Object.keys(updates));
      }
      
      return this.handleServiceError(error, "updateSettings");
    }
  }

  /**
   * Update a single setting field
   */
  async updateSetting(
    field: keyof SystemSettingsUpdateRequest,
    value: any,
    options: {
      skipOptimistic?: boolean;
      skipValidation?: boolean;
    } = {}
  ): Promise<ServiceResult<SystemSettings>> {
    return this.updateSettings({ [field]: value }, options);
  }

  /**
   * Validate settings data
   */
  validateSettings(settings: Partial<SystemSettings>): {
    isValid: boolean;
    errors: string[];
    fieldErrors: Record<string, string>;
  } {
    const errors: string[] = [];
    const fieldErrors: Record<string, string> = {};

    // Validate pricing fields
    const pricingFields = [
      'cost_per_certificate',
      'cost_per_bag', 
      'call_out_fee',
      'cost_per_forensic_hour'
    ];

    pricingFields.forEach(field => {
      if (field in settings) {
        const value = settings[field as keyof SystemSettings];
        const validation = this.validatePricingField(field, value as string);
        if (!validation.isValid) {
          errors.push(validation.error);
          fieldErrors[field] = validation.error;
        }
      }
    });

    // Validate fuel cost (3 decimal places)
    if ('cost_per_kilometer_fuel' in settings) {
      const validation = this.validateFuelCost(settings.cost_per_kilometer_fuel as string);
      if (!validation.isValid) {
        errors.push(validation.error);
        fieldErrors.cost_per_kilometer_fuel = validation.error;
      }
    }

    // Validate tax percentage
    if ('tax_percentage' in settings) {
      const validation = this.validateTaxPercentage(settings.tax_percentage as string);
      if (!validation.isValid) {
        errors.push(validation.error);
        fieldErrors.tax_percentage = validation.error;
      }
    }

    // Validate email
    if ('forward_certificate_emails_to' in settings) {
      const validation = this.validateEmail(settings.forward_certificate_emails_to as string);
      if (!validation.isValid) {
        errors.push(validation.error);
        fieldErrors.forward_certificate_emails_to = validation.error;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      fieldErrors
    };
  }

  /**
   * Subscribe to settings change notifications
   */
  onSettingsChange(callback: ChangeNotificationCallback): () => void {
    this.changeListeners.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  /**
   * Clear cache and force refresh on next request
   */
  invalidateCache(): void {
    this.cache = null;
    this.cacheMetadata = null;
    this.optimisticUpdates.clear();
    logger.debug("System settings cache invalidated");
  }

  /**
   * Get cache status information
   */
  getCacheStatus(): {
    isCached: boolean;
    isValid: boolean;
    lastFetched: number | null;
    version: number;
    optimisticUpdates: number;
    isRateLimited: boolean;
    rateLimitedUntil: number;
    consecutiveRateLimits: number;
  } {
    return {
      isCached: this.cache !== null,
      isValid: this.isCacheValid(),
      lastFetched: this.cacheMetadata?.lastFetched || null,
      version: this.cacheMetadata?.version || 0,
      optimisticUpdates: this.optimisticUpdates.size,
      isRateLimited: Date.now() < this.rateLimitedUntil,
      rateLimitedUntil: this.rateLimitedUntil,
      consecutiveRateLimits: this.consecutiveRateLimits
    };
  }

  /**
   * Reset circuit breaker (for manual recovery)
   */
  resetCircuitBreaker(): void {
    this.consecutiveRateLimits = 0;
    this.rateLimitedUntil = 0;
    this.pendingRequests.clear();
    SystemSettingsService.globalRequestLock = false;
    logger.info("Settings service circuit breaker reset manually");
  }

  // Private helper methods

  private isCacheValid(): boolean {
    if (!this.cache || !this.cacheMetadata) {
      return false;
    }

    const age = Date.now() - this.cacheMetadata.lastFetched;
    return age < this.config.cacheTimeout;
  }

  private applyOptimisticUpdates(settings: SystemSettings): SystemSettings {
    if (this.optimisticUpdates.size === 0) {
      return settings;
    }

    const updated = { ...settings };
    for (const [field, value] of this.optimisticUpdates) {
      (updated as any)[field] = value;
    }

    return updated;
  }

  private applyOptimisticUpdate(updates: SystemSettingsUpdateRequest): void {
    for (const [field, value] of Object.entries(updates)) {
      this.optimisticUpdates.set(field, value);
    }
  }

  private rollbackOptimisticUpdates(fields: string[]): void {
    fields.forEach(field => {
      this.optimisticUpdates.delete(field);
    });
  }

  private async makeApiCall<T>(
    apiCall: () => Promise<any>,
    operation: string
  ): Promise<ServiceResult<T>> {
    // Check circuit breaker - if we're rate limited, don't make the call
    if (Date.now() < this.rateLimitedUntil) {
      const waitTime = Math.ceil((this.rateLimitedUntil - Date.now()) / 1000);
      logger.warn(`Circuit breaker active for ${operation}, rate limited for ${waitTime} more seconds`);
      return {
        data: {} as T,
        success: false,
        error: `Rate limited. Please wait ${waitTime} seconds before trying again.`
      };
    }

    let lastError: any;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await apiCall();
        

        
        // Reset circuit breaker on successful call
        this.consecutiveRateLimits = 0;
        this.rateLimitedUntil = 0;
        
        return {
          data: response, // apiClient.get returns data directly, not wrapped
          success: true
        };
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        
        // Handle rate limiting (429)
        if (status === 429) {
          this.consecutiveRateLimits++;
          
          // Extract retry-after header or use exponential backoff
          const retryAfter = error.response?.headers?.['retry-after'];
          let waitTime = 60; // Default 1 minute
          
          if (retryAfter) {
            waitTime = parseInt(retryAfter, 10) || 60;
          } else {
            // Exponential backoff based on consecutive rate limits
            waitTime = Math.min(60 * Math.pow(2, this.consecutiveRateLimits - 1), 300); // Max 5 minutes
          }
          
          this.rateLimitedUntil = Date.now() + (waitTime * 1000);
          
          logger.warn(`Rate limit hit for ${operation}, circuit breaker active for ${waitTime} seconds`, {
            error: error.message,
            status,
            consecutiveRateLimits: this.consecutiveRateLimits,
            waitTime
          });
          break;
        }
        
        // Don't retry on other client errors (4xx) except for specific cases
        if (status >= 400 && status < 500) {
          // Other 4xx errors (validation, auth, etc.) - don't retry
          if (status !== 408) { // 408 Request Timeout can be retried
            break;
          }
        }

        // Don't wait on the last attempt
        if (attempt < this.config.retryAttempts) {
          // Use exponential backoff for server errors, but not for rate limits
          const delay = status === 429 ? 0 : this.config.retryDelay * Math.pow(2, attempt - 1);
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        logger.warn(`API call attempt ${attempt} failed for ${operation}`, {
          error: error.message,
          status,
          willRetry: attempt < this.config.retryAttempts && status !== 429
        });
      }
    }

    // Handle final error
    if (lastError.response?.status === 400 && lastError.response?.data?.errors) {
      // Validation error from backend
      const validationError = lastError.response.data as SettingsValidationError;
      return {
        data: {} as T,
        success: false,
        error: validationError.message
      };
    }

    return {
      data: {} as T,
      success: false,
      error: lastError.message || "Unknown error occurred"
    };
  }

  private handleServiceError(error: any, operation: string): ServiceResult<SystemSettings> {
    const enhancedError = errorHandlingService.handleError(error, {
      action: operation,
      component: "SystemSettingsService"
    }, {
      showToast: false // Let the calling component handle UI feedback
    });

    return {
      data: {} as SystemSettings,
      success: false,
      error: enhancedError.userFriendlyMessage
    };
  }

  private notifyChanges(oldSettings: SystemSettings, newSettings: SystemSettings): void {
    const changes: SettingsChangeNotification[] = [];
    
    // Compare all fields and create notifications for changes
    const fields: (keyof SystemSettings)[] = [
      'cost_per_certificate',
      'cost_per_bag',
      'call_out_fee', 
      'cost_per_forensic_hour',
      'cost_per_kilometer_fuel',
      'tax_percentage',
      'forward_certificate_emails_to',
      'send_emails_to_self'
    ];

    fields.forEach(field => {
      if (oldSettings[field] !== newSettings[field]) {
        changes.push({
          field: field as string,
          oldValue: String(oldSettings[field]),
          newValue: String(newSettings[field]),
          timestamp: new Date().toISOString(),
          user: newSettings.last_modified_by || {
            id: 0,
            email: "unknown",
            first_name: null,
            last_name: null
          }
        });
      }
    });

    // Notify all listeners
    changes.forEach(change => {
      this.changeListeners.forEach(callback => {
        try {
          callback(change);
        } catch (error) {
          logger.error("Error in settings change listener", { error });
        }
      });
    });
  }

  // Validation helper methods

  private validatePricingField(field: string, value: string): { isValid: boolean; error: string } {
    if (!value || value.trim() === '') {
      return { isValid: false, error: `${this.getFieldDisplayName(field)} is required` };
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return { isValid: false, error: `${this.getFieldDisplayName(field)} must be a valid number` };
    }

    if (numValue <= 0) {
      return { isValid: false, error: `${this.getFieldDisplayName(field)} must be greater than 0` };
    }

    if (numValue > 999999.99) {
      return { isValid: false, error: `${this.getFieldDisplayName(field)} must not exceed $999,999.99` };
    }

    // Check decimal places (2 for pricing fields)
    const decimalPlaces = (value.split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      return { isValid: false, error: `${this.getFieldDisplayName(field)} can have at most 2 decimal places` };
    }

    return { isValid: true, error: '' };
  }

  private validateFuelCost(value: string): { isValid: boolean; error: string } {
    if (!value || value.trim() === '') {
      return { isValid: false, error: 'Fuel cost is required' };
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return { isValid: false, error: 'Fuel cost must be a valid number' };
    }

    if (numValue <= 0) {
      return { isValid: false, error: 'Fuel cost must be greater than 0' };
    }

    if (numValue > 9999.999) {
      return { isValid: false, error: 'Fuel cost must not exceed $9,999.999' };
    }

    // Check decimal places (3 for fuel cost)
    const decimalPlaces = (value.split('.')[1] || '').length;
    if (decimalPlaces > 3) {
      return { isValid: false, error: 'Fuel cost can have at most 3 decimal places' };
    }

    return { isValid: true, error: '' };
  }

  private validateTaxPercentage(value: string): { isValid: boolean; error: string } {
    if (!value || value.trim() === '') {
      return { isValid: false, error: 'Tax percentage is required' };
    }

    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      return { isValid: false, error: 'Tax percentage must be a valid number' };
    }

    if (numValue < 0) {
      return { isValid: false, error: 'Tax percentage cannot be negative' };
    }

    if (numValue > 100) {
      return { isValid: false, error: 'Tax percentage cannot exceed 100%' };
    }

    // Check decimal places (2 for percentage)
    const decimalPlaces = (value.split('.')[1] || '').length;
    if (decimalPlaces > 2) {
      return { isValid: false, error: 'Tax percentage can have at most 2 decimal places' };
    }

    return { isValid: true, error: '' };
  }

  private validateEmail(value: string): { isValid: boolean; error: string } {
    if (!value || value.trim() === '') {
      return { isValid: false, error: 'Admin email is required' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }

    if (value.length > 254) {
      return { isValid: false, error: 'Email address is too long (maximum 254 characters)' };
    }

    return { isValid: true, error: '' };
  }

  private getFieldDisplayName(field: string): string {
    const displayNames: Record<string, string> = {
      cost_per_certificate: 'Certificate cost',
      cost_per_bag: 'Bag identification cost',
      call_out_fee: 'Call out fee',
      cost_per_forensic_hour: 'Forensic hour cost',
      cost_per_kilometer_fuel: 'Fuel cost per kilometer',
      tax_percentage: 'Tax percentage',
      forward_certificate_emails_to: 'Admin email address',
      send_emails_to_self: 'Email routing mode'
    };

    return displayNames[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

// Global singleton instance to prevent multiple service instances across all modules
declare global {
  var __systemSettingsService: SystemSettingsService | undefined;
}

function getSystemSettingsService(): SystemSettingsService {
  if (!globalThis.__systemSettingsService) {
    globalThis.__systemSettingsService = new SystemSettingsService();
  }
  return globalThis.__systemSettingsService;
}

// Export singleton instance
export const systemSettingsService = getSystemSettingsService();

// Export class for testing or custom configurations
export { SystemSettingsService };