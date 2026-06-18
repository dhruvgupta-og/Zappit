const { GoogleAuth } = require('google-auth-library');

async function testWriteREST() {
  console.log('Obtaining auth token...');
  const auth = new GoogleAuth({
    keyFile: './serviceAccountKey.json',
    scopes: ['https://www.googleapis.com/auth/datastore']
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  console.log('Access token obtained successfully!');

  const project = 'zappit-90a73';
  const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/coupons`;
  
  const body = {
    fields: {
      code: { stringValue: 'REST_TEST' },
      discount_percent: { integerValue: '15' },
      created_at: { stringValue: new Date().toISOString() }
    }
  };

  console.log('Sending POST request to Firestore REST API...');
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token.token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response body:', JSON.stringify(data, null, 2));
}

testWriteREST().catch(console.error);
