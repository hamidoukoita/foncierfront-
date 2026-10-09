with open('src/app/layout/sidebar/sidebar.component.css', 'r') as f:
    lines = f.readlines()
    
for i, line in enumerate(lines):
    if '.sidebar-nav-link.active-nav .badge {' in line:
        # the next lines should be:
        # background-color: #FFFFFF !important;
        # color: var(--foncier-primary) !important;
        lines[i+2] = '  color: var(--foncier-primary) !important;\n'

with open('src/app/layout/sidebar/sidebar.component.css', 'w') as f:
    f.writelines(lines)
