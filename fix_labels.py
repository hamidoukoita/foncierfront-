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

    # Generic clean up for icon><span>
    content = content.replace("<span>icon><span>", "<span>")
    
    # Fix the missing 'En '
    content = content.replace("<span>attente ({{ countEnAttente() }})</span>", "<span>En attente ({{ countEnAttente() }})</span>")
    content = content.replace("<span>étude ({{ countEnEtude() }})</span>", "<span>En étude ({{ countEnEtude() }})</span>")
    
    # Fix programmes.component.html
    if 'programmes.component.html' in filepath:
        content = content.replace("<span> <b>{{ countTous() }}</b></span>", "<span>Tous <b>{{ countTous() }}</b></span>")
        content = content.replace("<span> <b>{{ countPublies() }}</b></span>", "<span>Publiés <b>{{ countPublies() }}</b></span>")
        content = content.replace("<span> <b>{{ countBrouillons() }}</b></span>", "<span>Brouillons <b>{{ countBrouillons() }}</b></span>")

    with open(filepath, 'w') as f:
        f.write(content)

print("Done")
