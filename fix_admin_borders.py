import os
import glob
import re

files_to_check = glob.glob("src/app/features/admin-dndc/**/*.component.html", recursive=True)

for filepath in files_to_check:
    with open(filepath, 'r') as f:
        content = f.read()

    # 1. Remove the invalid `--foncier-border` usage which causes black borders
    content = re.sub(r'border-color:\s*var\(--foncier-border\)\s*!important;?', '', content)
    content = re.sub(r'border:\s*1px solid var\(--foncier-border\)\s*!important;?', '', content)
    # The ternary in inscriptions-societes
    content = content.replace("'var(--foncier-border) !important'", "'#F3F4F6' !important") # gray-100
    
    # 2. Add border-gray-100 to classes containing "border" and "bg-white" or "card"
    # To do this safely, we will find `class="..."` and if it contains `border` but not `border-gray`, we add `border-gray-100`.
    # But only for div/article elements that act as cards, we'll match specific patterns.
    
    # Pattern 1: `class="card border ..."`
    content = content.replace('class="card border ', 'class="card border border-gray-100 ')
    
    # Pattern 2: `class="bg-white rounded-4 border `
    content = content.replace('class="bg-white rounded-4 border ', 'class="bg-white rounded-4 border border-gray-100 ')
    
    # Pattern 3: `class="bg-white rounded-4 p-3 border `
    content = content.replace('class="bg-white rounded-4 p-3 border ', 'class="bg-white rounded-4 p-3 border border-gray-100 ')
    
    # Pattern 4: `class="bg-white rounded-4 p-4 p-sm-5 border `
    content = content.replace('class="bg-white rounded-4 p-4 p-sm-5 border ', 'class="bg-white rounded-4 p-4 p-sm-5 border border-gray-100 ')
    
    # Pattern 5: `class="p-4 bg-white rounded-4 border `
    content = content.replace('class="p-4 bg-white rounded-4 border ', 'class="p-4 bg-white rounded-4 border border-gray-100 ')
    
    # Pattern 6: `class="p-2 bg-white rounded-3 border `
    content = content.replace('class="p-2 bg-white rounded-3 border ', 'class="p-2 bg-white rounded-3 border border-gray-100 ')

    # Pattern 7: `class="p-5 bg-white rounded-4 border `
    content = content.replace('class="p-5 bg-white rounded-4 border ', 'class="p-5 bg-white rounded-4 border border-gray-100 ')
    
    # Pattern 8: In programmes-controle: `class="card border-0 rounded-4 ... bg-white shadow-card"`
    # Wait, `border-0` means no border. If we want a simple border like societe, we should make it `border border-gray-100` instead of `border-0`.
    content = content.replace('class="card border-0 rounded-4 overflow-hidden bg-white shadow-card"', 'class="card border border-gray-100 rounded-4 overflow-hidden bg-white shadow-card"')
    
    # Pattern 9: `shadow-xs` -> `shadow-card` for cards?
    # Actually, the user said "fait simple avec un petit shadow , bref comm ceux de la partie societer".
    # The societe side uses `shadow-card`. So we can replace `shadow-xs` and `shadow-sm` on cards to `shadow-card`.
    # Let's just do a blanket replace for `.card` and `.interactive-card` to use `shadow-card`.
    content = content.replace('shadow-xs interactive-card', 'shadow-card interactive-card')
    content = content.replace('interactive-card shadow-card', 'interactive-card shadow-card') # already there

    with open(filepath, 'w') as f:
        f.write(content)

print("Done admin")

# Let's also check super-dashboard css
css_file = "src/app/features/admin-dndc/super-dashboard/super-dashboard.component.css"
if os.path.exists(css_file):
    with open(css_file, 'r') as f:
        content = f.read()
    content = content.replace('border-bottom-color: var(--foncier-border) !important;', 'border-bottom-color: #F3F4F6 !important;')
    with open(css_file, 'w') as f:
        f.write(content)
