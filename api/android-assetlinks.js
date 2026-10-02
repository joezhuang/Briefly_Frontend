// Use the Google Play *app-signing* SHA-256 fingerprint, not an upload key.
// For internal/preview builds, include their additional signing fingerprints
// only if those builds use the same verified package and host.
const PACKAGE = "com.hybridgalaxy.briefly";
const SHA256 = /^(?:[0-9A-F]{2}:){31}[0-9A-F]{2}$/;

module.exports = function handler(request, response) {
  const raw = String(process.env.BRIEFLY_ANDROID_SHA256_CERT_FINGERPRINTS || "");
  const fingerprints = [...new Set(
    raw.split(/[;,\n]/).map((part) => part.trim().toUpperCase()).filter(Boolean)
  )];

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (!fingerprints.length || fingerprints.some((value) => !SHA256.test(value))) {
    response.statusCode = 503;
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify({ error: "Briefly Android app association is not configured" }));
    return;
  }

  response.statusCode = 200;
  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  response.end(JSON.stringify([{
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: PACKAGE,
      sha256_cert_fingerprints: fingerprints
    }
  }]));
};
