import os
import glob

files_to_check = glob.glob("src/app/features/admin-dndc/**/*.component.html", recursive=True)

for filepath in files_to_check:
    with open(filepath, 'r') as f:
        content = f.read()

    # Replace inline border color
    content = content.replace(
        "border-color: var(--foncier-border) !important;",
        ""
    )
    # Clean up empty style attributes or trailing semicolons if needed
    # But just removing the string is enough
    
    with open(filepath, 'w') as f:
        f.write(content)

print("Done")
