const ATTOM_BASE = 'https://api.gateway.attomdata.com/propertyapi/v1.0.0';

const headers = () => ({
  'apikey': process.env.ATTOM_API_KEY,
  'Accept': 'application/json'
});

async function getAVM(address) {
  try {
    const parts = parseAddress(address);
    if (!parts) return null;

    const params = new URLSearchParams({
      address1: parts.street,
      address2: parts.cityStateZip
    });

    const res = await fetch(`${ATTOM_BASE}/avm/detail?${params}`, {
      headers: headers()
    });

  if (!res.ok) {
      const errText = await res.text();
      console.error('ATTOM AVM error:', res.status, errText.substring(0, 300));
      return null;
    }
    const data = await res.json();
    console.log('ATTOM AVM data:', JSON.stringify(data).substring(0, 300));

    const data = await res.json();
    const property = data?.property?.[0];
    if (!property) return null;

    const avm = property?.avm;
    return {
      estimate: avm?.amount?.value || null,
      low: avm?.amount?.low || null,
      high: avm?.amount?.high || null,
      change: avm?.chng?.value || null,
    };
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

    const res = await fetch(`${ATTOM_BASE}/sale/snapshot?${params}`, {
      headers: headers()
    });

   if (!res.ok) {
      const errText = await res.text();
      console.error('ATTOM Sales error:', res.status, errText.substring(0, 300));
      return null;
    }
    const data = await res.json();
    console.log('ATTOM Sales data:', JSON.stringify(data).substring(0, 300));
    const sales = data?.property || [];
    if (sales.length === 0) return null;

    const prices = sales
      .map(p => p?.sale?.amount?.saleamt)
      .filter(v => v && v > 0);

    const domValues = sales
      .map(p => p?.sale?.calculation?.daysOnMarket)
      .filter(v => v && v > 0);

    const sqftPrices = sales.map(p => {
      const price = p?.sale?.amount?.saleamt;
      const sqft = p?.building?.size?.universalsize;
      return price && sqft && sqft > 0 ? Math.round(price / sqft) : null;
    }).filter(Boolean);

    const saleToListValues = sales
      .map(p => p?.sale?.amount?.saleToListPriceRatio)
      .filter(v => v && v > 0);

    return {
      medianPrice: prices.length > 0 ? formatCurrency(median(prices)) : null,
      homesSold: sales.length,
      pricePerSqFt: sqftPrices.length > 0 ? '$' + Math.round(average(sqftPrices)).toLocaleString() : null,
      daysOnMarket: domValues.length > 0 ? Math.round(average(domValues)).toString() : null,
      saleToList: saleToListValues.length > 0 ? Math.round(average(saleToListValues) * 100) + '%' : null,
    };
  } catch (e) {
    console.error('ATTOM market stats exception:', e);
    return null;
  }
}

function parseAddress(fullAddress) {
  if (!fullAddress) return null;
  const parts = fullAddress.split(',');
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
