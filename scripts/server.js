const http = require('http');
const { spawn } = require('child_process');

const PORT = 3000;

console.log(`[${new Date().toISOString()}] Initializing test server...`);

const server = http.createServer(async (req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    
    if (req.method === 'POST' && req.url === '/run-test') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            console.log(`[${new Date().toISOString()}] Request body received: ${body}`);
            try {
                const data = JSON.parse(body);
                const query = data.query;
                console.log(`[${new Date().toISOString()}] Parsed query: "${query}"`);

                if (!query) {
                    console.warn(`[${new Date().toISOString()}] No query provided in request`);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No query provided' }));
                    return;
                }

                const env = { ...process.env, SEARCH_QUERY: query };
                console.log(`[${new Date().toISOString()}] Spawning Playwright test process with query: "${query}"`);
                const test = spawn('npx', ['playwright', 'test'], {
                    cwd: '/home/pwuser/project',
                    stdio: 'pipe',
                    env: env
                });

                console.log(`[${new Date().toISOString()}] Playwright process started with PID: ${test.pid}`);
                let output = '';
                test.stdout.on('data', (data) => {
                    output += data.toString();
                    console.log(`[${new Date().toISOString()}] [PLAYWRIGHT_STDOUT] ${data.toString().trim()}`);
                });

                test.stderr.on('data', (data) => {
                    output += data.toString();
                    console.log(`[${new Date().toISOString()}] [PLAYWRIGHT_STDERR] ${data.toString().trim()}`);
                });

                test.on('close', (code) => {
                    console.log(`[${new Date().toISOString()}] Playwright process exited with code: ${code}`);
                    
                    let results = null;
                    let page_load_info = null;
                    const match = output.match(/EXTRACTED_RESULTS:(\[[\s\S]*?\])\n/);
                    if (match) {
                        try {
                            results = JSON.parse(match[1]);
                        } catch (e) {
                            console.error(`[${new Date().toISOString()}] Failed to parse extracted results: ${e.message}`);
                        }
                    }
                    
                    const pageLoadMatch = output.match(/PAGE_LOAD_INFO:(\{[\s\S]*?\})\n/);
                    if (pageLoadMatch) {
                        try {
                            page_load_info = JSON.parse(pageLoadMatch[1]);
                        } catch (e) {
                            console.error(`[${new Date().toISOString()}] Failed to parse page load info: ${e.message}`);
                        }
                    }
                    
                    res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        status: code === 0 ? 'success' : 'failed',
                        output: output,
                        results: results,
                        page_load_info: page_load_info
                    }));
                });
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error parsing request: ${error.message}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    } else if (req.method === 'POST' && req.url === '/download-torrent') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            console.log(`[${new Date().toISOString()}] Torrent download request received: ${body}`);
            try {
                const data = JSON.parse(body);
                const torrentPath = data.torrentPath;
                const outputDir = data.outputDir || '/downloads';

                if (!torrentPath) {
                    console.warn(`[${new Date().toISOString()}] No torrentPath provided in request`);
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No torrentPath provided' }));
                    return;
                }

                // Install aria2 and tmux if not present, then spawn download in tmux
                const sessionName = `torrent-${Date.now()}`;
                const installCmd = `apt-get update > /dev/null 2>&1 && apt-get install -y aria2 tmux > /dev/null 2>&1 && tmux new-session -d -s ${sessionName} "aria2c '${torrentPath}' -d '${outputDir}' && sleep 60"`;
                
                console.log(`[${new Date().toISOString()}] Spawning aria2c in tmux session: ${sessionName}`);
                const download = spawn('bash', ['-c', installCmd], {
                    stdio: 'pipe'
                });

                download.on('close', (code) => {
                    console.log(`[${new Date().toISOString()}] Setup completed with code: ${code}`);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        status: 'success',
                        message: `Download started in tmux session: ${sessionName}`,
                        sessionName: sessionName,
                        torrentPath: torrentPath,
                        outputDir: outputDir
                    }));
                });

                download.stderr.on('data', (data) => {
                    console.error(`[${new Date().toISOString()}] [ARIA2_STDERR] ${data.toString().trim()}`);
                });
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error parsing torrent request: ${error.message}`);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    } else {
        console.warn(`[${new Date().toISOString()}] Unhandled request: ${req.method} ${req.url}`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Test server running on port ${PORT}`);
});
