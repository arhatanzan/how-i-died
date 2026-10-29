// Test script to verify audio/video upload functionality
const BASE_URL = 'https://how-i-died.netlify.app';

async function login(username, password) {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'journal-app',
    },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  console.log('Login response:', { status: res.status, data });
  return res.ok;
}

async function startMediaUpload(metadata) {
  const res = await fetch(`${BASE_URL}/api/media`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-requested-with': 'journal-app',
    },
    body: JSON.stringify(metadata),
  });
  const data = await res.json();
  console.log('Media upload start response:', { status: res.status, data });
  return res.ok ? data : null;
}

async function testAudioUpload() {
  console.log('=== Testing Audio Upload ===');
  
  // Attempt login
  const authed = await login('keeper', 'password');
  if (!authed) {
    console.log('Login failed');
    return;
  }
  
  // Try to start a media upload
  const audioMetadata = {
    name: 'test-audio.webm',
    size: 1000,
    contentType: 'audio/webm',
    duration: 5,
  };
  
  const upload = await startMediaUpload(audioMetadata);
  if (upload) {
    console.log('✓ Audio upload initialization successful');
    console.log('Upload ID:', upload.id);
  } else {
    console.log('✗ Audio upload initialization failed');
  }
}

testAudioUpload().catch(console.error);
