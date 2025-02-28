const dns = require('dns');

const domain = 'partscentraalws.aldoc.eu';

dns.resolve4(domain, (err, addresses) => {
  if (err) {
    console.error(`DNS lookup failed: ${err.message}`);
    return;
  }

  console.log(`Resolved IP addresses for ${domain}: ${addresses}`);
});
