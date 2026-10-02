// The Apple association document must be available directly, with no redirect.
// Set BRIEFLY_APPLE_APP_ID_PREFIX in the Vercel production environment.
const IOS_BUNDLE_ID = "com.hybridgalaxy.briefly";

module.exports = function handler(request, response) {
  const prefix = String(process.env.BRIEFLY_APPLE_APP_ID_PREFIX || "")
    .trim()
    .toUpperCase();

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (!/^[A-Z0-9]{10}$/.test(prefix)) {
    response.statusCode = 503;
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify({ error: "Briefly iOS association is not configured" }));
    return;
  }

  response.statusCode = 200;
  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  response.end(JSON.stringify({
    applinks: {
      details: [{
        appIDs: [`${prefix}.${IOS_BUNDLE_ID}`],
        components: [
          { "/": "/s/*" },
          { "/": "/story/*" },
          { "/": "/share/*" }
        ]
      }]
    }
  }));
};
