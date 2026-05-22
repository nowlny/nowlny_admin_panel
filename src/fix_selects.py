import os
import re

dir_path = "/Users/hassanalsabeh/Desktop/web_apps/nowlny_admin/src/app/components"
for filename in os.listdir(dir_path):
    if filename.endswith(".tsx"):
        filepath = os.path.join(dir_path, filename)
        with open(filepath, "r") as f:
            content = f.read()
        
        def replacer(match):
            class_val = match.group(1)
            if 'pr-8' not in class_val and 'pr-10' not in class_val:
                new_class_val = class_val + ' pr-8'
                return f'className="{new_class_val}"'
            return match.group(0)
        
        def select_replacer(match):
            select_tag = match.group(0)
            if 'className="' in select_tag:
                new_select_tag = re.sub(r'className="([^"]+)"', replacer, select_tag)
                return new_select_tag
            return select_tag

        new_content = re.sub(r'<select[^>]*>', select_replacer, content)
        
        if new_content != content:
            with open(filepath, "w") as f:
                f.write(new_content)
            print(f"Updated {filename}")

