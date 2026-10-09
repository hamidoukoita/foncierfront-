import glob

for filepath in glob.glob("src/app/features/admin-dndc/**/*.component.html", recursive=True):
    with open(filepath, 'r') as f:
        content = f.read()

    # Admin filters active state
    content = content.replace(
        "'btn bg-brand-secondary text-white fw-bold shadow-xs border-brand-secondary'",
        "'btn btn-dark text-white fw-bold shadow-xs'"
    )
    # Admin filters inactive state (we replaced both outline-secondary and btn-white bg-white text-dark border)
    # The safest way is to just look at super-dashboard vs others.
    if 'super-dashboard' in filepath:
        content = content.replace(
            "'btn bg-white text-dark border border-gray-200 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white transition-all shadow-sm'",
            "'btn btn-outline-secondary'"
        )
        content = content.replace("'btn btn-dark text-white fw-bold shadow-xs'", "'btn btn-dark fw-bold'")
    else:
        content = content.replace(
            "'btn bg-white text-dark border border-gray-200 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white transition-all shadow-sm'",
            "'btn btn-white bg-white text-dark border'"
        )
        
    # Re-add border-color inline
    content = content.replace(
        'style="font-size: 12px; border-radius: 10px; "',
        'style="font-size: 12px; border-radius: 10px; border-color: var(--foncier-border) !important;"'
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
