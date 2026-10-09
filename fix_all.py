with open('src/app/layout/sidebar/sidebar.component.css', 'r') as f:
    content = f.read()

# For hover/focus text color
content = content.replace('''  background-color: var(--foncier-primary);
  color: var(--foncier-primary) !important;''', '''  background-color: var(--foncier-primary);
  color: #fff !important;''')

content = content.replace('''  color: var(--foncier-primary) !important;
  transform: scale(1.1);''', '''  color: #fff !important;
  transform: scale(1.1);''')

with open('src/app/layout/sidebar/sidebar.component.css', 'w') as f:
    f.write(content)
