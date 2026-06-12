const admin = require('firebase-admin');

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
admin.initializeApp({ projectId: 'demo-bug-app' });
const firestore = admin.firestore();

const baseUrl = 'http://localhost:8082/api';
let token = '';
let sessionId = '';
let userId = '';

async function testCRUD() {
  console.log('--- STARTING CRUD TESTS ---');
  try {
    const email = `test_${Date.now()}@test.com`;

    // 1. SIGNUP (CREATE)
    console.log('1. Testing POST /auth/signup (Create User)');
    const signupRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123', fullName: 'Test User' })
    });
    const signupData = await signupRes.json();
    if (!signupRes.ok) throw new Error(`Signup failed: ${JSON.stringify(signupData)}`);
    console.log('Signup successful. Fetching OTP from DB...');

    // Fetch OTP from Firestore
    const otpDocs = await firestore.collection('otps').where('email', '==', email).get();
    if (otpDocs.empty) throw new Error('OTP not found in DB');
    const otpCode = otpDocs.docs[0].data().otp;
    console.log(`Found OTP: ${otpCode}`);

    // 1b. VERIFY OTP
    console.log('1b. Testing POST /auth/verify-otp');
    const verifyRes = await fetch(`${baseUrl}/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp: otpCode })
    });
    const verifyData = await verifyRes.json();
    if (!verifyRes.ok) throw new Error(`Verify failed: ${JSON.stringify(verifyData)}`);
    token = verifyData.token;
    console.log('Verify successful.');

    // 2. ME (READ)
    console.log('2. Testing GET /auth/me (Read User)');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const meData = await meRes.json();
    if (!meRes.ok) throw new Error(`Me failed: ${JSON.stringify(meData)}`);
    console.log('Me successful.', meData.user ? 'User retrieved' : 'User missing');
    userId = meData.user?.id;

    // 3. SAVE GEMINI TOKEN (UPDATE USER)
    console.log('3. Testing POST /auth/save-gemini-token (Update User)');
    const saveTokenRes = await fetch(`${baseUrl}/auth/save-gemini-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ accessToken: 'fake-token' })
    });
    const saveTokenData = await saveTokenRes.json();
    if (!saveTokenRes.ok) throw new Error(`Save token failed: ${JSON.stringify(saveTokenData)}`);
    console.log('Save token successful.');

    // 4. CHAT (CREATE SESSION & MESSAGE)
    console.log('4. Testing POST /chat (Create Chat Session & Message)');
    const chatRes = await fetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Hello' }] }],
        modelId: 'google/gemini-fallback',
        webSearch: false
      })
    });
    const chatData = await chatRes.json();
    if (!chatRes.ok) throw new Error(`Chat failed: ${JSON.stringify(chatData)}`);
    console.log('Chat successful. Session ID:', chatData.sessionId);
    sessionId = chatData.sessionId;

    // 5. CHAT HISTORY (READ SESSION)
    console.log('5. Testing GET /chat/history (Read Chat Session)');
    const historyRes = await fetch(`${baseUrl}/chat/history?sessionId=${sessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const historyData = await historyRes.json();
    if (!historyRes.ok) throw new Error(`History failed: ${JSON.stringify(historyData)}`);
    console.log('History successful.', historyData.messages ? historyData.messages.length : 0, 'messages.');

    // 6. SESSIONS (READ SESSIONS LIST)
    console.log('6. Testing GET /chat/sessions (Read Chat Sessions List)');
    const sessionsRes = await fetch(`${baseUrl}/chat/sessions`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const sessionsData = await sessionsRes.json();
    if (!sessionsRes.ok) throw new Error(`Sessions failed: ${JSON.stringify(sessionsData)}`);
    console.log('Sessions successful.', sessionsData.sessions ? sessionsData.sessions.length : 0, 'sessions.');

    // 7. SESSION [id] PUT (UPDATE SESSION)
    console.log('7. Testing PUT /chat/session/[id] (Update Session)');
    const putRes = await fetch(`${baseUrl}/chat/session/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title: 'Updated Title' })
    });
    const putData = await putRes.json();
    if (!putRes.ok) throw new Error(`Session PUT failed: ${JSON.stringify(putData)}`);
    console.log('Session PUT successful.');

    // 8. SESSION [id] DELETE (DELETE SESSION)
    console.log('8. Testing DELETE /chat/session/[id] (Delete Session)');
    const delRes = await fetch(`${baseUrl}/chat/session/${sessionId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const delData = await delRes.json();
    if (!delRes.ok) throw new Error(`Session DELETE failed: ${JSON.stringify(delData)}`);
    console.log('Session DELETE successful.');

    console.log('--- ALL TESTS PASSED ---');
  } catch (err) {
    console.error('--- TEST FAILED ---');
    console.error(err);
  } finally {
    process.exit(0);
  }
}

testCRUD();
