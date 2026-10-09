import os
import re

files_to_check = [
    "src/app/features/admin-dndc/inscriptions/inscriptions-societes.component.html",
    "src/app/features/admin-dndc/programmes-controle/programmes-controle.component.html",
    "src/app/features/admin-dndc/utilisateurs/utilisateurs-roles.component.html",
    "src/app/features/admin-dndc/super-dashboard/super-dashboard.component.html"
]

for filepath in files_to_check:
    if not os.path.exists(filepath): continue
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace the inactive state
    content = content.replace(
        "'btn btn-white bg-white text-dark border'",
        "'btn bg-white text-dark border border-gray-200 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white transition-all shadow-sm'"
    )
    
    content = content.replace(
        "'btn btn-outline-secondary'",
        "'btn bg-white text-dark border border-gray-200 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white transition-all shadow-sm'"
    )
    
    # Let's also harmonize the active state to exactly match the brand secondary (Bleu Anthracite)
    content = content.replace(
        "'btn btn-dark text-white fw-bold shadow-xs'",
        "'btn bg-brand-secondary text-white fw-bold shadow-xs border-brand-secondary'"
    )
    content = content.replace(
        "'btn btn-dark fw-bold'",
        "'btn bg-brand-secondary text-white fw-bold shadow-xs border-brand-secondary'"
    )

    with open(filepath, 'w') as f:
        f.write(content)

print("Done")
