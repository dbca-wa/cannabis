/**
 * Settings validation utilities
 * 
 * Provides comprehensive validation functions for system settings
 * with detailed error messages and formatting helpers
 */

import type { SystemSettings, SystemSettingsUpdateRequest } from "../types/settings.types";

// Validation result interface
export interface ValidationResult {
  isValid: boolean;
  error: string;
  suggestion?: string;
}

// Field validation configuration
interface FieldValidationConfig {
  required: boolean;
  min?: number;
  max?: number;
  decimalPlaces?: number;
  fieldName: string;
  unit?: string;
}

// Validation configurations for each field
const FIELD_CONFIGS: Record<string, FieldValidationConfig> = {
  cost_per_certificate: {
    required: true,
    min: 0.01,
    max: 999999.99,
    decimalPlaces: 2,
    fieldName: "Certificate cost",
    unit: "$"
  },
  cost_per_bag: {
    required: true,
    min: 0.01,
    max: 999999.99,
    decimalPlaces: 2,
    fieldName: "Bag identification cost",
    unit: "$"
  },
  call_out_fee: {
    required: true,
    min: 0.01,
    max: 999999.99,
    decimalPlaces: 2,
    fieldName: "Call out fee",
    unit: "$"
  },
  cost_per_forensic_hour: {
    required: true,
    min: 0.01,
    max: 999999.99,
    decimalPlaces: 2,
    fieldName: "Forensic hour cost",
    unit: "$"
  },
  cost_per_kilometer_fuel: {
    required: true,
    min: 0.001,
    max: 9999.999,
    decimalPlaces: 3,
    fieldName: "Fuel cost per kilometer",
    unit: "$"
  },
  tax_percentage: {
    required: true,
    min: 0.00,
    max: 100.00,
    decimalPlaces: 2,
    fieldName: "Tax percentage",
    unit: "%"
  }
};

/**
 * Validate a pricing field (currency values)
 */
export function validatePricingField(field: string, value: string): ValidationResult {
  const config = FIELD_CONFIGS[field];
  if (!config) {
    return { isValid: false, error: "Unknown field" };
  }

  // Check if required
  if (config.required && (!value || value.trim() === '')) {
    return {
      isValid: false,
      error: `${config.fieldName} is required`,
      suggestion: `Enter a value between ${config.unit}${config.min} and ${config.unit}${config.max}`
    };
  }

  // Skip validation if not required and empty
  if (!config.required && (!value || value.trim() === '')) {
    return { isValid: true, error: '' };
  }

  const trimmedValue = value.trim();

  // Check for valid number format
  if (!/^\d+(\.\d+)?$/.test(trimmedValue)) {
    return {
      isValid: false,
      error: `${config.fieldName} must be a valid number`,
      suggestion: "Enter only numbers and decimal points (e.g., 123.45)"
    };
  }

  const numValue = parseFloat(trimmedValue);

  // Check if finite number
  if (!isFinite(numValue)) {
    return {
      isValid: false,
      error: `${config.fieldName} must be a valid number`,
      suggestion: "Enter a finite number"
    };
  }

  // Check minimum value
  if (config.min !== undefined && numValue < config.min) {
    return {
      isValid: false,
      error: `${config.fieldName} must be at least ${config.unit}${config.min}`,
      suggestion: `Enter a value of ${config.unit}${config.min} or higher`
    };
  }

  // Check maximum value
  if (config.max !== undefined && numValue > config.max) {
    return {
      isValid: false,
      error: `${config.fieldName} must not exceed ${config.unit}${config.max}`,
      suggestion: `Enter a value of ${config.unit}${config.max} or lower`
    };
  }

  // Check decimal places
  if (config.decimalPlaces !== undefined) {
    const decimalPlaces = (trimmedValue.split('.')[1] || '').length;
    if (decimalPlaces > config.decimalPlaces) {
      const decimalText = config.decimalPlaces === 1 ? "decimal place" : "decimal places";
      return {
        isValid: false,
        error: `${config.fieldName} can have at most ${config.decimalPlaces} ${decimalText}`,
        suggestion: `Round to ${config.decimalPlaces} decimal places (e.g., ${numValue.toFixed(config.decimalPlaces)})`
      };
    }
  }

  return { isValid: true, error: '' };
}

/**
 * Validate email address
 */
export function validateEmail(value: string): ValidationResult {
  if (!value || value.trim() === '') {
    return {
      isValid: false,
      error: "Admin email address is required",
      suggestion: "Enter a valid email address (e.g., admin@example.com)"
    };
  }

  const trimmedValue = value.trim();

  // Check length
  if (trimmedValue.length > 254) {
    return {
      isValid: false,
      error: "Email address is too long (maximum 254 characters)",
      suggestion: "Use a shorter email address"
    };
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedValue)) {
    return {
      isValid: false,
      error: "Please enter a valid email address",
      suggestion: "Use format: name@domain.com"
    };
  }

  // Additional checks for common issues
  if (trimmedValue.includes('..')) {
    return {
      isValid: false,
      error: "Email address cannot contain consecutive dots",
      suggestion: "Remove consecutive dots from the email address"
    };
  }

  if (trimmedValue.startsWith('.') || trimmedValue.endsWith('.')) {
    return {
      isValid: false,
      error: "Email address cannot start or end with a dot",
      suggestion: "Remove dots from the beginning or end of the email"
    };
  }

  return { isValid: true, error: '' };
}

/**
 * Validate boolean field
 */
