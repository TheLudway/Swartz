import { test, expect } from '@playwright/test';

const query = process.env.SEARCH_QUERY || '';

test('search from telegram input', async ({ page }) => {
    if (!query){
        throw new Error('No query provided');
    }

    await page.goto('https://rutracker.org/', {
        waitUntil: 'domcontentloaded'
    });

    await page.fill('#search-text', query);
    await page.locator('#search-submit').click();

    await page.waitForSelector('#tor-tbl tbody tr', {
        state: 'visible'
    });

    await page.getByText('S', { exact: true }).click();
    await page.locator('th[title="Сиды"][aria-sort="descending"]').waitFor();
    
    const rows = await page.locator('tr[role="row"]');
    const results = [];

    for (let i = 1; i <= Math.min(await rows.count(), 5); i++){
        const row = rows.nth(i).locator('td');

        const title = await row.nth(3).textContent();
        const size = await row.nth(5).textContent();
        const seeds = await row.nth(6).textContent();
        const downloads = await row.nth(8).textContent();
        
        results.push({ 
            title: title ? title.trim().replace(/\s+/g, ' ') : null, 
            size, 
            seeds, 
            downloads: downloads ? downloads.trim() : null 
        });
    }
    
    console.log('EXTRACTED_RESULTS:' + JSON.stringify(results));



    await page.screenshot({ path: 'screenshot.png', fullPage: true }); 
});




