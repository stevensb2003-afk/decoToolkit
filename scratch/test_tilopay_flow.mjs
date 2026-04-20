
async function testFullFlow() {
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
  console.log("Token obtained");

  const orderId = "TEST-" + Date.now();

  // Create Link
  console.log(`Creating link for order: ${orderId}`);
  const createRes = await fetch(`${baseUrl}/api/v1/createLinkPayment`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      key,
      amount: "100.00",
      currency: "CRC",
      reference: orderId,
      orderNumber: orderId,
      type: 1,
      capture: "1",
      subscription: "0",
      platform: "DecoToolkit",
      token_version: "v2",
      client: "Test Client",
      description: "Test Payment",
      billToFirstName: "Test",
      billToLastName: "User",
      billToEmail: "test@example.com"
    })
  });

  const createData = await createRes.json();
  console.log("Create Link Response:", JSON.stringify(createData, null, 2));

  if (createData.url) {
    const tilopayId = createData.id;

    // Test consulting with orderNumber = our orderId
    console.log(`\n1. Consulting with orderNumber: ${orderId}`);
    const res1 = await fetch(`${baseUrl}/api/v1/consult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ key, orderNumber: orderId })
    });
    console.log(`Result 1:`, await res1.json());

    // Test consulting with orderNumber = Tilopay's returned id
    console.log(`\n2. Consulting with orderNumber: ${tilopayId}`);
    const res2 = await fetch(`${baseUrl}/api/v1/consult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ key, orderNumber: tilopayId })
    });
    console.log(`Result 2:`, await res2.json());

    // Maybe the field is "id"?
    console.log(`\n3. Consulting with id: ${tilopayId}`);
    const res3 = await fetch(`${baseUrl}/api/v1/consult`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ key, id: tilopayId })
    });
    console.log(`Result 3:`, await res3.json());
  }
}

testFullFlow();