export function validateBoolean(field: string, value: any): ValidationResult {
  const fieldName = getFieldDisplayName(field);
  
  if (value === null || value === undefined) {
    return {
      isValid: false,
      error: `${fieldName} is required`,
      suggestion: "Select true or false"
    };
  }

  // Accept various boolean representations
  if (typeof value === 'boolean') {
    return { isValid: true, error: '' };
  }

  if (typeof value === 'string') {
    const lowerValue = value.toLowerCase();
    if (['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'].includes(lowerValue)) {
      return { isValid: true, error: '' };
    }
  }

  if (typeof value === 'number') {
    if (value === 0 || value === 1) {
      return { isValid: true, error: '' };
    }
  }

  return {
    isValid: false,
    error: `${fieldName} must be true or false`,
    suggestion: "Select either true or false"
  };
}

/**
 * Validate complete settings object
 */
export function validateCompleteSettings(settings: Partial<SystemSettings>): {
  isValid: boolean;
  errors: string[];
  fieldErrors: Record<string, ValidationResult>;
  suggestions: string[];
} {
  const errors: string[] = [];
  const fieldErrors: Record<string, ValidationResult> = {};
  const suggestions: string[] = [];

  // Validate pricing fields
  const pricingFields = [
    'cost_per_certificate',
    'cost_per_bag',
    'call_out_fee',
    'cost_per_forensic_hour',
    'cost_per_kilometer_fuel',
    'tax_percentage'
  ];

  pricingFields.forEach(field => {
    if (field in settings) {
      const value = settings[field as keyof SystemSettings] as string;
      const result = validatePricingField(field, value);
      fieldErrors[field] = result;
      
      if (!result.isValid) {
        errors.push(result.error);
        if (result.suggestion) {
          suggestions.push(`${getFieldDisplayName(field)}: ${result.suggestion}`);
        }
      }
    }
  });

  // Validate email field
  if ('forward_certificate_emails_to' in settings) {
    const result = validateEmail(settings.forward_certificate_emails_to as string);
    fieldErrors.forward_certificate_emails_to = result;
    
    if (!result.isValid) {
      errors.push(result.error);
      if (result.suggestion) {
        suggestions.push(`Admin email: ${result.suggestion}`);
      }
    }
  }

  // Validate boolean field
  if ('send_emails_to_self' in settings) {
    const result = validateBoolean('send_emails_to_self', settings.send_emails_to_self);
    fieldErrors.send_emails_to_self = result;
    
    if (!result.isValid) {
      errors.push(result.error);
      if (result.suggestion) {
        suggestions.push(`Email routing: ${result.suggestion}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
    suggestions
  };
}

/**
 * Format currency value for display
 */
export function formatCurrency(value: string | number, decimalPlaces = 2): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0.00';
  }

  return numValue.toFixed(decimalPlaces);
}

/**
 * Format percentage value for display
 */
export function formatPercentage(value: string | number): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) {
    return '0.00%';
  }

  return `${numValue.toFixed(2)}%`;
}

/**
 * Parse currency input (remove formatting, validate)
 */
export function parseCurrencyInput(input: string): {
  value: string;
  isValid: boolean;
  error?: string;
} {
  if (!input || input.trim() === '') {
    return { value: '', isValid: false, error: 'Value is required' };
  }

  // Remove currency symbols and whitespace
  let cleaned = input.trim().replace(/[$,\s]/g, '');

  // Check for valid number format
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return { value: cleaned, isValid: false, error: 'Invalid number format' };
  }

  return { value: cleaned, isValid: true };
}

/**
 * Parse percentage input
 */
export function parsePercentageInput(input: string): {
  value: string;
  isValid: boolean;
  error?: string;
} {
  if (!input || input.trim() === '') {
    return { value: '', isValid: false, error: 'Value is required' };
  }

  // Remove percentage symbol and whitespace
  let cleaned = input.trim().replace(/[%\s]/g, '');

  // Check for valid number format
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return { value: cleaned, isValid: false, error: 'Invalid number format' };
  }

  const numValue = parseFloat(cleaned);
  if (numValue < 0 || numValue > 100) {
    return { value: cleaned, isValid: false, error: 'Percentage must be between 0 and 100' };
  }

  return { value: cleaned, isValid: true };
}

/**
 * Get user-friendly field display name
 */
export function getFieldDisplayName(field: string): string {
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

/**
 * Get field help text
 */
export function getFieldHelpText(field: string): string {
  const helpTexts: Record<string, string> = {
    cost_per_certificate: 'Cost charged per certificate generated',
    cost_per_bag: 'Cost charged per bag identification',
    call_out_fee: 'Fixed fee for emergency or special call outs',
    cost_per_forensic_hour: 'Cost charged per hour of forensic analysis',
    cost_per_kilometer_fuel: 'Cost charged per kilometer for travel',
    tax_percentage: 'Tax rate applied to all charges (e.g., GST)',
    forward_certificate_emails_to: 'Email address that receives system notifications when testing mode is enabled',
    send_emails_to_self: 'When enabled, all system emails will be sent to the admin email instead of actual recipients'
  };

  return helpTexts[field] || '';
}

/**
 * Check if field is a pricing field
 */
export function isPricingField(field: string): boolean {
  return [
    'cost_per_certificate',
    'cost_per_bag',
    'call_out_fee',
    'cost_per_forensic_hour',
    'cost_per_kilometer_fuel'
  ].includes(field);
}

/**
 * Check if field is a percentage field
 */
export function isPercentageField(field: string): boolean {
  return field === 'tax_percentage';
}

/**
 * Check if field is an email field
 */
export function isEmailField(field: string): boolean {
  return field === 'forward_certificate_emails_to';
}

/**
 * Check if field is a boolean field
 */
export function isBooleanField(field: string): boolean {
  return field === 'send_emails_to_self';
}