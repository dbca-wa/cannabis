from datetime import datetime

# from pprint import pprint
from django import template
from operator import attrgetter
from itertools import groupby
import re
from bs4 import BeautifulSoup

register = template.Library()


@register.filter
def article(value):
    """
    Returns 'a' or 'an' based on whether the word starts with a vowel sound.

    Usage: {{ role|article }}
    Example: "Admin" -> "an", "User" -> "a"
    """
    if not value:
        return "a"

    value = str(value).strip().lower()

    # Words that start with vowel sounds
    vowel_sounds = ["a", "e", "i", "o", "u"]

    # Special cases where 'u' sounds like 'you' (use 'a')
    u_exceptions = [
        "user",
        "university",
        "uniform",
        "union",
        "unique",
        "unit",
        "united",
        "universal",
    ]

    # Special cases where 'h' is silent (use 'an')
    h_exceptions = ["hour", "honest", "honor", "honour", "heir"]

    # Check for h exceptions
    for exception in h_exceptions:
        if value.startswith(exception):
            return "an"

    # Check for u exceptions
    for exception in u_exceptions:
        if value.startswith(exception):
            return "a"

    # Check first letter
    if value[0] in vowel_sounds:
        return "an"

    return "a"