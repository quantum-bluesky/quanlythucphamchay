import re
with open('static/app.js', encoding='utf-8') as f: app_js = f.read()
imports = re.search(r'import\s*\{([^}]+)\}\s*from\s*[\'\"]./modules/dom.js[\'\"]', app_js).group(1)
imports = [i.strip() for i in imports.split(',') if i.strip()]
with open('static/modules/dom.js', encoding='utf-8') as f: dom_js = f.read()
exports = re.findall(r'export\s+const\s+([a-zA-Z0-9_]+)\s*=', dom_js)
print('Missing exports:', set(imports) - set(exports))
