import os
import glob

# Find all component.html files
files_to_check = glob.glob("src/app/features/**/*.component.html", recursive=True)

for filepath in files_to_check:
    with open(filepath, 'r') as f:
        content = f.read()

    # The societe side filters use this exact string for inactive:
    # 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
    content = content.replace(
        "'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'",
        "'bg-white text-gray-700 border border-gray-200 hover:bg-brand-primary hover:text-white hover:border-brand-primary focus:bg-brand-primary focus:text-white focus:border-brand-primary transition-colors'"
    )

    with open(filepath, 'w') as f:
        f.write(content)

print("Done")
