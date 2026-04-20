
async function testConsult() {
  const apiuser = "5yPm1K";
  const password = "LnupOK";
  const key = "7472-8350-7853-3508-4251";
  const baseUrl = "https://app.tilopay.com";

  // Login
  const loginRes = await fetch(`${baseUrl}/api/v1/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiuser, password })
  });
  const loginData = await loginRes.json();
  const token = loginData.access_token;

  const ordersToTest = ["DT-1776642026798", "205986", "205986-1"];

  for (const order of ordersToTest) {
    console.log(`Testing orderNumber: ${order}`);
    const consultRes = await fetch(`${baseUrl}/api/v1/consult`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ key, orderNumber: order })
    });
    const consultData = await consultRes.json();
    console.log(`Result for ${order}:`, JSON.stringify(consultData, null, 2));
  }
}

testConsult();
