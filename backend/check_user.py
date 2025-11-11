#!/usr/bin/env python
import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()

try:
    user = User.objects.get(email='jprincedev@gmail.com')
    print(f'User found: {user.email}')
    print(f'Password last changed: {user.password_last_changed}')
    
    if user.password_last_changed:
        time_since_change = timezone.now() - user.password_last_changed
        print(f'Time since change: {time_since_change}')
        within_hour = time_since_change < timedelta(hours=1)
        print(f'Within 1 hour: {within_hour}')
        
        if within_hour:
            remaining_time = timedelta(hours=1) - time_since_change
            minutes_remaining = int(remaining_time.total_seconds() / 60)
            print(f'Minutes remaining: {minutes_remaining}')
    else:
        print('No password change timestamp')
        
except User.DoesNotExist:
    print('User not found')