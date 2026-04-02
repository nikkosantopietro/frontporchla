module.exports = function generateEmail(data) {
  const {
    agentName,
    agentInitials,
    brokerage,
    zoneName,
    month,
    year,
    medianPrice,
    medianPriceChange,
    pricePerSqFt,
    pricePerSqFtChange,
    saleToList,
    homesSold,
    homesSoldChange,
    daysOnMarket,
    daysOnMarketChange,
    activeListings,
    activeListingsChange,
    marketStatus,
    address,
    avmEstimate,
    avmLow,
    avmHigh,
    avmChange,
    articleTitle,
    articleBody,
    listingsUrl,
    homeValueUrl,
    contactUrl,
    unsubscribeUrl,
    agentId,
  } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your Monthly Neighborhood Report · ${zoneName}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4ee;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f4ee;padding:20px 0;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#ffffff;">

    <!-- HEADER -->
    <tr><td style="background:#4a6741;padding:32px 40px 24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:10px;letter-spacing:3px;color:#b8d4a8;text-transform:uppercase;font-family:Arial,sans-serif;">Front Porch LA</p>
      <p style="margin:0 0 4px;font-size:26px;color:#f5f9f2;font-weight:normal;font-family:Georgia,serif;">Your Monthly Neighborhood Report</p>
      <p style="margin:0;font-size:12px;color:#b8d4a8;letter-spacing:1px;font-family:Arial,sans-serif;">${month} ${year} &nbsp;·&nbsp; ${zoneName}</p>
    </td></tr>

    <!-- GREEN STRIPE -->
    <tr><td style="height:3px;background:#8ab87a;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- AGENT BAR -->
    <tr><td style="background:#f2f7ee;padding:14px 40px;border-bottom:1px solid #d4e8c8;">
      <table cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="width:42px;vertical-align:middle;">
            <div style="width:36px;height:36px;border-radius:50%;background:#4a6741;text-align:center;line-height:36px;font-size:12px;color:#f5f9f2;font-family:Arial,sans-serif;font-weight:bold;">${agentInitials}</div>
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <p style="margin:0;font-size:15px;color:#1e3318;font-weight:bold;font-family:Arial,sans-serif;">${agentName}</p>
            <p style="margin:2px 0 0;font-size:11px;color:#6a8f5e;font-family:Arial,sans-serif;">Your neighborhood expert &nbsp;·&nbsp; ${brokerage}</p>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- ZONE MAP -->
    <tr><td style="padding:28px 40px;border-bottom:1px solid #d4e8c8;">
      <p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4a6741;font-family:Arial,sans-serif;">Your Zone</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="background:#f2f7ee;border:1px solid #d4e8c8;border-radius:8px;padding:20px;text-align:center;">
          <p style="margin:0 0 10px;font-size:18px;color:#1e3318;font-family:Georgia,serif;">${zoneName}</p>
          <p style="margin:0;font-size:12px;color:#6a8f5e;font-family:Arial,sans-serif;font-style:italic;">Zone map loads in browser version</p>
        </td></tr>
      </table>
    </td></tr>

    <!-- INTRO -->
    <tr><td style="padding:28px 40px;border-bottom:1px solid #d4e8c8;background:#fafcf8;">
      <p style="margin:0;font-size:15px;line-height:1.8;color:#2c2c2a;font-family:Georgia,serif;">Pull up a chair — here's what happened in <em style="color:#4a6741;">${zoneName}</em> last month. Homes moved fast, buyers stayed competitive, and your neighborhood held its ground as one of the Westside's most sought-after pockets.</p>
    </td></tr>

    <!-- MARKET SNAPSHOT -->
    <tr><td style="padding:28px 40px;border-bottom:1px solid #d4e8c8;">
      <p style="margin:0 0 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4a6741;font-family:Arial,sans-serif;">Market Snapshot &nbsp;·&nbsp; ${month} ${year}</p>

      <!-- Market temperature bar -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;">
        <tr>
          <td style="width:60px;font-size:11px;color:#6a8f5e;font-family:Arial,sans-serif;vertical-align:middle;">Market:</td>
          <td style="vertical-align:middle;padding:0 10px;">
            <div style="height:6px;border-radius:3px;background:#d4e8c8;overflow:hidden;">
              <div style="height:100%;width:75%;background:#4a6741;border-radius:3px;"></div>
            </div>
          </td>
          <td style="white-space:nowrap;font-size:12px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;vertical-align:middle;">${marketStatus}</td>
        </tr>
      </table>

      <!-- Stats row 1 -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="32%" style="padding-right:5px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#f2f7ee;border:1px solid #d4e8c8;border-radius:7px;padding:13px 8px;text-align:center;">
                <p style="margin:0;font-size:19px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;">${medianPrice}</p>
                <p style="margin:3px 0 2px;font-size:9px;color:#6a8f5e;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.7px;">Median sale price</p>
                <p style="margin:0;font-size:10px;color:#2d7a4f;font-family:Arial,sans-serif;">${medianPriceChange}</p>
              </td></tr>
            </table>
          </td>
          <td width="32%" style="padding:0 3px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#f2f7ee;border:1px solid #d4e8c8;border-radius:7px;padding:13px 8px;text-align:center;">
                <p style="margin:0;font-size:19px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;">${pricePerSqFt}</p>
                <p style="margin:3px 0 2px;font-size:9px;color:#6a8f5e;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.7px;">Price per sq ft</p>
                <p style="margin:0;font-size:10px;color:#2d7a4f;font-family:Arial,sans-serif;">${pricePerSqFtChange}</p>
              </td></tr>
            </table>
          </td>
          <td width="32%" style="padding-left:5px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#f2f7ee;border:1px solid #d4e8c8;border-radius:7px;padding:13px 8px;text-align:center;">
                <p style="margin:0;font-size:19px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;">${saleToList}</p>
                <p style="margin:3px 0 2px;font-size:9px;color:#6a8f5e;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.7px;">Sale-to-list ratio</p>
                <p style="margin:0;font-size:10px;color:#6a8f5e;font-family:Arial,sans-serif;">Over asking</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Stats row 2 -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:9px;">
        <tr>
          <td width="32%" style="padding-right:5px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#f2f7ee;border:1px solid #d4e8c8;border-radius:7px;padding:13px 8px;text-align:center;">
                <p style="margin:0;font-size:19px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;">${homesSold}</p>
                <p style="margin:3px 0 2px;font-size:9px;color:#6a8f5e;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.7px;">Homes sold</p>
                <p style="margin:0;font-size:10px;color:#2d7a4f;font-family:Arial,sans-serif;">${homesSoldChange}</p>
              </td></tr>
            </table>
          </td>
          <td width="32%" style="padding:0 3px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#f2f7ee;border:1px solid #d4e8c8;border-radius:7px;padding:13px 8px;text-align:center;">
                <p style="margin:0;font-size:19px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;">${daysOnMarket}</p>
                <p style="margin:3px 0 2px;font-size:9px;color:#6a8f5e;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.7px;">Days on market</p>
                <p style="margin:0;font-size:10px;color:#a33d2d;font-family:Arial,sans-serif;">${daysOnMarketChange}</p>
              </td></tr>
            </table>
          </td>
          <td width="32%" style="padding-left:5px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td style="background:#f2f7ee;border:1px solid #d4e8c8;border-radius:7px;padding:13px 8px;text-align:center;">
                <p style="margin:0;font-size:19px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;">${activeListings}</p>
                <p style="margin:3px 0 2px;font-size:9px;color:#6a8f5e;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:.7px;">Active listings</p>
                <p style="margin:0;font-size:10px;color:#a33d2d;font-family:Arial,sans-serif;">${activeListingsChange}</p>
                <a href="https://frontporchla.com/api/track?sid=${subscriberId}&lid=listings&dest=${encodeURIComponent(listingsUrl)}" style="font-size:10px;color:#4a6741;font-family:Arial,sans-serif;display:block;margin-top:3px;">View listings →</a>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- ATTOM HOME VALUE -->
    <tr><td style="padding:28px 40px;border-bottom:1px solid #d4e8c8;">
      <p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4a6741;font-family:Arial,sans-serif;">Your Home's Estimated Value</p>
      <a href="https://frontporchla.com/api/track?sid=${subscriberId}&lid=home-value&dest=${encodeURIComponent(homeValueUrl)}" style="text-decoration:none;display:block;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="background:#1e3318;border-radius:8px;padding:20px 22px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align:middle;">
                  <p style="margin:0 0 5px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#b8d4a8;font-family:Arial,sans-serif;">ATTOM Estimate &nbsp;·&nbsp; ${address}</p>
                 ${avmEstimate && avmEstimate !== 'N/A' ? `
        <p style="margin:0;font-size:27px;color:#f5f9f2;font-family:Arial,sans-serif;font-weight:bold;text-decoration:underline;text-underline-offset:3px;">${avmEstimate}</p>
        <p style="margin:3px 0 0;font-size:11px;color:#8ab87a;font-family:Arial,sans-serif;">Range: ${avmLow} – ${avmHigh}</p>
        <p style="margin:6px 0 0;font-size:10px;color:#8ab87a;font-family:Arial,sans-serif;font-style:italic;">How is this calculated? →</p>
        ` : `
        <p style="margin:0;font-size:16px;color:#f5f9f2;font-family:Georgia,serif;font-style:italic;line-height:1.5;">Want to know what your home is worth?</p>
        <p style="margin:8px 0 0;font-size:13px;color:#8ab87a;font-family:Arial,sans-serif;">I'll give you a free, in-person home valuation — it takes about 15 minutes and there's no obligation.</p>
        `}
                </td>
                <td style="text-align:right;vertical-align:middle;padding-left:16px;">
                  <p style="margin:0;font-size:16px;color:#7ecb9a;font-family:Arial,sans-serif;font-weight:bold;">${avmChange}</p>
                  <p style="margin:3px 0 0;font-size:10px;color:#8ab87a;font-family:Arial,sans-serif;">vs. last month</p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </a>
    </td></tr>

    <!-- NEIGHBORHOOD ARTICLE -->
    <tr><td style="padding:28px 40px;border-bottom:1px solid #d4e8c8;">
      <p style="margin:0 0 10px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4a6741;font-family:Arial,sans-serif;">Around the Neighborhood</p>
      <p style="margin:0 0 10px;font-size:17px;color:#1e3318;font-family:Georgia,serif;line-height:1.4;">${articleTitle}</p>
      <p style="margin:0;font-size:14px;line-height:1.8;color:#5f5e5a;font-family:Georgia,serif;">${articleBody}</p>
    </td></tr>

<!-- TOOLS ROW -->
    <tr><td style="padding:20px 40px;border-bottom:1px solid #d4e8c8;background:#f2f7ee;">
      <p style="margin:0 0 12px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#4a6741;font-family:Arial,sans-serif;">Homeowner tools</p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td width="50%" style="padding-right:8px;">
            <a href="https://frontporchla.com/api/track?sid=${subscriberId}&lid=capital-gains&dest=${encodeURIComponent('https://frontporchla.com/capital-gains.html?agent=' + agentId)}" style="display:block;background:#ffffff;border:1px solid #d4e8c8;border-radius:8px;padding:14px 16px;text-decoration:none;">
              <p style="margin:0 0 4px;font-size:13px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;">💰 Capital Gains Calculator</p>
              <p style="margin:0;font-size:11px;color:#6a8f5e;font-family:Arial,sans-serif;">Estimate your tax exposure before you sell</p>
            </a>
          </td>
          <td width="50%" style="padding-left:8px;">
            <a href="https://frontporchla.com/home-value.html?agent=${agentId}" style="display:block;background:#ffffff;border:1px solid #d4e8c8;border-radius:8px;padding:14px 16px;text-decoration:none;">
              <p style="margin:0 0 4px;font-size:13px;color:#1e3318;font-family:Arial,sans-serif;font-weight:bold;">🏡 How Is My Home Valued?</p>
              <p style="margin:0;font-size:11px;color:#6a8f5e;font-family:Arial,sans-serif;">Understand your ATTOM estimate</p>
            </a>
          </td>
        </tr>
      </table>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:32px 40px;text-align:center;background:#f2f7ee;">
      <p style="margin:0 0 18px;font-size:15px;color:#4a6741;font-style:italic;line-height:1.7;font-family:Georgia,serif;">Thinking about what your home is worth, or just curious what's out there?<br>I'm always happy to talk — no pressure, just a good conversation.</p>
      <a href="${contactUrl}" style="display:inline-block;background:#4a6741;color:#f5f9f2;padding:12px 28px;border-radius:4px;font-size:13px;letter-spacing:1px;font-family:Arial,sans-serif;text-decoration:none;">Get in touch with ${agentName.split(' ')[0]} →</a>
    </td></tr>

    <!-- GREEN STRIPE -->
    <tr><td style="height:3px;background:#8ab87a;font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- FOOTER -->
    <tr><td style="background:#1e3318;padding:20px 40px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#8ab87a;line-height:1.8;font-family:Arial,sans-serif;">
        You're receiving this because you're a homeowner in ${zoneName}.<br>
        Front Porch LA &nbsp;·&nbsp; 331 Foothill Rd, Beverly Hills CA 90210<br>
        <a href="${unsubscribeUrl}" style="color:#b8d4a8;">Unsubscribe</a> &nbsp;·&nbsp; <a href="#" style="color:#b8d4a8;">Update preferences</a>
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;
};
