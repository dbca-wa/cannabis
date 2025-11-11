/**
 * Comprehensive error handling service for the frontend
 * Provides centralized error handling, toast notifications, and offline support
 */

import { toast } from "sonner";
import { logger } from "./logger.service";
import { normalizeError, getErrorMessage, isApiError } from "@/shared/utils/error.utils";
import type { ServiceResult } from "@/shared/types/backend-api.types";

// Error severity levels
export type ErrorSeverity = "low" | "medium" | "high" | "critical";

// Error categories for better handling
export type ErrorCategory = 
  | "authentication"
  | "authorization" 
  | "validation"
  | "network"
  | "server"
  | "invitation"
  | "password"
  | "unknown";

// Error context for better debugging
export interface ErrorContext {
  userId?: string | number;
  action?: string;
  component?: string;
  requestId?: string;
  timestamp?: string;
  userAgent?: string;
  url?: string;
  [key: string]: unknown;
}

// Enhanced error information
export interface EnhancedError {
  message: string;
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  originalError: unknown;
  isRetryable: boolean;
  userFriendlyMessage: string;
  suggestedActions: string[];
}

// Toast notification options
export interface ToastOptions {
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
}

class ErrorHandlingService {
  private isOnline = navigator.onLine;
  private offlineQueue: Array<() => Promise<void>> = [];

  constructor() {
    this.setupNetworkListeners();
  }

  /**
   * Setup network status listeners for offline handling
   */
  private setupNetworkListeners(): void {
    window.addEventListener("online", () => {
      this.isOnline = true;
      this.processOfflineQueue();
      this.showNetworkStatusToast("back_online");
    });

    window.addEventListener("offline", () => {
      this.isOnline = false;
      this.showNetworkStatusToast("offline");
    });
  }

  /**
   * Process queued operations when back online
   */
  private async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return;

    logger.info("Processing offline queue", { queueLength: this.offlineQueue.length });

