with open('src/app/layout/topbar/topbar.component.css', 'r') as f:
    content = f.read()

content = content.replace(
'''.dropdown-item:hover {
  background-color: var(--foncier-bg);
}''',
'''.dropdown-item:hover {
  background-color: var(--foncier-primary);
  color: #fff !important;
}''')

with open('src/app/layout/topbar/topbar.component.css', 'w') as f:
    f.write(content)

print("Updated dropdown hover styles")
