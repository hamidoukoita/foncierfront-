import re
import glob

def process_html_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Find buttons with setFilter
    # A button starts with <button ... and ends with </button>
    # We will just do some regex replacements for the classes.
    
    # 1. Replace the inactive class string in [class]="..." for filters
    # It might be 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 cursor-pointer transition-colors'
    # or similar.
    content = re.sub(
        r"'bg-white text-gray-700[^']*'",
        "'group bg-white text-gray-700 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white focus:border-brand-primary border border-gray-200 cursor-pointer transition-colors'",
        content
    )
    
    # Also in parcelles which might have slightly different format.
    content = re.sub(
        r"'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'",
        "'group bg-white text-gray-700 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white focus:border-brand-primary border border-gray-200 cursor-pointer transition-colors'",
        content
    )

    # 2. Replace the inline styles on mat-icon near the text. 
    # Actually, the user wants all filter icons to be orange by default, white on hover.
    # It's safer to find all mat-icons inside the filter buttons.
    # Since filter buttons have `setFilter`, we can chunk the file by `<button` ... `</button>`
    
    new_content = ""
    parts = content.split('<button')
    new_content += parts[0]
    
    for part in parts[1:]:
        if 'setFilter' in part or 'currentFilter' in part:
            # This is a filter button
            # Replace mat-icon inside this button
            # Find <mat-icon ...>...</mat-icon>
            # Remove style="color: var(...)"
            part = re.sub(r'style="color:\s*var\([^)]+\)[^"]*"', '', part)
            part = re.sub(r'style=\'color:\s*var\([^)]+\)[^\']*\'', '', part)
            
            # Check if class exists
            if 'class="' in part.split('<mat-icon')[1].split('>')[0]:
                # has class, let's just append
                # wait, doing regex on XML is hard, let's just do a simple replacement
                def repl_icon(m):
                    inner = m.group(1)
                    # remove existing color classes if any
                    inner = re.sub(r'text-[\w-]+', '', inner)
                    # remove style="color: ..."
                    inner = re.sub(r'style="color:[^"]+"', '', inner)
                    
                    if 'class="' in inner:
                        inner = re.sub(r'class="([^"]*)"', r'class="\1 text-brand-primary group-hover:text-white group-focus:text-white transition-colors"', inner)
                    else:
                        inner += ' class="text-brand-primary group-hover:text-white group-focus:text-white transition-colors"'
                    return f'<mat-icon{inner}>'
                
                part = re.sub(r'<mat-icon([^>]*)>', repl_icon, part)
            else:
                # no class attribute
                part = re.sub(r'<mat-icon([^>]*)>', r'<mat-icon\1 class="text-brand-primary group-hover:text-white group-focus:text-white transition-colors">', part)
                
        new_content += '<button' + part
        
    with open(filepath, 'w') as f:
        f.write(new_content)

for filepath in glob.glob("src/app/features/**/*.component.html", recursive=True):
    process_html_file(filepath)

print("Done")