    const operations = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const operation of operations) {
      try {
        await operation();
      } catch (error) {
        logger.error("Failed to process offline operation", { error });
      }
    }
  }

  /**
   * Show network status toast notifications
   */
  private showNetworkStatusToast(status: "offline" | "back_online"): void {
    if (status === "offline") {
      toast.warning("You're offline. Some features may not work.", {
        duration: 5000,
        id: "network-status"
      });
    } else {
      toast.success("You're back online!", {
        duration: 3000,
        id: "network-status"
      });
    }
  }

  /**
   * Categorize error based on error code and message
   */
  private categorizeError(error: unknown): ErrorCategory {
    const normalizedError = normalizeError(error);
    const code = normalizedError.code.toLowerCase();
    const message = normalizedError.message.toLowerCase();

    // Authentication errors
    if (code.includes("401") || code.includes("unauthorized") || 
        message.includes("authentication") || message.includes("login")) {
      return "authentication";
    }

    // Authorization errors
    if (code.includes("403") || code.includes("forbidden") || 
        message.includes("permission") || message.includes("authorized")) {
      return "authorization";
    }

    // Validation errors
    if (code.includes("400") || code.includes("validation") || 
        message.includes("validation") || message.includes("invalid")) {
      return "validation";
    }

    // Network errors
    if (code.includes("network") || code.includes("timeout") || 
        message.includes("network") || message.includes("connection")) {
      return "network";
    }

    // Server errors
    if (code.includes("500") || code.includes("502") || code.includes("503") || 
        message.includes("server") || message.includes("internal")) {
      return "server";
    }

    // Invitation-specific errors
    if (message.includes("invitation") || message.includes("invite") || 
        message.includes("token") || message.includes("expired")) {
      return "invitation";
    }

    // Password-specific errors
    if (message.includes("password") || message.includes("weak") || 
        message.includes("strength")) {
      return "password";
    }

    return "unknown";
  }

  /**
   * Determine error severity
   */
  private determineSeverity(category: ErrorCategory, error: unknown): ErrorSeverity {
    const normalizedError = normalizeError(error);
    const code = normalizedError.code;

    switch (category) {
      case "authentication":
      case "authorization":
        return "high";
      
      case "server":
        return code.includes("500") ? "critical" : "high";
      
      case "network":
        return this.isOnline ? "medium" : "high";
      
      case "validation":
      case "password":
        return "medium";
      
      case "invitation":
        return "medium";
      
      default:
        return "low";
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(category: ErrorCategory, error: unknown): boolean {
    const normalizedError = normalizeError(error);
    const code = normalizedError.code;

    // Network errors are usually retryable
    if (category === "network") return true;

    // Some server errors are retryable
    if (category === "server") {
      return code.includes("502") || code.includes("503") || code.includes("504");
    }

    // Authentication errors might be retryable if token refresh is possible
    if (category === "authentication") {
      return code.includes("401");
    }

    return false;
  }

  /**
   * Generate user-friendly error messages
   */
  private generateUserFriendlyMessage(category: ErrorCategory, error: unknown): string {
    const normalizedError = normalizeError(error);

    switch (category) {
      case "authentication":
        return "Your session has expired. Please log in again.";
      
      case "authorization":
        return "You don't have permission to perform this action.";
      
      case "validation":
        return "Please check your input and try again.";
      
      case "network":
        return this.isOnline 
          ? "Network connection failed. Please try again."
          : "You're offline. Please check your internet connection.";
      
      case "server":
        return "Something went wrong on our end. Please try again later.";
      
      case "invitation":
        if (normalizedError.message.includes("expired")) {
          return "This invitation link has expired. Please request a new one.";
        }
        if (normalizedError.message.includes("used")) {
          return "This invitation link has already been used.";
        }
        return "There's an issue with this invitation. Please contact an administrator.";
      
      case "password":
        return "Please check your password requirements and try again.";
      
      default:
        return normalizedError.message || "An unexpected error occurred.";
    }
  }

  /**
   * Generate suggested actions for error recovery
   */
  private generateSuggestedActions(category: ErrorCategory, isRetryable: boolean): string[] {
    const actions: string[] = [];

    switch (category) {
      case "authentication":
        actions.push("Log in again", "Clear browser cache if the problem persists");
        break;
      
      case "authorization":
        actions.push("Contact an administrator for access", "Check if you're using the correct account");
        break;
      
      case "validation":
        actions.push("Review the form for errors", "Check required fields");
        break;
      
      case "network":
        if (!this.isOnline) {
          actions.push("Check your internet connection", "Try again when back online");
        } else {
          actions.push("Check your internet connection", "Try again in a moment");
        }
        break;
      
      case "server":
        actions.push("Try again in a few minutes", "Contact support if the problem persists");
        break;
      
      case "invitation":
        actions.push("Request a new invitation", "Contact the person who invited you");
        break;
      
      case "password":
        actions.push("Check password requirements", "Use a stronger password");
        break;
      
      default:
        if (isRetryable) {
          actions.push("Try again");
        }
        actions.push("Contact support if the problem persists");
    }

    return actions;
  }

  /**
   * Create enhanced error object with all context
   */
  private createEnhancedError(error: unknown, context: ErrorContext = {}): EnhancedError {
    const normalizedError = normalizeError(error);
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(category, error);
    const isRetryable = this.isRetryableError(category, error);
    const userFriendlyMessage = this.generateUserFriendlyMessage(category, error);
    const suggestedActions = this.generateSuggestedActions(category, isRetryable);

    const enhancedContext: ErrorContext = {
      ...context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      isOnline: this.isOnline
    };

    return {
      message: normalizedError.message,
      code: normalizedError.code,
      category,
      severity,
      context: enhancedContext,
      originalError: error,
      isRetryable,
      userFriendlyMessage,
      suggestedActions
    };
  }

  /**
   * Handle error with comprehensive logging and user notification
   */
  public handleError(
    error: unknown, 
    context: ErrorContext = {},
    options: {
      showToast?: boolean;
      toastOptions?: ToastOptions;
      logLevel?: "debug" | "info" | "warn" | "error";
    } = {}
  ): EnhancedError {
    const enhancedError = this.createEnhancedError(error, context);
    
    // Log the error with appropriate level
    const logLevel = options.logLevel || (enhancedError.severity === "critical" ? "error" : "warn");
    logger[logLevel]("Error handled by ErrorHandlingService", {
      category: enhancedError.category,
      severity: enhancedError.severity,
      message: enhancedError.message,
      code: enhancedError.code,
      context: enhancedError.context,
      isRetryable: enhancedError.isRetryable
    });

    // Show toast notification if requested
    if (options.showToast !== false) {
      this.showErrorToast(enhancedError, options.toastOptions);
    }

    return enhancedError;
  }

  /**
   * Show appropriate toast notification for error
   */
  private showErrorToast(enhancedError: EnhancedError, options: ToastOptions = {}): void {
    const defaultOptions: ToastOptions = {
      duration: enhancedError.severity === "critical" ? 10000 : 5000,
      dismissible: true
    };

    const toastOptions = { ...defaultOptions, ...options };

    // Choose toast type based on severity
    switch (enhancedError.severity) {
      case "critical":
        toast.error(enhancedError.userFriendlyMessage, {
          duration: toastOptions.duration,
          action: toastOptions.action,
          dismissible: toastOptions.dismissible
        });
        break;
      
      case "high":
        toast.error(enhancedError.userFriendlyMessage, {
          duration: toastOptions.duration,
          action: toastOptions.action,
          dismissible: toastOptions.dismissible
        });
        break;
      
      case "medium":
        toast.warning(enhancedError.userFriendlyMessage, {
          duration: toastOptions.duration,
          action: toastOptions.action,
          dismissible: toastOptions.dismissible
        });
        break;
      
      case "low":
        toast.info(enhancedError.userFriendlyMessage, {
          duration: toastOptions.duration,
          action: toastOptions.action,
          dismissible: toastOptions.dismissible
        });
        break;
    }
  }

  /**
   * Show success toast notification
   */
  public showSuccess(message: string, options: ToastOptions = {}): void {
    toast.success(message, {
      duration: options.duration || 3000,
      action: options.action,
      dismissible: options.dismissible !== false
    });
  }

  /**
   * Show info toast notification
   */
  public showInfo(message: string, options: ToastOptions = {}): void {
    toast.info(message, {
      duration: options.duration || 4000,
      action: options.action,
      dismissible: options.dismissible !== false
    });
  }

  /**
   * Show warning toast notification
   */
  public showWarning(message: string, options: ToastOptions = {}): void {
    toast.warning(message, {
      duration: options.duration || 5000,
      action: options.action,
      dismissible: options.dismissible !== false
    });
  }

  /**
   * Handle service result with automatic error handling
   */
  public handleServiceResult<T>(
    result: ServiceResult<T>,
    context: ErrorContext = {},
    options: {
      showSuccessToast?: boolean;
      successMessage?: string;
      showErrorToast?: boolean;
      errorToastOptions?: ToastOptions;
    } = {}
  ): ServiceResult<T> {
    if (result.success) {
      if (options.showSuccessToast && options.successMessage) {
        this.showSuccess(options.successMessage);
      }
    } else if (result.error) {
      this.handleError(new Error(result.error), context, {
        showToast: options.showErrorToast !== false,
        toastOptions: options.errorToastOptions
      });
    }

    return result;
  }

  /**
   * Queue operation for when back online
   */
  public queueForOnline(operation: () => Promise<void>): void {
    if (this.isOnline) {
      // Execute immediately if online
      operation().catch(error => {
        logger.error("Failed to execute queued operation", { error });
      });
    } else {
      // Queue for later
      this.offlineQueue.push(operation);
      logger.info("Operation queued for when back online", { 
        queueLength: this.offlineQueue.length 
      });
    }
  }

  /**
   * Check if currently online
   */
  public get online(): boolean {
    return this.isOnline;
  }

  /**
   * Get current offline queue length
   */
  public get queueLength(): number {
    return this.offlineQueue.length;
  }
}

// Export singleton instance
export const errorHandlingService = new ErrorHandlingService();

// Export convenience functions
export const handleError = (error: unknown, context?: ErrorContext) => 
  errorHandlingService.handleError(error, context);

export const showSuccess = (message: string, options?: ToastOptions) => 
  errorHandlingService.showSuccess(message, options);

export const showError = (message: string, options?: ToastOptions) => 
  errorHandlingService.showWarning(message, options);

export const showInfo = (message: string, options?: ToastOptions) => 
  errorHandlingService.showInfo(message, options);

export const handleServiceResult = <T>(result: ServiceResult<T>, context?: ErrorContext) =>
  errorHandlingService.handleServiceResult(result, context);