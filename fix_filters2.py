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
                # Process the button content
                
                # Replace classes
                btn_content = re.sub(
                    r"'bg-white text-gray-700[^']*'",
                    "'group bg-white text-gray-700 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white focus:border-brand-primary border border-gray-200 cursor-pointer transition-colors'",
                    btn_content
                )
                
                # Process mat-icon
                def repl_icon(m):
                    inner = m.group(1)
                    inner = re.sub(r'text-[\w-]+', '', inner)
                    inner = re.sub(r'style="color:[^"]+"', '', inner)
                    inner = re.sub(r'style=\'color:[^\']+\'', '', inner)
                    
                    if 'class="' in inner:
                        inner = re.sub(r'class="([^"]*)"', r'class="\1 text-brand-primary group-hover:text-white group-focus:text-white transition-colors"', inner)
                    else:
                        inner += ' class="text-brand-primary group-hover:text-white group-focus:text-white transition-colors"'
                    return f'<mat-icon{inner}>'
                    
                btn_content = re.sub(r'<mat-icon([^>]*)>', repl_icon, btn_content)
                
            part = btn_content + '</button>' + rest
            
        new_content += '<button' + part
        
    with open(filepath, 'w') as f:
        f.write(new_content)

for filepath in glob.glob("src/app/features/**/*.component.html", recursive=True):
    process_html_file(filepath)

print("Done")
