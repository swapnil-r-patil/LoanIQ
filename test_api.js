const http = require('http');

const req = http.request(
  'http://localhost:5000/process-data',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  },
  (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => console.log('Response Status:', res.statusCode, 'Data:', data));
  }
);
req.on('error', (err) => console.error('Fetch error:', err.message));
req.write('transcript=Test&liveness=true');
req.end();
