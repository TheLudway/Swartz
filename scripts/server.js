const http = require('http');
const { spawn } = require('child_process');

const PORT = 3000;

const server = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/run-test') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const query = data.query;

                if (!query) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'No query provided' }));
                    return;
                }

                const env = { ...process.env, SEARCH_QUERY: query };
                const test = spawn('npx', ['playwright', 'test'], {
                    cwd: '/home/pwuser/project',
                    stdio: 'pipe',
                    env: env
                });

                let output = '';
                test.stdout.on('data', (data) => {
                    output += data.toString();
                });

                test.stderr.on('data', (data) => {
                    output += data.toString();
                });

                test.on('close', (code) => {
                    res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        status: code === 0 ? 'success' : 'failed',
                        output: output 
                    }));
                });
            } catch (error) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
    }
});

server.listen(PORT, () => {
    console.log(`Test server running on port ${PORT}`);
});
