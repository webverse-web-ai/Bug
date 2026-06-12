const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function run() {
  try {
    const signupRes = await fetch('http://localhost:8082/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: 'Test', email: 'test12345@test.com', password: 'Password123!' })
    });
    const signupData = await signupRes.json();
    console.log('Signup Response:', signupData);
    
    const loginRes = await fetch('http://localhost:8082/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test12345@test.com', password: 'Password123!' })
    });
    const loginData = await loginRes.json();
    console.log('Login Response:', loginData);
    
    if (loginData.token) {
      const saveRes = await fetch('http://localhost:8082/api/auth/save-gemini-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${loginData.token}`
        },
        body: JSON.stringify({ accessToken: 'test_fake_gemini_token' })
      });
      const saveData = await saveRes.json();
      console.log('Save Token Response:', saveData);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}
run();
