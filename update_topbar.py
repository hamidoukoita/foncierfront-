with open('src/app/layout/topbar/topbar.component.css', 'r') as f:
    content = f.read()

content = content.replace('color: #334155;', 'color: #fff !important;')
content = content.replace('background-color: rgba(26, 43, 76, 0.05);', 'background-color: var(--foncier-primary);')

with open('src/app/layout/topbar/topbar.component.css', 'w') as f:
    f.write(content)

print("Updated topbar hover styles")
