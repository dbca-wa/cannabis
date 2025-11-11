"""
Comprehensive error handling utilities for the user invitation system
"""
import logging
from typing import Dict, Any, Optional, Union
from django.http import JsonResponse
from django.conf import settings
from rest_framework import status
from rest_framework.response import Response

logger = logging.getLogger(__name__)

# Error codes for consistent error handling
class ErrorCodes:
    # Authentication errors
    INVALID_TOKEN = "INVALID_TOKEN"
    EXPIRED_TOKEN = "EXPIRED_TOKEN"
    TOKEN_ALREADY_USED = "TOKEN_ALREADY_USED"
    AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED"
    
    # Invitation errors
    USER_ALREADY_EXISTS = "USER_ALREADY_EXISTS"
    INVITATION_ALREADY_EXISTS = "INVITATION_ALREADY_EXISTS"
    INVALID_EXTERNAL_DATA = "INVALID_EXTERNAL_DATA"
    EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED"
    INVALID_ROLE = "INVALID_ROLE"
    
    # Password errors
    WEAK_PASSWORD = "WEAK_PASSWORD"
    CURRENT_PASSWORD_INCORRECT = "CURRENT_PASSWORD_INCORRECT"
    PASSWORDS_DONT_MATCH = "PASSWORDS_DONT_MATCH"
    PASSWORD_VALIDATION_FAILED = "PASSWORD_VALIDATION_FAILED"
    MAX_ATTEMPTS_EXCEEDED = "MAX_ATTEMPTS_EXCEEDED"
    INVALID_CODE = "INVALID_CODE"
    INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
    
    # General errors
    VALIDATION_ERROR = "VALIDATION_ERROR"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    NOT_FOUND = "NOT_FOUND"
    INTERNAL_ERROR = "INTERNAL_ERROR"
    NETWORK_ERROR = "NETWORK_ERROR"
    RATE_LIMITED = "RATE_LIMITED"
    DUPLICATE_REQUEST = "DUPLICATE_REQUEST"


class UserFriendlyMessages:
    """User-friendly error messages for different scenarios"""
    
    # Authentication messages
    INVALID_TOKEN = "This link is invalid or has been tampered with. Please request a new one."
    EXPIRED_TOKEN = "This link has expired. Please request a new one."
    TOKEN_ALREADY_USED = "This link has already been used. Please request a new one if needed."
    AUTHENTICATION_FAILED = "Authentication failed. Please check your credentials and try again."
    
    # Invitation messages
    USER_ALREADY_EXISTS = "A user with this email address already exists in the system."
    INVITATION_ALREADY_EXISTS = "An active invitation has already been sent to this email address."
    INVALID_EXTERNAL_DATA = "The user information provided is incomplete or invalid."
    EMAIL_SEND_FAILED = "We couldn't send the invitation email. Please check the email address and try again."
    INVALID_ROLE = "The selected role is not valid. Please choose a valid role."
    
    # Password messages
    WEAK_PASSWORD = "Your password doesn't meet the security requirements. Please choose a stronger password."
    CURRENT_PASSWORD_INCORRECT = "The current password you entered is incorrect."
    PASSWORDS_DONT_MATCH = "The passwords you entered don't match. Please try again."
    PASSWORD_VALIDATION_FAILED = "Password validation failed. Please check the requirements and try again."
    MAX_ATTEMPTS_EXCEEDED = "Maximum verification attempts exceeded. Please request a new reset code."
    INVALID_CODE = "Invalid reset code. Please check your email and try again."
    INVALID_CREDENTIALS = "Invalid email or reset code."
    
    # General messages
    VALIDATION_ERROR = "The information you provided is not valid. Please check your input and try again."
    PERMISSION_DENIED = "You don't have permission to perform this action."
    NOT_FOUND = "The requested resource was not found."
    INTERNAL_ERROR = "Something went wrong on our end. Please try again later."
    NETWORK_ERROR = "Network connection failed. Please check your internet connection and try again."
    RATE_LIMITED = "Too many requests. Please wait a moment before trying again."
    DUPLICATE_REQUEST = "A password reset code has already been sent. Please check your email or wait for the current code to expire."


