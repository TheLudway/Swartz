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

    await page.screenshot({ path: 'screenshot.png', fullPage: true }); 
});


