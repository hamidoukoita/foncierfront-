with open('src/app/layout/sidebar/sidebar.component.css', 'r') as f:
    content = f.read()

content = content.replace('background-color: #FAF8F5;', 'background-color: var(--foncier-primary);')
content = content.replace('color: var(--foncier-secondary);', 'color: #fff !important;')
content = content.replace('color: var(--foncier-primary) !important;', 'color: #fff !important;')

with open('src/app/layout/sidebar/sidebar.component.css', 'w') as f:
    f.write(content)

print("Updated sidebar hover styles")
