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
                    const match = output.match(/EXTRACTED_RESULTS:(\[[\s\S]*?\])\n/);
                    if (match) {
                        try {
                            results = JSON.parse(match[1]);
                        } catch (e) {
                            console.error(`[${new Date().toISOString()}] Failed to parse extracted results: ${e.message}`);
                        }
                    }
                    
                    res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        status: code === 0 ? 'success' : 'failed',
                        output: output,
                        results: results
                    }));
                });
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error parsing request: ${error.message}`);
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