class SecurityEventLogger:
    """Centralized security event logging"""
    
    @staticmethod
    def log_invitation_sent(inviter_email: str, invited_email: str, role: str, token_prefix: str):
        """Log successful invitation sending"""
        logger.info(
            "SECURITY_EVENT: Invitation sent",
            extra={
                "event_type": "invitation_sent",
                "inviter_email": inviter_email,
                "invited_email": invited_email,
                "role": role,
                "token_prefix": token_prefix,
                "severity": "info"
            }
        )
    
    @staticmethod
    def log_invitation_activation_success(email: str, inviter_email: str):
        """Log successful invitation activation"""
        logger.info(
            "SECURITY_EVENT: Invitation activated successfully",
            extra={
                "event_type": "invitation_activated",
                "email": email,
                "inviter_email": inviter_email,
                "severity": "info"
            }
        )
    
    @staticmethod
    def log_invitation_activation_failed(email: str, reason: str, token_prefix: str):
        """Log failed invitation activation attempts"""
        logger.warning(
            "SECURITY_EVENT: Invitation activation failed",
            extra={
                "event_type": "invitation_activation_failed",
                "email": email,
                "reason": reason,
                "token_prefix": token_prefix,
                "severity": "warning"
            }
        )
    
    @staticmethod
    def log_password_reset_requested(email: str, exists: bool):
        """Log password reset requests"""
        logger.info(
            "SECURITY_EVENT: Password reset requested",
            extra={
                "event_type": "password_reset_requested",
                "email": email,
                "user_exists": exists,
                "severity": "info"
            }
        )
    
    @staticmethod
    def log_password_reset_failed(email: str, reason: str, token_prefix: str):
        """Log failed password reset attempts"""
        logger.warning(
            "SECURITY_EVENT: Password reset failed",
            extra={
                "event_type": "password_reset_failed",
                "email": email,
                "reason": reason,
                "token_prefix": token_prefix,
                "severity": "warning"
            }
        )
    
    @staticmethod
    def log_password_update_success(email: str, is_first_time: bool):
        """Log successful password updates"""
        logger.info(
            "SECURITY_EVENT: Password updated successfully",
            extra={
                "event_type": "password_updated",
                "email": email,
                "is_first_time": is_first_time,
                "severity": "info"
            }
        )
    
    @staticmethod
    def log_password_update_failed(email: str, reason: str):
        """Log failed password update attempts"""
        logger.warning(
            "SECURITY_EVENT: Password update failed",
            extra={
                "event_type": "password_update_failed",
                "email": email,
                "reason": reason,
                "severity": "warning"
            }
        )
    
    @staticmethod
    def log_reset_code_generated(email: str, code_prefix: str):
        """Log reset code generation"""
        logger.info(
            "SECURITY_EVENT: Password reset code generated",
            extra={
                "event_type": "reset_code_generated",
                "email": email,
                "code_prefix": code_prefix,
                "severity": "info"
            }
        )
    
    @staticmethod
    def log_reset_code_verification_attempt(email: str, code_prefix: str, success: bool, reason: str = None, attempt_count: int = None):
        """Log reset code verification attempt"""
        status = "success" if success else "failed"
        message = f"SECURITY_EVENT: Reset code verification {status}"
        
        extra_data = {
            "event_type": "reset_code_verification",
            "email": email,
            "code_prefix": code_prefix,
            "success": success,
            "severity": "info" if success else "warning"
        }
        
        if reason:
            extra_data["reason"] = reason
        if attempt_count:
            extra_data["attempt_count"] = attempt_count
        
        if success:
            logger.info(message, extra=extra_data)
        else:
            logger.warning(message, extra=extra_data)
    
    @staticmethod
    def log_reset_code_expired(email: str, code_prefix: str):
        """Log expired reset code usage attempt"""
        logger.warning(
            "SECURITY_EVENT: Expired reset code used",
            extra={
                "event_type": "reset_code_expired",
                "email": email,
                "code_prefix": code_prefix,
                "severity": "warning"
            }
        )
    
    @staticmethod
    def log_reset_code_brute_force_attempt(email: str, attempt_count: int, ip_address: str = None):
        """Log potential brute force attempt on reset codes"""
        extra_data = {
            "event_type": "reset_code_brute_force",
            "email": email,
            "attempt_count": attempt_count,
            "severity": "high"
        }
        
        if ip_address:
            extra_data["ip_address"] = ip_address
        
        logger.error(
            "SECURITY_EVENT: Potential brute force attack detected on reset codes",
            extra=extra_data
        )
    
    @staticmethod
    def log_reset_code_invalidated(email: str, code_prefix: str, reason: str):
        """Log reset code invalidation"""
        logger.info(
            "SECURITY_EVENT: Reset code invalidated",
            extra={
                "event_type": "reset_code_invalidated",
                "email": email,
                "code_prefix": code_prefix,
                "reason": reason,
                "severity": "info"
            }
        )
    
    @staticmethod
    def log_password_reset_success(email: str):
        """Log successful password reset code verification"""
        logger.info(
            "SECURITY_EVENT: Password reset code verified successfully",
            extra={
                "event_type": "password_reset_success",
                "email": email,
                "severity": "info"
            }
        )
    
    @staticmethod
    def log_authentication_failed(email: str, reason: str):
        """Log authentication failures"""
        logger.warning(
            "SECURITY_EVENT: Authentication failed",
            extra={
                "event_type": "authentication_failed",
                "email": email,
                "reason": reason,
                "severity": "warning"
            }
        )


