const fs = require('fs');
let content = fs.readFileSync('static/index.html', 'utf-8');

const oldToolbarStart = content.indexOf('<div class="wysiwyg-toolbar"');
if (oldToolbarStart !== -1) {
  const oldEditorEnd = content.indexOf('<textarea name="details" style="display:none;"></textarea>', oldToolbarStart);
  
  const replacement = '<div id="productDetailEditor" class="wysiwyg-editor" style="min-height: 120px; max-height: 300px; overflow-y: auto; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--surface); outline: none; line-height: 1.5;"></div>\n                ';
  
  content = content.substring(0, oldToolbarStart) + replacement + content.substring(oldEditorEnd);
  
  content = content.replace(
    '<script type="module" src="./static/bootstrap.js"',
    '<script src="./static/vendor/quill/quill.min.js"></script>\n  <script type="module" src="./static/bootstrap.js"'
  );
  
  fs.writeFileSync('static/index.html', content);
  console.log('Fixed exactly!');
} else {
  console.log('Toolbar not found!');
}
