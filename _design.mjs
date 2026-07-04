import { chromium } from '@playwright/browser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const designFile = join(__dirname, 'design', 'Batch Console 重设计.dc.html');
const fileUrl = new URL(`file://${designFile}`).toString();

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(1000);
    
    // 整屏
    await page.screenshot({ path: '/tmp/design-full.png', fullPage: true });
    
    // 标准视口
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: '/tmp/design-viewport.png' });
    
    console.log('✓ 设计截图已保存');
  } catch (e) {
    console.error('✗ 导航失败:', e.message);
  } finally {
    await browser.close();
  }
})();
