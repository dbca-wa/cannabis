from django import template

register = template.Library()

@register.filter
def article(value):
    """Returns 'an' if value starts with a vowel sound, otherwise 'a'"""
    if not value:
        return 'a'
    
    first_char = value[0].lower()
    return 'an' if first_char in 'aeiou' else 'a'