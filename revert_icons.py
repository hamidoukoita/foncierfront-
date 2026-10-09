import glob

for filepath in glob.glob("src/app/features/**/*.component.html", recursive=True):
    with open(filepath, 'r') as f:
        content = f.read()

    content = content.replace(
        "group transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5",
        "transition-colors cursor-pointer shadow-2xs flex items-center gap-1.5"
    )
    content = content.replace(
        '<mat-icon class="text-brand-primary group-hover:text-white group-focus:text-white transition-colors">',
        '<mat-icon style="color: var(--foncier-primary)">'
    )
    content = content.replace(
        '<mat-icon class="text-brand-warning group-hover:text-white group-focus:text-white transition-colors">',
        '<mat-icon style="color: var(--foncier-warning)">'
    )
    content = content.replace(
        '<mat-icon class="text-brand-danger group-hover:text-white group-focus:text-white transition-colors">',
        '<mat-icon style="color: var(--foncier-danger)">'
    )
    # also for active tabs that might have had group added
    
    with open(filepath, 'w') as f:
        f.write(content)
