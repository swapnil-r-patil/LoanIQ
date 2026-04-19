const fs = require('fs');

async function testFetch() {
  try {
    const formData = new URLSearchParams();
    formData.append('transcript', 'Hello world');
    formData.append('liveness', 'true');
    // no panImage for initial test
    
    console.log('Sending request to backend...');
    const response = await fetch('http://localhost:5000/process-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });
    
    console.log('Status code:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 500));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testFetch();
