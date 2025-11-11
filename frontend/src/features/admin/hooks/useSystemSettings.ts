/**
 * React hook for system settings management
 * 
 * Provides reactive state management for system settings with:
 * - Automatic loading and caching
 * - Optimistic updates
 * - Error handling
 * - Change notifications
 * - Loading states
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { systemSettingsService } from "../services/systemSettings.service";
import { errorHandlingService } from "@/shared/services/errorHandling.service";
import { logger } from "@/shared/services/logger.service";
import type {
  SystemSettings,
  SystemSettingsUpdateRequest,
  SettingsChangeNotification
} from "../types/settings.types";

interface UseSystemSettingsOptions {
  autoLoad?: boolean;
  enableChangeNotifications?: boolean;
  onSettingsChange?: (notification: SettingsChangeNotification) => void;
  onError?: (error: string) => void;
}

interface UseSystemSettingsReturn {
  // Data
  settings: SystemSettings | null;
  
  // Loading states
  isLoading: boolean;
  isUpdating: boolean;
  isValidating: boolean;
  
  // Error states
  error: string | null;
  validationErrors: Record<string, string>;
  
  // Actions
  loadSettings: (forceRefresh?: boolean) => Promise<boolean>;
  updateSettings: (updates: SystemSettingsUpdateRequest) => Promise<boolean>;
  updateSetting: (field: keyof SystemSettingsUpdateRequest, value: any) => Promise<boolean>;
  validateSettings: (settings: Partial<SystemSettings>) => {
    isValid: boolean;
    errors: string[];
    fieldErrors: Record<string, string>;
  };
  clearError: () => void;
  invalidateCache: () => void;
  
  // Cache info
  cacheStatus: {
    isCached: boolean;
    isValid: boolean;
    lastFetched: number | null;
    version: number;
    optimisticUpdates: number;
    isRateLimited: boolean;
    rateLimitedUntil: number;
    consecutiveRateLimits: number;
  };
  
  // Circuit breaker control
  resetCircuitBreaker: () => void;
}

export function useSystemSettings(options: UseSystemSettingsOptions = {}): UseSystemSettingsReturn {
  const {
    autoLoad = true,
    enableChangeNotifications = true,
    onSettingsChange,
    onError
  } = options;

  // State
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Refs for cleanup
  const changeListenerRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  // Load settings from service
  const loadSettings = useCallback(async (forceRefresh = false): Promise<boolean> => {
    if (!mountedRef.current) return false;

    try {
      setIsLoading(true);
      setError(null);

      logger.debug("Starting to load settings", { forceRefresh });

      const result = await systemSettingsService.getSettings({ forceRefresh });

      if (!mountedRef.current) return false;

      logger.debug("Settings service result", { success: result.success, error: result.error });

      if (result.success) {

        setSettings(result.data);
        logger.debug("Settings loaded successfully", {
          cached: result.metadata?.cached,
          duration: result.metadata?.duration,
          settingsData: result.data,
          hasSettings: !!result.data
        });
        return true;
      } else {
        const errorMessage = result.error || "Failed to load settings";
        setError(errorMessage);
        onError?.(errorMessage);
        logger.error("Settings loading failed", { error: errorMessage });
        return false;
      }
    } catch (error: any) {
      if (!mountedRef.current) return false;

      const errorMessage = error.message || "Failed to load settings";
      setError(errorMessage);
      onError?.(errorMessage);
      
      logger.error("Settings loading exception", { error: errorMessage, stack: error.stack });
      
      errorHandlingService.handleError(error, {
        action: "load_settings",
        component: "useSystemSettings"
      });
      
      return false;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [onError]);

  // Update settings
  const updateSettings = useCallback(async (updates: SystemSettingsUpdateRequest): Promise<boolean> => {
    if (!mountedRef.current) return false;

    try {
      setIsUpdating(true);
      setError(null);
      setValidationErrors({});

      // First validate on client side
      const validation = systemSettingsService.validateSettings(updates);
      if (!validation.isValid) {
        setValidationErrors(validation.fieldErrors);
        setError("Please fix validation errors");
        return false;
      }

      const result = await systemSettingsService.updateSettings(updates, {
        skipValidation: true // Already validated above
      });

      if (!mountedRef.current) return false;

      if (result.success) {
        setSettings(result.data);
        logger.debug("Settings updated successfully", {
          updatedFields: Object.keys(updates),
          duration: result.metadata?.duration
        });
        return true;
      } else {
        const errorMessage = result.error || "Failed to update settings";
        setError(errorMessage);
        onError?.(errorMessage);
        return false;
      }
    } catch (error: any) {
      if (!mountedRef.current) return false;

      const errorMessage = error.message || "Failed to update settings";
      setError(errorMessage);
      onError?.(errorMessage);
      
      errorHandlingService.handleError(error, {
        action: "update_settings",
        component: "useSystemSettings",
        data: updates
      });
      
      return false;
    } finally {
      if (mountedRef.current) {
        setIsUpdating(false);
      }
    }
  }, [onError]);

  // Update single setting
  const updateSetting = useCallback(async (
    field: keyof SystemSettingsUpdateRequest,
    value: any
  ): Promise<boolean> => {
    return updateSettings({ [field]: value });
  }, [updateSettings]);

  // Validate settings
  const validateSettings = useCallback((settingsToValidate: Partial<SystemSettings>) => {
    setIsValidating(true);
    
    try {
      const result = systemSettingsService.validateSettings(settingsToValidate);
      setValidationErrors(result.fieldErrors);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
    setValidationErrors({});
  }, []);

  // Invalidate cache
  const invalidateCache = useCallback(() => {
    systemSettingsService.invalidateCache();
  }, []);

  // Get cache status
  const cacheStatus = systemSettingsService.getCacheStatus();

  // Reset circuit breaker
  const resetCircuitBreaker = useCallback(() => {
    systemSettingsService.resetCircuitBreaker();
  }, []);

  // Setup change notifications
  useEffect(() => {
    if (!enableChangeNotifications) return;

    const unsubscribe = systemSettingsService.onSettingsChange((notification) => {
      if (!mountedRef.current) return;

      logger.debug("Settings change notification received", {
        field: notification.field,
        oldValue: notification.oldValue,
        newValue: notification.newValue
      });

      onSettingsChange?.(notification);
    });

    changeListenerRef.current = unsubscribe;

    return () => {
      unsubscribe();
      changeListenerRef.current = null;
    };
  }, [enableChangeNotifications, onSettingsChange]);

  // Auto-load settings on mount with safeguards
  useEffect(() => {
    // Only auto-load once, with multiple safety checks
    if (autoLoad && !settings && !isLoading && !error && cacheStatus.consecutiveRateLimits === 0) {
      logger.debug("Auto-loading settings with safeguards");
      loadSettings();
    }
  }, [autoLoad]); // Only depend on autoLoad to prevent re-runs

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      changeListenerRef.current?.();
    };
  }, []);



  return {
    // Data
    settings,
    
    // Loading states
    isLoading,
    isUpdating,
    isValidating,
    
    // Error states
    error,
    validationErrors,
    
    // Actions
    loadSettings,
    updateSettings,
    updateSetting,
    validateSettings,
    clearError,
    invalidateCache,
    
    // Cache info
    cacheStatus,
    
    // Circuit breaker control
    resetCircuitBreaker
  };
}

// Convenience hook for read-only access
export function useSystemSettingsReadOnly() {
  const { settings, isLoading, error, loadSettings } = useSystemSettings({
    autoLoad: true,
    enableChangeNotifications: false
  });

  return {
    settings,
    isLoading,
    error,
    refresh: loadSettings
  };
}