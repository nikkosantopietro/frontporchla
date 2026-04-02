const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

const headers = {
  'apikey': process.env.ATTOM_API_KEY,
  'Accept': 'application/json'
};

// Get AVM estimate for a specific address
async function getAVM(address) {
  try {
    const encoded = encodeURIComponent(address);
    const res = await fetch(`${ATTOM_BASE}/valuation/homequity?address=${encoded}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const property = data?.property?.[0];
    if (!property) return null;
    const avm = property?.avm;
    return {
      estimate: avm?.amount?.value || null,
      low: avm?.amount?.low || null,
      high: avm?.amount?.high || null,
      change: avm?.amount?.valueChange || null,
    };
  } catch (e) {
    console.error('ATTOM AVM error:', e);
    return null;
  }
}

// Get market stats for a zip code
async function getMarketStats(zip) {
  try {
    const res = await fetch(`${ATTOM_BASE}/sale/snapshot?postalcode=${zip}&startsalesearchdate=${getLastMonthStart()}&endsalesearchdate=${getLastMonthEnd()}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const sales = data?.property || [];
    if (sales.length === 0) return null;

    const prices = sales.map(p => p?.sale?.amount?.saleamt).filter(Boolean);
    const medianPrice = median(prices);
    const avgDom = average(sales.map(p => p?.sale?.amount?.salediscountpercent).filter(Boolean));
    const sqftPrices = sales.map(p => {
      const price = p?.sale?.amount?.saleamt;
      const sqft = p?.building?.size?.universalsize;
      return price && sqft ? price / sqft : null;
    }).filter(Boolean);

    return {
      medianPrice: medianPrice ? formatCurrency(medianPrice) : null,
      homesSold: sales.length,
      pricePerSqFt: sqftPrices.length > 0 ? '$' + Math.round(average(sqftPrices)).toLocaleString() : null,
    };
  } catch (e) {
    console.error('ATTOM market stats error:', e);
    return null;
  }
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
  if (num >= 1000000) return '$' + (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return '$' + Math.round(num / 1000) + 'K';
  return '$' + Math.round(num).toLocaleString();
}

function getLastMonthStart() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}

function getLastMonthEnd() {
  const d = new Date();
  d.setDate(0);
  return d.toISOString().split('T')[0];
}

function getZipFromAddress(address) {
  const match = address?.match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

module.exports = { getAVM, getMarketStats, getZipFromAddress };
