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

    # The broken syntax looks like: <span>Text ({{ func(</span>) }})
    # We want to change it to: <span>Text ({{ func() }})</span>
    
    # regex to find: <span>(.*?) \(\{\{ (.*?)\(</span>\) \}\}\)
    # wait, the string is: `<span>Tous ({{ countTous(</span>) }})`
    # Let's match: `<span>([^(]+)\(\{\{\s*([^(]+)\(</span>\)\s*\}\}\)`
    
    # A more generic replace: 
    # Just replace `(</span>) }})` with `() }})</span>`
    # Let's check if there are other variations.
    
    new_content = re.sub(r'\(</span>\)\s*\}\}\)', r'() }})</span>', content)
    
    # Also in programmes.component.html, it might have been: `<span>{{ countTous(</span>) }}</b></div>`
    new_content = re.sub(r'\(</span>\)\s*\}\}\s*</b></div>', r'() }}</span>', new_content)

    # Let's just fix any `(</span>)` that is followed by ` }})`
    new_content = re.sub(r'\(</span>\)(\s*\}\})', r'()\1</span>', new_content)
    
    with open(filepath, 'w') as f:
        f.write(new_content)

print("Done")
