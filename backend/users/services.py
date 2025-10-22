"""
User-related services including password validation
"""
import re
from typing import Dict, List, Tuple


class PasswordValidator:
    """
    Password validation service with comprehensive security rules
    """
    
    # Password validation constants
    MIN_LENGTH = 10
    
    @staticmethod
    def validate_password(password: str) -> Tuple[bool, List[str]]:
        """
        Validate password against security requirements
        
        Args:
            password: The password to validate
            
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check minimum length
        if len(password) < PasswordValidator.MIN_LENGTH:
            errors.append(f"Password must be at least {PasswordValidator.MIN_LENGTH} characters long")
        
        # Check for at least one letter
        if not re.search(r'[a-zA-Z]', password):
            errors.append("Password must contain at least one letter")
        
        # Check for at least one number
        if not re.search(r'\d', password):
            errors.append("Password must contain at least one number")
        
        # Check for at least one special character
        if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            errors.append("Password must contain at least one special character (!@#$%^&*(),.?\":{}|<>)")
        
        is_valid = len(errors) == 0
        return is_valid, errors
    
    @staticmethod
    def get_password_strength(password: str) -> Dict[str, any]:
        """
        Get detailed password strength information
        
        Args:
            password: The password to analyze
            
        Returns:
            Dictionary with strength details
        """
        is_valid, errors = PasswordValidator.validate_password(password)
        
        # Calculate strength score (0-100)
        score = 0
        criteria_met = 0
        total_criteria = 4
        
        # Length check (0-40 points)
        if len(password) >= PasswordValidator.MIN_LENGTH:
            score += 40
            criteria_met += 1
        elif len(password) >= 8:
            score += 20  # Partial credit for decent length
        
        # Letter check (0-20 points)
        if re.search(r'[a-zA-Z]', password):
            score += 20
            criteria_met += 1
        
        # Number check (0-20 points)
        if re.search(r'\d', password):
            score += 20
            criteria_met += 1
        
        # Special character check (0-20 points)
        if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
            score += 20
            criteria_met += 1
        
        # Determine strength level
        if score >= 100:
            strength_level = "strong"
        elif score >= 80:
            strength_level = "good"
        elif score >= 60:
            strength_level = "fair"
        elif score >= 40:
            strength_level = "weak"
        else:
            strength_level = "very_weak"
        
        return {
            "is_valid": is_valid,
            "errors": errors,
            "score": score,
            "strength_level": strength_level,
            "criteria_met": criteria_met,
            "total_criteria": total_criteria,
            "requirements": {
                "min_length": len(password) >= PasswordValidator.MIN_LENGTH,
                "has_letter": bool(re.search(r'[a-zA-Z]', password)),
                "has_number": bool(re.search(r'\d', password)),
                "has_special": bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password))
            }
        }