class ErrorResponseBuilder:
    """Standardized error response builder"""
    
    @staticmethod
    def build_error_response(
        error_code: str,
        message: str = None,
        field_errors: Dict[str, Any] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        extra_data: Dict[str, Any] = None
    ) -> Response:
        """
        Build a standardized error response using DRF conventions
        
        Args:
            error_code: Standardized error code (included as extra data)
            message: User-friendly error message
            field_errors: Field-specific validation errors
            status_code: HTTP status code
            extra_data: Additional data to include in response
        """
        # Use DRF standard format: {"detail": "message"}
        response_data = {
            "detail": message or "An error occurred",
        }
        
        # Include error code as extra data for debugging/logging
        if error_code:
            response_data["error_code"] = error_code
        
        if field_errors:
            # Merge field errors directly into response (DRF style)
            response_data.update(field_errors)
        
        if extra_data:
            response_data.update(extra_data)
        
        return Response(response_data, status=status_code)
    
    @staticmethod
    def build_validation_error_response(field_errors: Dict[str, Any]) -> Response:
        """Build response for validation errors using DRF format"""
        # For validation errors, use field errors directly without a detail message
        response_data = field_errors.copy()
        response_data["error_code"] = ErrorCodes.VALIDATION_ERROR
        
        return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
    
    @staticmethod
    def build_authentication_error_response(reason: str = None) -> Response:
        """Build response for authentication errors"""
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.AUTHENTICATION_FAILED,
            message=UserFriendlyMessages.AUTHENTICATION_FAILED,
            status_code=status.HTTP_401_UNAUTHORIZED,
            extra_data={"reason": reason} if reason else None
        )
    
    @staticmethod
    def build_permission_error_response() -> Response:
        """Build response for permission errors"""
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.PERMISSION_DENIED,
            message=UserFriendlyMessages.PERMISSION_DENIED,
            status_code=status.HTTP_403_FORBIDDEN
        )
    
    @staticmethod
    def build_not_found_error_response(resource: str = "resource") -> Response:
        """Build response for not found errors"""
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.NOT_FOUND,
            message=f"The requested {resource} was not found.",
            status_code=status.HTTP_404_NOT_FOUND
        )
    
    @staticmethod
    def build_internal_error_response(error_id: str = None) -> Response:
        """Build response for internal server errors"""
        extra_data = {"error_id": error_id} if error_id else None
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.INTERNAL_ERROR,
            message=UserFriendlyMessages.INTERNAL_ERROR,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            extra_data=extra_data
        )


