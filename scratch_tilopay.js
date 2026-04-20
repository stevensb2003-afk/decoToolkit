const fs = require('fs');

require('dotenv').config({ path: '.env.local' });

async function getTilopayToken() {
  const url = `${process.env.TILOPAY_BASE_URL}/api/v1/login`;
  const payload = {
    apiuser: process.env.TILOPAY_API_USER,
    password: process.env.TILOPAY_API_PASSWORD
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (data.access_token) return data.access_token;
  if (data.token) return data.token;
  throw new Error("Respuesta de login inesperada de Tilopay");
}

async function checkTransactionStatus(orderNumber) {
  const url = `${process.env.TILOPAY_BASE_URL}/api/v1/consult`;
  const token = await getTilopayToken();

  const payload = {
    key: process.env.TILOPAY_API_KEY,
    orderNumber: orderNumber,
    token_version: "v2",
    platform: "DecoToolkit"
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json();
  return result;
}

async function run() {
  try {
    const res1 = await checkTransactionStatus("206044");
    console.log("206044 result:", JSON.stringify(res1, null, 2));

    const res2 = await checkTransactionStatus("206048"); // another ID
    console.log("206048 result:", JSON.stringify(res2, null, 2));

    const res3 = await checkTransactionStatus("ORD-1776566270EKS"); 
    console.log("ORD result:", JSON.stringify(res3, null, 2));
  } catch (err) {
    console.error("Error:", err.message);
  }
}
run();
