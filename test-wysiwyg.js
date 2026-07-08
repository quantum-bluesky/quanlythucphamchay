const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:8000');
  
  // Login
  await page.fill('#loginUsername', 'admin');
  await page.fill('#loginPassword', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
  
  // Go to Products
  await page.click('button[data-target-menu="products"]');
  await page.waitForTimeout(500);
  
  // Click Add Product to open form
  await page.click('button[data-product-shortcut="form"]');
  await page.waitForTimeout(500);
  
  const uniqueName = 'Test Product ' + Date.now();
  await page.fill('input[name="name"]', uniqueName);
  
  // Focus the WYSIWYG editor and type
  await page.focus('#productDetailEditor');
  await page.keyboard.type('qwewqeqw');
  
  // Save
  await page.click('#productForm button[type="submit"]');
  await page.waitForTimeout(1000);
  
  // Find the created product row
  const row = page.locator('.product-row').filter({ hasText: uniqueName });
  
  // Click Edit Full
  await row.locator('button[data-product-manage-action="edit-full"]').click();
  await page.waitForTimeout(500);
  
  // Check the editor content
  const content = await page.locator('#productDetailEditor').innerHTML();
  console.log("Editor content after Edit-Full:", JSON.stringify(content));
  
  await browser.close();
})();