class InvitationErrorHandler:
    """Specialized error handler for invitation-related operations"""
    
    @staticmethod
    def handle_user_already_exists(email: str) -> Response:
        """Handle case where user already exists"""
        SecurityEventLogger.log_invitation_activation_failed(
            email=email,
            reason="user_already_exists",
            token_prefix="N/A"
        )
        
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.USER_ALREADY_EXISTS,
            message=UserFriendlyMessages.USER_ALREADY_EXISTS,
            status_code=status.HTTP_409_CONFLICT
        )
    
    @staticmethod
    def handle_invitation_already_exists(email: str) -> Response:
        """Handle case where active invitation already exists"""
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.INVITATION_ALREADY_EXISTS,
            message=UserFriendlyMessages.INVITATION_ALREADY_EXISTS,
            status_code=status.HTTP_409_CONFLICT
        )
    
    @staticmethod
    def handle_invalid_token(token_prefix: str, reason: str) -> Response:
        """Handle invalid invitation token"""
        SecurityEventLogger.log_invitation_activation_failed(
            email="unknown",
            reason=f"invalid_token_{reason}",
            token_prefix=token_prefix
        )
        
        if reason == "expired":
            error_code = ErrorCodes.EXPIRED_TOKEN
            message = UserFriendlyMessages.EXPIRED_TOKEN
        elif reason == "already_used":
            error_code = ErrorCodes.TOKEN_ALREADY_USED
            message = UserFriendlyMessages.TOKEN_ALREADY_USED
        else:
            error_code = ErrorCodes.INVALID_TOKEN
            message = UserFriendlyMessages.INVALID_TOKEN
        
        return ErrorResponseBuilder.build_error_response(
            error_code=error_code,
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def handle_email_send_failed(email: str, error: Exception) -> Response:
        """Handle email sending failures"""
        logger.error(
            f"Failed to send invitation email to {email}",
            extra={
                "email": email,
                "error": str(error),
                "error_type": type(error).__name__
            }
        )
        
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.EMAIL_SEND_FAILED,
            message=UserFriendlyMessages.EMAIL_SEND_FAILED,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class PasswordErrorHandler:
    """Specialized error handler for password-related operations"""
    
    @staticmethod
    def handle_weak_password(validation_errors: list) -> Response:
        """Handle weak password validation errors"""
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.WEAK_PASSWORD,
            message=UserFriendlyMessages.WEAK_PASSWORD,
            field_errors={"new_password": validation_errors},
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def handle_incorrect_current_password(email: str) -> Response:
        """Handle incorrect current password"""
        SecurityEventLogger.log_password_update_failed(
            email=email,
            reason="incorrect_current_password"
        )
        
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.CURRENT_PASSWORD_INCORRECT,
            message=UserFriendlyMessages.CURRENT_PASSWORD_INCORRECT,
            field_errors={"current_password": [UserFriendlyMessages.CURRENT_PASSWORD_INCORRECT]},
            status_code=status.HTTP_400_BAD_REQUEST
        )
    
    @staticmethod
    def handle_passwords_dont_match() -> Response:
        """Handle password confirmation mismatch"""
        return ErrorResponseBuilder.build_error_response(
            error_code=ErrorCodes.PASSWORDS_DONT_MATCH,
            message=UserFriendlyMessages.PASSWORDS_DONT_MATCH,
            field_errors={"confirm_password": [UserFriendlyMessages.PASSWORDS_DONT_MATCH]},
            status_code=status.HTTP_400_BAD_REQUEST
        )


def handle_network_errors(func):
    """Decorator to handle network-related errors gracefully"""
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except ConnectionError as e:
            logger.error(f"Network connection error in {func.__name__}: {str(e)}")
            return ErrorResponseBuilder.build_error_response(
                error_code=ErrorCodes.NETWORK_ERROR,
                message=UserFriendlyMessages.NETWORK_ERROR,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            logger.error(f"Unexpected error in {func.__name__}: {str(e)}")
            return ErrorResponseBuilder.build_internal_error_response()
    
    return wrapper