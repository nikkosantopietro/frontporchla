const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

const headers = () => ({
  'apikey': process.env.ATTOM_API_KEY,
  'Accept': 'application/json'
});

// Get an AVM (automated valuation) for a single address.
// Tries the single-property AVM detail endpoint first, then the snapshot.
// Returns { estimate, low, high, change, sqft } or null.
async function getAVM(address) {
  try {
    const parts = parseAddress(address);
    if (!parts) return null;

    const params = new URLSearchParams({
      address1: parts.street,
      address2: parts.cityStateZip
    });

    const endpoints = ['/attomavm/detail', '/avm/snapshot'];
    for (const ep of endpoints) {
      let res;
      try {
        res = await fetch(`${ATTOM_BASE}${ep}?${params}`, { headers: headers() });
      } catch (e) {
        console.error('ATTOM fetch error', ep, e);
        continue;
      }
      if (!res.ok) {
        const errText = await res.text();
        console.error('ATTOM AVM error:', ep, res.status, errText.substring(0, 200));
        continue;
      }
      const data = await res.json();
      const property = data && data.property && data.property[0];
      if (!property) continue;
      const avm = property.avm;
      const value = avm && avm.amount && avm.amount.value;
      if (value) {
        const size = property.building && property.building.size;
        return {
          estimate: value,
          low: (avm.amount && avm.amount.low) || Math.round(value * 0.92),
          high: (avm.amount && avm.amount.high) || Math.round(value * 1.08),
          change: (avm.amount && avm.amount.scr) || null,
          sqft: (size && (size.universalsize || size.livingsize)) || null,
          source: ep,
        };
      }
    }
    return null;
  } catch (e) {
    console.error('ATTOM AVM exception:', e);
    return null;
  }
}

async function getMarketStats(zip) {
  try {
    const endDate = getLastMonthEnd();
    const startDate = getLastMonthStart();

    const params = new URLSearchParams({
      postalcode: zip,
      startsalesearchdate: startDate,
      endsalesearchdate: endDate
    });

    const res = await fetch(`${ATTOM_BASE}/sale/snapshot?${params}`, { headers: headers() });
    if (!res.ok) {
      const errText = await res.text();
      console.error('ATTOM Sales error:', res.status, errText.substring(0, 200));
      return null;
    }

    const salesData = await res.json();
    const sales = salesData && salesData.property || [];
    if (sales.length === 0) return null;

    const prices = sales
      .map(p => p && p.sale && p.sale.amount && p.sale.amount.saleamt)
      .filter(v => v && v > 0);

    const sqftPrices = sales.map(p => {
      const price = p && p.sale && p.sale.amount && p.sale.amount.saleamt;
      const sqft = p && p.building && p.building.size && p.building.size.universalsize;
      return price && sqft && sqft > 0 ? Math.round(price / sqft) : null;
    }).filter(Boolean);

    return {
      medianPrice: prices.length > 0 ? formatCurrency(median(prices)) : null,
      homesSold: sales.length,
      pricePerSqFt: sqftPrices.length > 0 ? '$' + Math.round(average(sqftPrices)).toLocaleString() : null,
    };
  } catch (e) {
    console.error('ATTOM market stats exception:', e);
    return null;
  }
}

function parseAddress(fullAddress) {
  if (!fullAddress) return null;
  const cleaned = fullAddress.replace(/,?\s*USA\s*$/i, '').trim();
  const parts = cleaned.split(',');
  if (parts.length < 2) return null;
  const street = parts[0].trim();
  const cityStateZip = parts.slice(1).join(',').trim();
  return { street, cityStateZip };
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function average(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function formatCurrency(num) {
  if (!num) return null;
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K';
  return '$' + Math.round(num).toLocaleString();
}

function getLastMonthStart() {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

function getLastMonthEnd() {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().split('T')[0];
}

function getZipFromAddress(address) {
  const match = address && address.match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

module.exports = { getAVM, getMarketStats, getZipFromAddress };

