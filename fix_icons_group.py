import os
import glob
import re

files_to_check = glob.glob("src/app/features/**/*.component.html", recursive=True)

for filepath in files_to_check:
    with open(filepath, 'r') as f:
        content = f.read()

    # Add 'group ' to the transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5
    content = content.replace(
        "transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5",
        "group transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
    )
    
    # Replace inline style for primary
    content = content.replace(
        '<mat-icon style="color: var(--foncier-primary)">',
        '<mat-icon class="text-brand-primary group-hover:text-white group-focus:text-white transition-colors">'
    )
    # Replace inline style for warning
    content = content.replace(
        '<mat-icon style="color: var(--foncier-warning)">',
        '<mat-icon class="text-brand-warning group-hover:text-white group-focus:text-white transition-colors">'
    )
    # Replace inline style for danger
    content = content.replace(
        '<mat-icon style="color: var(--foncier-danger)">',
        '<mat-icon class="text-brand-danger group-hover:text-white group-focus:text-white transition-colors">'
    )

    with open(filepath, 'w') as f:
        f.write(content)

print("Done")
