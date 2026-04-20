const https = require('https');

const email = "gerencia@decoinnovacr.com";
const token = "e07daa942f211c63e120";
const authHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;

const ghostIds = [
  '0tGNcPDOYRMDQD2owFkC',
  '1nUWOoHkoA55UqyjM0Jm',
  '2UvFdbrBDGotzpDYDKxG',
  '4HGzobqcFCG3hO747cIw',
  '5nsPZ8KO8aeFePTfmY0v'
];

async function getAlegraData(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.alegra.com',
      path: `/api/v1/${endpoint}`,
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve([]);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function searchAlegra() {
  console.log('Searching Alegra for project references...');
  
  const endpoints = ['invoices', 'estimates', 'contacts'];
  
  for (const endpoint of endpoints) {
    console.log(`Checking ${endpoint}...`);
    const items = await getAlegraData(endpoint);
    if (!Array.isArray(items)) {
        console.log(`  Invalid response for ${endpoint}`);
        continue;
    }
    
    items.forEach(item => {
      const text = JSON.stringify(item);
      for (const ghostId of ghostIds) {
        if (text.includes(ghostId)) {
          console.log(`[MATCH FOUND] ID ${ghostId} found in Alegra ${endpoint}/${item.id}`);
          if (item.client) console.log(`  Client: ${item.client.name}`);
          if (item.name) console.log(`  Name: ${item.name}`);
          if (item.observations) console.log(`  Observations: ${item.observations}`);
        }
      }
    });
  }
  console.log('Done.');
}

searchAlegra().catch(console.error);
