const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));
  
  try {
    console.log("Navigating to index...");
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'networkidle2' });
    
    // Check if map is loaded or locked
    const mapText = await page.evaluate(() => document.body.innerText);
    if (mapText.includes("Interactive GIS Map Locked")) {
      console.log("Map is locked. Logging in...");
      await page.goto('http://127.0.0.1:8000/login/', { waitUntil: 'networkidle2' });
      await page.type('input[name="email"]', 'test@example.com');
      await page.type('input[name="password"]', 'password'); // need correct creds or just bypass
      // Let's just create a test user or see if we can login.
      // Wait, we don't know the password!
    }
    
    // Let's also check /plan/
    console.log("Navigating to /plan/...");
    await page.goto('http://127.0.0.1:8000/plan/', { waitUntil: 'networkidle2' });

  } catch (err) {
    console.error(err);
  }
  await browser.close();
})();
