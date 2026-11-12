const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  
  await page.goto('http://localhost:4001');
  
  await page.waitForTimeout(2000);
  
  const initResult = await page.evaluate(() => {
    try {
      const dom = { productDetailEditor: document.getElementById('productDetailEditor') };
      if (!dom.productDetailEditor) return 'NO EDITOR DIV';
      if (!window.Quill) return 'NO window.Quill';
      
      const q = new Quill(dom.productDetailEditor, {
        theme: 'snow',
        placeholder: 'Nhập thông tin chi tiết sản phẩm...',
        modules: {
          toolbar: [
            [{ 'header': [3, 4, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'align': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
          ]
        }
      });
      return 'SUCCESS: ' + q.root.innerHTML;
    } catch (e) {
      return 'ERROR: ' + e.message;
    }
  });
  
  console.log('Quill Init:', initResult);
  
  console.log('Done');
  await browser.close();
})();
