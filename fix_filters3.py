import re
import glob

def process_html_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
        
    parts = content.split('<button')
    new_content = parts[0]
    
    for part in parts[1:]:
        if '</button>' in part:
            btn_content, rest = part.split('</button>', 1)
            
            if 'setFilter' in btn_content or 'currentFilter' in btn_content:
                # 1. Replace the long group hover classes with the simple hover:bg-gray-50
                btn_content = re.sub(
                    r"'group bg-white text-gray-700[^']*'",
                    "'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 cursor-pointer transition-colors'",
                    btn_content
                )
                
                # Also handle if I didn't replace it properly before
                btn_content = re.sub(
                    r"'bg-white text-gray-700 hover:bg-gray-50[^']*'",
                    "'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 cursor-pointer transition-colors'",
                    btn_content
                )

                # 2. Make all mat-icons inside filter buttons have style="color: var(--foncier-primary)"
                def repl_icon(m):
                    inner = m.group(1)
                    # remove tailwind classes added by previous script
                    inner = re.sub(r'class="[^"]*text-brand-primary[^"]*"', '', inner)
                    # remove any style="color: ..."
                    inner = re.sub(r'style="color:[^"]+"', '', inner)
                    # remove empty class="" if any
                    inner = re.sub(r'class="\s*"', '', inner)
                    
                    return f'<mat-icon style="color: var(--foncier-primary)"{inner}>'
                    
                btn_content = re.sub(r'<mat-icon([^>]*)>', repl_icon, btn_content)
                
            part = btn_content + '</button>' + rest
            
        new_content += '<button' + part
        
    with open(filepath, 'w') as f:
        f.write(new_content)

for filepath in glob.glob("src/app/features/**/*.component.html", recursive=True):
    process_html_file(filepath)

print("Done")
