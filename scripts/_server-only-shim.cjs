// Preload shim for running server-side service files (which all start with
// `import "server-only"`) from a plain Node/tsx script instead of through
// Next's bundler. Next.js has built-in special-casing that resolves
// "server-only" to a harmless no-op when bundling server code; outside
// Next, the real package's default export throws unconditionally by
// design. This surgically redirects ONLY the "server-only" specifier to a
// local no-op module — nothing else about module resolution changes, so
// it can't mask or alter any other import behavior.
//
// Used by: scripts/verify-phase8-idempotency.ts (see its own header for the
// invocation command).
const Module = require("module");
const path = require("path");

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") {
    return path.join(__dirname, "_server-only-empty.cjs");
  }
  return originalResolveFilename.call(this, request, ...rest);
};
