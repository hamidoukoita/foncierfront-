import os
import re

files_to_check = [
    "src/app/features/notifications/notifications.component.html",
    "src/app/features/agents/agents.component.html",
    "src/app/features/construire/projets-construction.component.html",
    "src/app/features/programmes/programmes.component.html",
    "src/app/features/reservations/reservations.component.html",
    "src/app/features/visites/visites.component.html",
    "src/app/features/admin-dndc/inscriptions/inscriptions-societes.component.html",
    "src/app/features/admin-dndc/programmes-controle/programmes-controle.component.html",
    "src/app/features/admin-dndc/utilisateurs/utilisateurs-roles.component.html"
]

for filepath in files_to_check:
    if not os.path.exists(filepath): continue
    with open(filepath, 'r') as f:
        content = f.read()

    # Step 1: Remove the `<div class="flex items-center gap-1.5">` wrappers that are breaking things
    # And fix the unclosed tags.
    # It's better to just extract the `mat-icon` and the text, and rewrite the button content.
    
    # Let's match the whole button tag that contains setFilter
    # <button ... (click)="setFilter('...')" ...> ... </button>
    
    def repl_button(m):
        button_open = m.group(1)
        inner_html = m.group(2)
        
        # Ensure the button has flex items-center gap-1.5 if it doesn't
        if 'flex' not in button_open and 'class="' in button_open:
            # We don't want to blindly add it to all buttons if they use other layouts, but for filters it's usually good.
            # Let's just focus on cleaning the inner html
            pass

        # Extract the icon name and color
        icon_match = re.search(r'<mat-icon style="color:\s*([^"]+)">([^<]+)</mat-icon>', inner_html)
        if not icon_match:
            return m.group(0) # don't touch if no icon
            
        color = icon_match.group(1)
        icon_name = icon_match.group(2).strip()
        
        # Extract the text and count
        # It could be `<span>Tous ({{ countTous() }})</span>`
        # Or `Tous <b>{{ countTous() }}</b>`
        # Or something messy like `<span>Tous ({{ countTous() }}</span>`
        
        text_match = re.search(r'([A-ZÀ-ÿa-z0-Ééèê&]+\s*(?:Individuelles|& Cités|terrain|lues)?)\s*(?:\(|<b>|<span[^>]*>)?\s*(\{\{\s*count[A-Za-z0-9_]+\(\)\s*\}\})', inner_html)
        if not text_match:
            # Fallback if we can't parse text properly
            return m.group(0)
            
        label = text_match.group(1).strip()
        count_expr = text_match.group(2).strip()
        
        # Clean up label if it ends with '('
        if label.endswith('('):
            label = label[:-1].strip()
            
        # Specific formatting for programmes
        if 'programmes.component.html' in filepath:
             clean_inner = f'\n      <mat-icon style="color: {color}">{icon_name}</mat-icon>\n      <span>{label} <b>{count_expr}</b></span>\n    '
        else:
             clean_inner = f'\n      <mat-icon style="color: {color}">{icon_name}</mat-icon>\n      <span>{label} ({count_expr})</span>\n    '
        
        # Ensure the button has gap
        if 'class="' in button_open and 'flex' not in button_open:
            # programmes.component.html buttons don't have tailwind classes, they use standard css
            if 'programmes.component.html' not in filepath:
                button_open = re.sub(r'class="([^"]+)"', r'class="\1 flex items-center gap-1.5"', button_open)
            
        return f"{button_open}{clean_inner}</button>"

    # Use DOTALL to match multiline button
    new_content = re.sub(r'(<button[^>]*?\(click\)="setFilter\([^>]*?>)(.*?)</button>', repl_button, content, flags=re.DOTALL)
    
    with open(filepath, 'w') as f:
        f.write(new_content)

print("Done")
