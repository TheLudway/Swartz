import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

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

    const row = rows.nth(1).locator('td');
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
    
    console.log('EXTRACTED_RESULTS:' + JSON.stringify(results));
    console.log('STARTING GOING TO TORRENT');

    const link = page.locator('a[data-topic_id]');
    const id = await link.nth(1).getAttribute('data-topic_id');
    console.log('ID OF TORRENT: ' + id);

    await page.goto('https://rutracker.org/forum/viewtopic.php?t='+id,{
        waitUntil: 'domcontentloaded'
    });
    
    // Wait for the page title/heading to ensure page loaded
    await page.waitForSelector('h1[itemprop="name"]', { timeout: 10000 }).catch(() => null);
    
    // Extract page title
    const pageTitle = await page.title();
    
    // Add page load confirmation to results
    results.push({
        page_loaded: true,
        torrent_title: pageTitle
    });
    
    const downloadPath = path.resolve(__dirname, '../../../downloads');

    fs.mkdirSync(downloadPath, { recursive: true });

    const downloadLink = page.locator('a.dl-stub.dl-link.dl-topic');

    const [download] = await Promise.all([
        page.waitForEvent('download'),
        downloadLink.click(),
    ]);

    // save file to custom path
    const suggestedFilename = await download.suggestedFilename();
    const filePath = path.join(downloadPath, suggestedFilename);
    await download.saveAs(filePath);

    console.log('Downloaded to:', filePath);

    // Add download info to page load info
    results[1].download_file = suggestedFilename;
    results[1].download_path = filePath;

    console.log('PAGE_LOAD_INFO:' + JSON.stringify(results[1])); 
});




