import os
import shutil
import re

# Configuration
SOURCE_REPOS = ['tmp_skills', 'anthropic_skills_tmp', 'gemini_skills_tmp', 'vercel_skills_tmp']
TARGET_DIR = 'skills'
KEYWORDS = ['antigravity', 'claude', 'codex', 'gemini']

def ensure_yaml_frontmatter(content, name, description):
    """Ensure the content has YAML frontmatter."""
    if content.strip().startswith('---'):
        return content
    
    yaml_block = f"---\nname: {name}\ndescription: {description}\n---\n\n"
    return yaml_block + content

def consolidate():
    if not os.path.exists(TARGET_DIR):
        os.makedirs(TARGET_DIR)

    matched_count = 0
    for repo in SOURCE_REPOS:
        repo_path = os.path.join(os.getcwd(), repo)
        if not os.path.exists(repo_path):
            print(f"Skipping {repo} (not found)")
            continue

        print(f"Processing {repo}...")
        for root, dirs, files in os.walk(repo_path):
            # Check if this directory is a 'skill' directory (contains SKILL.md or .SKILL.md)
            skill_file = None
            if 'SKILL.md' in files:
                skill_file = 'SKILL.md'
            elif '.SKILL.md' in files:
                skill_file = '.SKILL.md'
            
            if skill_file:
                dir_name = os.path.basename(root)
                # Check if it matches our keywords
                if any(kw.lower() in dir_name.lower() for kw in KEYWORDS):
                    target_skill_path = os.path.join(TARGET_DIR, dir_name)
                    
                    # Avoid collisions by appending a suffix if needed
                    counter = 1
                    original_target = target_skill_path
                    while os.path.exists(target_skill_path):
                        target_skill_path = f"{original_target}_{counter}"
                        counter += 1
                    
                    print(f"  Found matching skill: {dir_name} -> {target_skill_path}")
                    
                    # Copy the whole folder
                    shutil.copytree(root, target_skill_path)
                    
                    # Standardize the skill file to SKILL.md and ensure YAML
                    src_file_path = os.path.join(target_skill_path, skill_file)
                    dest_file_path = os.path.join(target_skill_path, 'SKILL.md')
                    
                    with open(src_file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    # Extract name/description if YAML is missing (basic heuristic)
                    name = dir_name.replace('-', ' ').title()
                    description = f"Automated import of {dir_name} skill."
                    
                    updated_content = ensure_yaml_frontmatter(content, name, description)
                    
                    with open(dest_file_path, 'w', encoding='utf-8') as f:
                        f.write(updated_content)
                    
                    if skill_file == '.SKILL.md' and src_file_path != dest_file_path:
                        os.remove(src_file_path)
                    
                    matched_count += 1

    print(f"Finished! Consolidated {matched_count} skills into '{TARGET_DIR}/'.")

if __name__ == "__main__":
    consolidate()
