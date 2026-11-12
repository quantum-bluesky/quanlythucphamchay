import json, hashlib, os

manifest_path = 'data/js_asset_versions.json'
with open(manifest_path, 'r', encoding='utf-8') as f:
    manifest = json.load(f)

for file_path in manifest:
    full_path = os.path.join('.', file_path)
    if os.path.exists(full_path):
        with open(full_path, 'rb') as f:
            content = f.read().replace(b'\r\n', b'\n')
        current_hash = hashlib.sha256(content).hexdigest()
        
        if manifest[file_path]['sha256'] != current_hash:
            manifest[file_path]['sha256'] = current_hash
            manifest[file_path]['counter'] += 1
            print(f'Updated {file_path} to counter {manifest[file_path]["counter"]}')

with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)
