import glob

for filepath in glob.glob("src/app/features/**/*.component.html", recursive=True):
    with open(filepath, 'r') as f:
        content = f.read()

    content = content.replace(
        "'bg-white text-gray-700 border border-gray-200 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white focus:border-brand-primary transition-colors'",
        "'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'"
    )
    
    with open(filepath, 'w') as f:
        f.write(content)
