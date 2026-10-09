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

mapping = {
    'Tous': 'apps',
    'Toutes': 'apps',
    'Actifs': 'how_to_reg',
    'Suspendus': 'person_off',
    'En attente': 'hourglass_empty',
    'Confirmées': 'check_circle',
    'Annulées': 'cancel',
    'Effectuées': 'done_all',
    'Publiés': 'public',
    'Brouillons': 'edit_note',
    'En étude': 'architecture',
    'Acceptés': 'check_circle',
    'Refusés': 'cancel',
    'Refusées': 'cancel',
    'Non lues': 'mark_email_unread',
    'Réservations': 'book_online',
    'Visites terrain': 'emoji_transportation',
    'Construction': 'construction',
    'Programmes & Cités': 'location_city',
    'Parcelles Individuelles': 'landscape',
    'Acquéreurs': 'person_search',
    'Promoteurs': 'real_estate_agent',
    'Agents': 'support_agent'
}

for filepath in files_to_check:
    if not os.path.exists(filepath): continue
    with open(filepath, 'r') as f:
        content = f.read()

    # We want to match: <mat-icon style="color: var(--foncier-primary); font-size: 18px; width: 18px; height: 18px; vertical-align: middle;">ICON</mat-icon><span>Text (
    pattern = re.compile(r'(<mat-icon style="color: var\(--foncier-[^;]+;\s*font-size:[^>]+>)([^<]+)(</mat-icon><span>\s*([^(\n<]+))')
    
    def repl(m):
        prefix = m.group(1)
        old_icon = m.group(2)
        suffix = m.group(3)
        text_content = m.group(4).strip()
        
        # Clean text content to match mapping (e.g. remove trailing plurals or find best match)
        new_icon = old_icon
        for key in mapping:
            if text_content.startswith(key):
                new_icon = mapping[key]
                break
        
        # Simplify the style so it looks like what the user wanted: `<mat-icon class="text-brand-primary">icon</mat-icon>` or just use standard style
        # But wait, the user's `parcelles.component.html` had `<mat-icon style="color: orange">receipt </mat-icon>`
        # It's cleaner to just use `class="text-brand-primary"` or `class="text-[var(--foncier-primary)]"`. But to stick to their style: `style="color: var(--foncier-primary);"`
        
        # We can extract the color variable from the prefix to keep warning/primary/etc colors
        color_match = re.search(r'color:\s*(var\(--foncier-[^)]+\))', prefix)
        color_style = color_match.group(1) if color_match else 'var(--foncier-primary)'
        
        return f'<mat-icon style="color: {color_style}">{new_icon}</mat-icon><span>{m.group(4)}'

    new_content = pattern.sub(repl, content)
    
    with open(filepath, 'w') as f:
        f.write(new_content)

print("Done")
