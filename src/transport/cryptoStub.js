// Browser stub for subtls's Node-only `import("crypto")` fallback. In a browser
// (and Node 22) the global `crypto` exists, so subtls resolves WebCrypto from it
// and never runs the dynamic import - this module only exists so the bundler can
// resolve that dead branch instead of failing on the "crypto" Node builtin.
export const webcrypto = globalThis.crypto;
export default { webcrypto: globalThis.crypto };
