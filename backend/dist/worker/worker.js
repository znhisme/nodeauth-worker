var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// ../src/shared/utils/logger.ts
import process2 from "process";
var LogLevelMap, Logger, logger;
var init_logger = __esm({
  "../src/shared/utils/logger.ts"() {
    "use strict";
    LogLevelMap = {
      debug: 0 /* DEBUG */,
      info: 1 /* INFO */,
      warn: 2 /* WARN */,
      error: 3 /* ERROR */
    };
    Logger = class {
      level = 1 /* INFO */;
      constructor() {
        this.initializeFromEnv();
      }
      /**
       * 自动从环境变量同步日志级别 (支持 Docker / Cloudflare 各种环境杂质清洗)
       */
      initializeFromEnv() {
        const raw = process2.env.LOG_LEVEL;
        if (raw) {
          const normalized = raw.trim().replace(/["']/g, "").toLowerCase();
          const target = LogLevelMap[normalized];
          if (target !== void 0) {
            this.level = target;
          }
        }
      }
      /**
       * 手动更新级别 (保留去干扰清洗逻辑)
       */
      setLevel(level) {
        const newLevel = typeof level === "string" ? LogLevelMap[level.trim().replace(/["']/g, "").toLowerCase()] : level;
        if (newLevel !== void 0) {
          this.level = newLevel;
        }
      }
      format(level, message) {
        return `[${(/* @__PURE__ */ new Date()).toISOString()}] [${level.toUpperCase()}] ${message}`;
      }
      log(targetLevel, levelName, message, ...args) {
        if (this.level <= targetLevel) {
          const method = levelName === "debug" ? "log" : levelName;
          console[method](this.format(levelName, message), ...args);
        }
      }
      debug(m, ...a) {
        this.log(0 /* DEBUG */, "debug", m, ...a);
      }
      info(m, ...a) {
        this.log(1 /* INFO */, "info", m, ...a);
      }
      warn(m, ...a) {
        this.log(2 /* WARN */, "warn", m, ...a);
      }
      error(m, ...a) {
        this.log(3 /* ERROR */, "error", m, ...a);
      }
    };
    logger = new Logger();
  }
});

// ../src/app/config.ts
var SECURITY_CONFIG, CSP_POLICY, getEffectiveCSP, AppError;
var init_config = __esm({
  "../src/app/config.ts"() {
    "use strict";
    SECURITY_CONFIG = {
      MAX_LOGIN_ATTEMPTS: 5,
      LOCKOUT_TIME: 15 * 60 * 1e3,
      JWT_EXPIRY: 24 * 60 * 60,
      // 24小时
      MAX_INPUT_LENGTH: 100,
      MIN_EXPORT_PASSWORD_LENGTH: 12,
      MAX_OAUTH_ATTEMPTS: 3,
      OAUTH_LOCKOUT_TIME: 10 * 60 * 1e3,
      MAX_FILE_SIZE: 10 * 1024 * 1024
    };
    CSP_POLICY = {
      // 脚本源: 允许本站、内联脚本(Vue必需) 以及 Cloudflare 统计脚本
      SCRIPTS: [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "'wasm-unsafe-eval'",
        "https://static.cloudflareinsights.com"
      ],
      // 图片源: 允许本站、GitHub 头像、NodeLoc 头像、WalletConnect 链上资产Logo
      IMAGES: [
        "'self'",
        "data:",
        "blob:",
        "https://avatars.githubusercontent.com",
        "https://t.me",
        // Telegram User Avatars
        "https://*.telesco.pe",
        // Telegram Avatar CDN
        "https://www.nodeloc.com",
        "https://lh3.googleusercontent.com",
        // Google User Avatars
        "https://www.google.com",
        // Google Favicon API
        "https://*.gstatic.com",
        // Google 静态资源 (包括所有 t 系列 CDN)
        "https://icons.bitwarden.net",
        // Bitwarden Icon API
        "https://favicon.im",
        // Favicon.im API
        "https://explorer-api.walletconnect.com",
        // 允许加载各种Web3钱包Logo图库
        "https://*.blizzard.com",
        "https://*.battle.net"
      ],
      CONNECT: [
        "'self'",
        "https://api.github.com",
        "https://github.com",
        "https://cloudflareinsights.com",
        "https://static.cloudflareinsights.com",
        "https://accounts.google.com",
        "https://www.googleapis.com",
        "https://login.microsoftonline.com",
        "https://graph.microsoft.com",
        "https://openapi.baidu.com",
        "https://pan.baidu.com",
        "https://api.dropboxapi.com",
        "https://content.dropboxapi.com",
        "https://www.dropbox.com",
        // WalletConnect (External) - Only needed if Proxy is OFF
        "wss://relay.walletconnect.com",
        "wss://relay.walletconnect.org",
        "https://rpc.walletconnect.com",
        "https://verify.walletconnect.com",
        "https://verify.walletconnect.org"
      ],
      // 框架源: WalletConnect 防钓鱼 Verify API 必需挂载 iframe
      FRAMES: [
        "'self'",
        "https://verify.walletconnect.com",
        "https://verify.walletconnect.org"
      ]
    };
    getEffectiveCSP = (env) => {
      const isProxyOn = env.OAUTH_WALLETCONNECT_SELF_PROXY === "true";
      const connectSet = /* @__PURE__ */ new Set([...CSP_POLICY.CONNECT]);
      const imagesSet = /* @__PURE__ */ new Set([...CSP_POLICY.IMAGES]);
      const framesSet = /* @__PURE__ */ new Set([...CSP_POLICY.FRAMES]);
      connectSet.add("https://cloudflare-eth.com");
      if (env.OAUTH_WALLETCONNECT_RPC_URL) {
        try {
          const rpcOrigin = new URL(env.OAUTH_WALLETCONNECT_RPC_URL).origin;
          connectSet.add(rpcOrigin);
        } catch (e) {
        }
      }
      const connect = Array.from(connectSet);
      const images = Array.from(imagesSet);
      const frames = Array.from(framesSet);
      if (isProxyOn) {
        const externalWC = [
          "wss://relay.walletconnect.com",
          "wss://relay.walletconnect.org",
          "https://rpc.walletconnect.com",
          "https://verify.walletconnect.com",
          "https://verify.walletconnect.org",
          "https://explorer-api.walletconnect.com"
        ];
        return {
          defaultSrc: ["'self'"],
          scriptSrc: CSP_POLICY.SCRIPTS,
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: images.filter((d) => !externalWC.includes(d)),
          connectSrc: connect.filter((d) => !externalWC.includes(d)),
          fontSrc: ["'self'", "data:"],
          frameSrc: frames.filter((d) => !externalWC.includes(d)),
          workerSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"]
        };
      }
      return {
        defaultSrc: ["'self'"],
        scriptSrc: CSP_POLICY.SCRIPTS,
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: images,
        connectSrc: connect,
        fontSrc: ["'self'", "data:"],
        frameSrc: frames,
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"]
      };
    };
    AppError = class extends Error {
      statusCode;
      constructor(message, statusCode = 500) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
      }
    };
  }
});

// ../src/shared/utils/crypto.ts
var crypto_exports = {};
__export(crypto_exports, {
  CRYPTO_CONFIG: () => CRYPTO_CONFIG,
  base64UrlEncode: () => base64UrlEncode,
  decryptData: () => decryptData,
  encryptBackupFile: () => encryptBackupFile,
  encryptData: () => encryptData,
  encryptWithRSAPublicKey: () => encryptWithRSAPublicKey,
  generateDeviceKey: () => generateDeviceKey,
  generatePKCE: () => generatePKCE,
  generateSecureJWT: () => generateSecureJWT,
  getDerivedEncryptionKey: () => getDerivedEncryptionKey,
  getDerivedLicenseKey: () => getDerivedLicenseKey,
  initializeEnv: () => initializeEnv,
  normalizeSecret: () => normalizeSecret,
  verifySecureJWT: () => verifySecureJWT
});
async function normalizeSecret(secret, contextKey) {
  if (!secret || typeof secret !== "string") return secret;
  if (secret.startsWith("base64:")) {
    try {
      return atob(secret.slice(7));
    } catch (e) {
      logger.warn("[Crypto] Failed to decode base64 secret, using raw string");
      return secret;
    }
  }
  if (secret.startsWith("hex:")) {
    try {
      const hex = secret.slice(4).replace(/[^0-9a-fA-F]/g, "");
      const bytesMatch = hex.match(/.{1,2}/g);
      if (!bytesMatch) return secret;
      return String.fromCharCode(...bytesMatch.map((byte) => parseInt(byte, 16)));
    } catch (e) {
      logger.warn("[Crypto] Failed to decode hex secret, using raw string");
      return secret;
    }
  }
  if (secret.startsWith("aes:")) {
    if (!contextKey) {
      throw new Error("[Crypto] Missing root key (JWT_SECRET) to decrypt aes: secret");
    }
    try {
      const parts = secret.slice(4).split(":");
      if (parts.length !== 3) throw new Error("Invalid AES format");
      const [ivB64, tagB64, cipherB64] = parts;
      if (!ivB64 || !tagB64 || !cipherB64) throw new Error("Invalid segments");
      const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0));
      const tag = Uint8Array.from(atob(tagB64), (c) => c.charCodeAt(0));
      const ciphertextData = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0));
      const combined = new Uint8Array(ciphertextData.length + tag.length);
      combined.set(ciphertextData);
      combined.set(tag, ciphertextData.length);
      const key = await getDerivedEncryptionKey(contextKey);
      const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        key,
        combined
      );
      return new TextDecoder().decode(decrypted);
    } catch (e) {
      throw new Error(`[Crypto] Failed to decrypt aes: secret: ${e.message}`);
    }
  }
  return secret;
}
async function getDerivedEncryptionKey(password) {
  if (derivedKeyCache.has(password)) {
    return derivedKeyCache.get(password);
  }
  const encoder = new TextEncoder();
  const license = (typeof process !== "undefined" ? process.env.NODEAUTH_LICENSE : "") || "";
  const licenseFeature = await getDerivedLicenseKey(password, license);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      // 核心锁死：不再使用硬编码盐，而是使用基于授权派生的特征盐
      salt: licenseFeature,
      iterations: 1e5,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  derivedKeyCache.set(password, key);
  return key;
}
async function initializeEnv(env) {
  if (!env) return;
  const rawJwt = env.JWT_SECRET || (typeof process !== "undefined" ? process.env.JWT_SECRET : "");
  let rootKey = "";
  if (rawJwt && typeof rawJwt === "string") {
    rootKey = await normalizeSecret(rawJwt);
    env.JWT_SECRET = rootKey;
    if (typeof process !== "undefined") process.env.JWT_SECRET = rootKey;
  }
  for (const key in env) {
    if (key === "JWT_SECRET" || key === "ASSETS") continue;
    if (typeof env[key] === "string") {
      try {
        const rawValue = env[key].trim();
        const normalized = await normalizeSecret(rawValue, rootKey);
        if (rawValue.startsWith("aes:")) {
          logger.info(`[Init] Decrypted key "${key}" (Encrypted: ${rawValue.slice(0, 10)}...)`);
        }
        env[key] = normalized;
        if (typeof process !== "undefined") process.env[key] = normalized;
      } catch (e) {
        logger.error(`[Init] Failed to normalize env key "${key}":`, e);
      }
    }
  }
}
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(await normalizeSecret(password)),
    { name: CRYPTO_CONFIG.KDF_NAME },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: CRYPTO_CONFIG.KDF_NAME,
      salt,
      iterations: CRYPTO_CONFIG.ITERATIONS,
      hash: CRYPTO_CONFIG.HASH
    },
    keyMaterial,
    { name: CRYPTO_CONFIG.ALGO_NAME, length: CRYPTO_CONFIG.KEY_LEN },
    false,
    ["encrypt", "decrypt"]
  );
}
async function generateSecureJWT(payload, secret, expiry = 86400 * 7) {
  const header = { alg: "HS256", typ: "JWT", iat: Math.floor(Date.now() / 1e3) };
  const enhancedPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1e3),
    exp: Math.floor(Date.now() / 1e3) + expiry,
    jti: crypto.randomUUID()
  };
  const headerB64 = btoa(JSON.stringify(header)).replace(/[+/=]/g, (m) => ({ "+": "-", "/": "_", "=": "" })[m] || m);
  const payloadB64 = btoa(JSON.stringify(enhancedPayload)).replace(/[+/=]/g, (m) => ({ "+": "-", "/": "_", "=": "" })[m] || m);
  const data = `${headerB64}.${payloadB64}`;
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(await normalizeSecret(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/[+/=]/g, (m) => ({ "+": "-", "/": "_", "=": "" })[m] || m);
  return `${data}.${signatureB64}`;
}
async function verifySecureJWT(token, secret) {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) return null;
    const data = `${headerB64}.${payloadB64}`;
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(await normalizeSecret(secret)), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const signatureBytes = Uint8Array.from(atob(signatureB64.replace(/[-_]/g, (m) => ({ "-": "+", "_": "/" })[m] || m)), (c) => c.charCodeAt(0));
    const isValid = await crypto.subtle.verify("HMAC", cryptoKey, signatureBytes, encoder.encode(data));
    if (isValid) {
      const payload = JSON.parse(atob(payloadB64.replace(/[-_]/g, (m) => ({ "-": "+", "_": "/" })[m] || m)));
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1e3)) return null;
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}
function base64UrlEncode(str) {
  let binary = "";
  const len = str.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(str[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function generatePKCE() {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode(verifierBytes);
  const challenge = base64UrlEncode(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}
async function getFastKey(secret) {
  const encoder = new TextEncoder();
  const keyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(await normalizeSecret(secret)));
  return crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptBackupFile(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.IV_LEN));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const encodedData = enc.encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encodedData);
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  let binary = "";
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}
async function encryptData(data, masterKey) {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getFastKey(masterKey);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(data)));
  return {
    encrypted: Array.from(new Uint8Array(encrypted)),
    iv: Array.from(iv)
  };
}
async function decryptData(encryptedData, masterKey) {
  const decoder = new TextDecoder();
  const iv = new Uint8Array(encryptedData.iv);
  const encrypted = new Uint8Array(encryptedData.encrypted);
  let key;
  if (encryptedData.salt && encryptedData.salt.length > 0) {
    const salt = new Uint8Array(encryptedData.salt);
    key = await deriveKey(masterKey, salt);
  } else {
    key = await getFastKey(masterKey);
  }
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return JSON.parse(decoder.decode(decrypted));
}
async function getDerivedLicenseKey(masterKey, license) {
  const encoder = new TextEncoder();
  let licenseFeature = "no_license_feature";
  try {
    if (license) {
      const decoded = atob(license);
      const licenseParts = decoded.split("|");
      if (licenseParts.length === 3) {
        licenseFeature = licenseParts[2];
      }
    }
  } catch (e) {
  }
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const derivedSignature = await crypto.subtle.sign(
    "HMAC",
    baseKey,
    encoder.encode(`logic_lock_v1_${licenseFeature}`)
  );
  return new Uint8Array(derivedSignature);
}
async function generateDeviceKey(userId, secret) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(await normalizeSecret(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(userId + "device_salt_offline_key"));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function encryptWithRSAPublicKey(data, publicKeyBase64) {
  try {
    const binary_string = atob(publicKeyBase64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
    const spkiBuffer = bytes.buffer;
    const publicKey = await crypto.subtle.importKey(
      "spki",
      spkiBuffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      publicKey,
      dataBuffer
    );
    return btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer)));
  } catch (e) {
    console.warn("[Crypto] RSA encryption failed, falling back to raw data:", e);
    return data;
  }
}
var CRYPTO_CONFIG, derivedKeyCache;
var init_crypto = __esm({
  "../src/shared/utils/crypto.ts"() {
    "use strict";
    init_logger();
    CRYPTO_CONFIG = {
      ALGO_NAME: "AES-GCM",
      KDF_NAME: "PBKDF2",
      HASH: "SHA-256",
      ITERATIONS: 1e5,
      // 平衡安全性与性能
      KEY_LEN: 256,
      SALT_LEN: 16,
      IV_LEN: 12
    };
    derivedKeyCache = /* @__PURE__ */ new Map();
  }
});

// ../src/shared/utils/common.ts
function sanitizeInput(input, maxLength = SECURITY_CONFIG.MAX_INPUT_LENGTH) {
  if (typeof input !== "string") return "";
  return input.replace(/[<>"'&\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, "").trim().substring(0, maxLength);
}
var init_common = __esm({
  "../src/shared/utils/common.ts"() {
    "use strict";
    init_config();
  }
});

// ../src/shared/utils/otp/base.ts
function validateBase32Secret(secret) {
  if (!secret || typeof secret !== "string") return false;
  const cleaned = secret.replace(/\s/g, "").toUpperCase();
  return /^[A-Z2-7]+=*$/.test(cleaned) && cleaned.length >= 8;
}
function base32Decode(encoded) {
  const cleanInput = encoded.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const buffer = new Uint8Array(Math.floor(cleanInput.length * 5 / 8));
  let bits = 0, value = 0, index = 0;
  for (let i = 0; i < cleanInput.length; i++) {
    const charValue = BASE32_CHARS.indexOf(cleanInput[i]);
    if (charValue === -1) continue;
    value = value << 5 | charValue;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = value >>> bits - 8 & 255;
      bits -= 8;
    }
  }
  return buffer;
}
function bytesToBase32(bytes) {
  let bits = 0, value = 0, output = "";
  for (let i = 0; i < bytes.length; i++) {
    value = value << 8 | bytes[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[value >>> bits - 5 & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[value << 5 - bits & 31];
  }
  return output;
}
async function hmac(key, data, algorithm = "SHA-1") {
  const keyBuffer = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const dataBuffer = new ArrayBuffer(8);
  new DataView(dataBuffer).setBigUint64(0, BigInt(data), false);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "HMAC", hash: algorithm.includes("-") ? algorithm : algorithm.replace("SHA", "SHA-") },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);
  return new Uint8Array(signature);
}
async function hmacSHA1(key, data) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(signature);
}
var BASE32_CHARS;
var init_base = __esm({
  "../src/shared/utils/otp/base.ts"() {
    "use strict";
    BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  }
});

// ../src/shared/utils/otp/protocols/totp.ts
async function generateTOTP(secret, timeStep = 30, digits = 6, algorithm = "SHA-1", timestamp = Date.now()) {
  const time = Math.floor(timestamp / 1e3 / timeStep);
  const secretBytes = typeof secret === "string" ? base32Decode(secret) : secret;
  const hmacResult = await hmac(secretBytes, time, algorithm);
  const offset = hmacResult[hmacResult.length - 1] & 15;
  const binary = (hmacResult[offset] & 127) << 24 | (hmacResult[offset + 1] & 255) << 16 | (hmacResult[offset + 2] & 255) << 8 | hmacResult[offset + 3] & 255;
  const code = binary % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}
var init_totp = __esm({
  "../src/shared/utils/otp/protocols/totp.ts"() {
    "use strict";
    init_base();
  }
});

// ../src/shared/utils/otp/protocols/steam.ts
async function generateSteamTOTP(secret, timeStep = 30) {
  const time = Math.floor(Date.now() / 1e3 / timeStep);
  const secretBytes = typeof secret === "string" ? base32Decode(secret) : secret;
  const hmacResult = await hmac(secretBytes, time, "SHA-1");
  const offset = hmacResult[hmacResult.length - 1] & 15;
  let binary = (hmacResult[offset] & 127) << 24 | (hmacResult[offset + 1] & 255) << 16 | (hmacResult[offset + 2] & 255) << 8 | hmacResult[offset + 3] & 255;
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += STEAM_CHARS.charAt(binary % STEAM_CHARS.length);
    binary = Math.floor(binary / STEAM_CHARS.length);
  }
  return code;
}
var STEAM_CHARS;
var init_steam = __esm({
  "../src/shared/utils/otp/protocols/steam.ts"() {
    "use strict";
    init_base();
    STEAM_CHARS = "23456789BCDFGHJKMNPQRTVWXY";
  }
});

// ../src/shared/utils/otp/protocols/hotp.ts
async function generateHOTP(secret, counter, digits = 6, algorithm = "SHA-1") {
  const secretBytes = typeof secret === "string" ? base32Decode(secret) : secret;
  const hmacResult = await hmac(secretBytes, counter, algorithm);
  const offset = hmacResult[hmacResult.length - 1] & 15;
  const binary = (hmacResult[offset] & 127) << 24 | (hmacResult[offset + 1] & 255) << 16 | (hmacResult[offset + 2] & 255) << 8 | hmacResult[offset + 3] & 255;
  const code = binary % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}
var init_hotp = __esm({
  "../src/shared/utils/otp/protocols/hotp.ts"() {
    "use strict";
    init_base();
  }
});

// ../src/shared/utils/otp/protocols/blizzard.ts
async function generateBlizzardOTP(secret, timeStep = 30, timestamp = Date.now()) {
  return generateTOTP(secret, timeStep, 8, "SHA-1", timestamp);
}
var init_blizzard = __esm({
  "../src/shared/utils/otp/protocols/blizzard.ts"() {
    "use strict";
    init_totp();
  }
});

// ../src/shared/utils/otp/index.ts
var otp_exports = {};
__export(otp_exports, {
  base32Decode: () => base32Decode,
  buildOTPAuthURI: () => buildOTPAuthURI,
  bytesToBase32: () => bytesToBase32,
  generate: () => generate,
  generateBlizzardOTP: () => generateBlizzardOTP,
  generateHOTP: () => generateHOTP,
  generateSteamTOTP: () => generateSteamTOTP,
  generateTOTP: () => generateTOTP,
  hmac: () => hmac,
  hmacSHA1: () => hmacSHA1,
  normalizeOtpAccount: () => normalizeOtpAccount,
  parseOTPAuthURI: () => parseOTPAuthURI,
  resolveOtpType: () => resolveOtpType,
  validateBase32Secret: () => validateBase32Secret
});
async function generate(secret, timeOrCounter = 30, digits = 6, algorithm = "SHA1", type = "totp", timestamp = Date.now()) {
  if (type === "steam") {
    return generateSteamTOTP(secret, timeOrCounter);
  }
  if (type === "blizzard") {
    return generateBlizzardOTP(secret, timeOrCounter, timestamp);
  }
  if (type === "hotp") {
    return generateHOTP(secret, timeOrCounter, digits, algorithm);
  }
  return generateTOTP(secret, timeOrCounter, digits, algorithm, timestamp);
}
function normalizeOtpAccount(item = {}) {
  const type = resolveOtpType(item.type, item);
  const normalized = { ...item, type };
  if (type === "steam") {
    normalized.digits = 5;
    normalized.period = 30;
    normalized.algorithm = "SHA1";
  } else if (type === "blizzard") {
    normalized.digits = 8;
    normalized.period = 30;
    normalized.algorithm = "SHA1";
  } else {
    let algo = (item.algorithm || "SHA1").toUpperCase().replace(/-/g, "");
    if (!["SHA1", "SHA256", "SHA512"].includes(algo)) algo = "SHA1";
    normalized.algorithm = algo;
    let digits = parseInt(item.digits || "6");
    if (isNaN(digits) || digits <= 0) digits = 6;
    normalized.digits = digits;
    let period = parseInt(item.period || "30");
    if (isNaN(period) || period <= 0) period = 30;
    normalized.period = period;
  }
  normalized.service = sanitizeInput(normalized.service || normalized.issuer || "Unknown", 50);
  normalized.issuer = normalized.service;
  let account = normalized.account || normalized.label || "Unknown";
  if (typeof account === "string" && account.includes(":")) {
    account = account.split(":").pop()?.trim() || account;
  }
  normalized.account = sanitizeInput(account, 100);
  const rawSecret = normalized.secret || "";
  normalized.secret = rawSecret.startsWith("nodeauth:") ? rawSecret : rawSecret.replace(/[\s=]/g, "").toUpperCase();
  normalized.counter = parseInt(normalized.counter || "0");
  if (isNaN(normalized.counter) || normalized.counter < 0) normalized.counter = 0;
  return normalized;
}
function resolveOtpType(typeRaw, context = {}) {
  const type = (typeRaw || context.type || "").toLowerCase().trim();
  const algo = (context.algorithm || "").toUpperCase();
  const service = (context.service || "").toUpperCase();
  const digits = context.digits || 0;
  if (type === "steam" || type === "steam guard" || algo === "STEAM" || digits === 5 && service.includes("STEAM")) {
    return "steam";
  }
  if (["blizzard", "battle.net"].some((k) => type.includes(k) || service.includes(k.toUpperCase()))) {
    return "blizzard";
  }
  if (type === "totp") {
    return "totp";
  }
  if (type === "hotp" || context.hasOwnProperty("counter") && context.counter !== null && context.counter !== void 0) {
    return "hotp";
  }
  return "totp";
}
function parseOTPAuthURI(uri) {
  try {
    if (!uri || typeof uri !== "string" || uri.length > 2e3) return null;
    if (uri.startsWith("steam://")) {
      const secret2 = uri.replace("steam://", "").replace(/[\s=]/g, "").toUpperCase();
      if (!validateBase32Secret(secret2)) return null;
      return {
        type: "steam",
        label: "Steam",
        issuer: "Steam",
        account: "Steam",
        secret: secret2,
        digits: 5,
        period: 30,
        algorithm: "SHA1",
        counter: 0
      };
    }
    const url = new URL(uri);
    if (url.protocol !== "otpauth:") return null;
    let typeHeader = url.host || url.hostname;
    if (!typeHeader && url.pathname.startsWith("//")) {
      typeHeader = url.pathname.substring(2).split("/")[0];
    }
    typeHeader = (typeHeader || "").toLowerCase();
    const params = new URLSearchParams(url.search);
    const secret = params.get("secret");
    if (!validateBase32Secret(secret)) return null;
    const label = decodeURIComponent(url.pathname.substring(1));
    const [issuer, account] = label.includes(":") ? label.split(":", 2) : ["", label];
    const issuerName = params.get("issuer") || issuer;
    const digitsVal = parseInt(params.get("digits") || "0");
    const periodVal = parseInt(params.get("period") || "30");
    const counterVal = parseInt(params.get("counter") || "0");
    return normalizeOtpAccount({
      service: issuerName,
      account: account || label,
      label,
      secret,
      type: typeHeader,
      digits: digitsVal,
      period: periodVal,
      counter: counterVal,
      algorithm: params.get("algorithm") || "SHA1"
    });
  } catch {
    return null;
  }
}
function buildOTPAuthURI(data) {
  const normalized = normalizeOtpAccount(data);
  const { service, account, secret, type, algorithm, digits, period, counter } = normalized;
  const label = account ? encodeURIComponent(`${service}:${account}`) : encodeURIComponent(service);
  const issuer = encodeURIComponent(service);
  if (type === "hotp") {
    let uri = `otpauth://hotp/${label}?secret=${secret}&counter=${counter}`;
    if (service) uri += `&issuer=${issuer}`;
    if (algorithm !== "SHA1") uri += `&algorithm=${algorithm}`;
    if (digits !== 6) uri += `&digits=${digits}`;
    return uri;
  }
  if (type === "steam") {
    return `otpauth://steam/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=5`;
  }
  if (type === "blizzard") {
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=8&period=30`;
  }
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=${algorithm}&digits=${digits}&period=${period}`;
}
var init_otp = __esm({
  "../src/shared/utils/otp/index.ts"() {
    "use strict";
    init_common();
    init_base();
    init_totp();
    init_steam();
    init_hotp();
    init_blizzard();
  }
});

// ../src/app/worker.ts
import { drizzle } from "drizzle-orm/d1";

// ../src/app/index.ts
init_logger();
init_config();
init_crypto();
import { Hono as Hono10 } from "hono";
import { cors } from "hono/cors";
import { logger as hLogger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";

// ../src/features/auth/authRoutes.ts
init_config();
import { Hono } from "hono";
import { setCookie, getCookie as getCookie2, deleteCookie } from "hono/cookie";

// ../src/shared/middleware/auth.ts
init_config();
init_crypto();
import { getCookie } from "hono/cookie";

// ../src/features/auth/sessionService.ts
init_config();

// ../src/shared/db/repositories/sessionRepository.ts
import { eq, ne, and, lt } from "drizzle-orm";

// ../src/shared/db/schema/sqlite.ts
var sqlite_exports = {};
__export(sqlite_exports, {
  authPasskeys: () => authPasskeys,
  authSessions: () => authSessions,
  backupEmailHistory: () => backupEmailHistory,
  backupProviders: () => backupProviders,
  backupTelegramHistory: () => backupTelegramHistory,
  rateLimits: () => rateLimits,
  schemaMetadata: () => schemaMetadata,
  shareAuditEvents: () => shareAuditEvents,
  shareLinks: () => shareLinks,
  shareRateLimits: () => shareRateLimits,
  vault: () => vault
});
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
var vault = sqliteTable("vault", {
  id: text("id").primaryKey(),
  // UUID
  service: text("service").notNull(),
  account: text("account").notNull(),
  category: text("category"),
  secret: text("secret").notNull(),
  // 加密后的密文
  digits: integer("digits").default(6),
  period: integer("period").default(30),
  type: text("type").default("totp"),
  algorithm: text("algorithm").default("SHA1"),
  counter: integer("counter").default(0),
  createdAt: integer("created_at").notNull(),
  createdBy: text("created_by"),
  // 'username' or 'restore'
  updatedAt: integer("updated_at"),
  updatedBy: text("updated_by"),
  sortOrder: integer("sort_order").default(0),
  deletedAt: integer("deleted_at")
});
var shareLinks = sqliteTable("share_links", {
  id: text("id").primaryKey(),
  vaultItemId: text("vault_item_id").notNull(),
  ownerId: text("owner_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  accessCodeHash: text("access_code_hash").notNull(),
  activeShareKey: text("active_share_key"),
  expiresAt: integer("expires_at").notNull(),
  revokedAt: integer("revoked_at"),
  createdAt: integer("created_at").notNull(),
  lastAccessedAt: integer("last_accessed_at"),
  accessCount: integer("access_count").notNull().default(0)
});
var shareAuditEvents = sqliteTable("share_audit_events", {
  id: text("id").primaryKey(),
  shareId: text("share_id").notNull(),
  eventType: text("event_type").notNull(),
  actorType: text("actor_type").notNull(),
  eventAt: integer("event_at").notNull(),
  ownerId: text("owner_id").notNull(),
  ipHash: text("ip_hash"),
  userAgentHash: text("user_agent_hash"),
  metadata: text("metadata")
});
var shareRateLimits = sqliteTable("share_rate_limits", {
  key: text("key").primaryKey(),
  shareId: text("share_id").notNull(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
  lastAttemptAt: integer("last_attempt_at").notNull(),
  lockedUntil: integer("locked_until")
});
var backupProviders = sqliteTable("backup_providers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type").notNull(),
  // 'webdav' | 's3'
  name: text("name").notNull(),
  isEnabled: integer("is_enabled", { mode: "boolean" }).default(true),
  config: text("config").notNull(),
  // 加密后的 JSON 字符串
  autoBackup: integer("auto_backup", { mode: "boolean" }).default(false),
  autoBackupPassword: text("auto_backup_password"),
  // 加密后的自动备份密码
  autoBackupRetain: integer("auto_backup_retain").default(30),
  // 保留备份数，0代表无限
  lastBackupAt: integer("last_backup_at"),
  lastBackupStatus: text("last_backup_status"),
  // 'success' | 'failed'
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull()
});
var backupTelegramHistory = sqliteTable("backup_telegram_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("provider_id").notNull(),
  filename: text("filename").notNull(),
  fileId: text("file_id").notNull(),
  messageId: integer("message_id").notNull(),
  size: integer("size").notNull(),
  createdAt: integer("created_at").notNull()
});
var backupEmailHistory = sqliteTable("backup_email_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  providerId: integer("provider_id").notNull(),
  filename: text("filename").notNull(),
  recipient: text("recipient").notNull(),
  // 收件人邮箱地址
  size: integer("size").notNull(),
  createdAt: integer("created_at").notNull()
});
var authPasskeys = sqliteTable("auth_passkeys", {
  credentialId: text("credential_id").primaryKey(),
  // 唯一凭据 ID
  userId: text("user_id").notNull(),
  // 在本应用中绑定的是邮箱
  name: text("name"),
  // 别名
  publicKey: text("public_key").notNull(),
  // Uint8Array 序列化后的数组
  counter: integer("counter").default(0),
  // 认证流计算器
  lastUsedAt: integer("last_used_at"),
  // 最后一次使用的时间戳
  transports: text("transports"),
  // 传输方式 (JSON 字符串)
  createdAt: integer("created_at").notNull()
});
var authSessions = sqliteTable("auth_sessions", {
  id: text("id").primaryKey(),
  // Session UUID
  userId: text("user_id").notNull(),
  deviceId: text("device_id"),
  // 物理设备指纹 (Hardware Fingerprint)
  provider: text("provider"),
  // 登录方式 (github, passkey, web3 etc.)
  deviceType: text("device_type").notNull(),
  // User-Agent 解析简述或 'Unknown Device'
  ipAddress: text("ip_address").notNull(),
  lastActiveAt: integer("last_active_at").notNull(),
  createdAt: integer("created_at").notNull()
});
var rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").default(0),
  lastAttempt: integer("last_attempt"),
  expiresAt: integer("expires_at")
});
var schemaMetadata = sqliteTable("_schema_metadata", {
  key: text("key").primaryKey(),
  value: text("value")
});

// ../src/shared/db/schema/mysql.ts
import { mysqlTable, varchar, int, boolean, longtext, bigint } from "drizzle-orm/mysql-core";
var vault2 = mysqlTable("vault", {
  id: varchar("id", { length: 36 }).primaryKey(),
  service: varchar("service", { length: 255 }).notNull(),
  account: varchar("account", { length: 255 }).notNull(),
  category: varchar("category", { length: 100 }),
  secret: longtext("secret").notNull(),
  digits: int("digits").default(6),
  period: int("period").default(30),
  type: varchar("type", { length: 20 }).default("totp"),
  algorithm: varchar("algorithm", { length: 20 }).default("SHA1"),
  counter: bigint("counter", { mode: "number" }).default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  createdBy: varchar("created_by", { length: 255 }),
  updatedAt: bigint("updated_at", { mode: "number" }),
  updatedBy: varchar("updated_by", { length: 255 }),
  sortOrder: bigint("sort_order", { mode: "number" }).default(0),
  deletedAt: bigint("deleted_at", { mode: "number" })
});
var shareLinks2 = mysqlTable("share_links", {
  id: varchar("id", { length: 64 }).primaryKey(),
  vaultItemId: varchar("vault_item_id", { length: 64 }).notNull(),
  ownerId: varchar("owner_id", { length: 255 }).notNull(),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  accessCodeHash: varchar("access_code_hash", { length: 255 }).notNull(),
  activeShareKey: varchar("active_share_key", { length: 320 }),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  revokedAt: bigint("revoked_at", { mode: "number" }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  lastAccessedAt: bigint("last_accessed_at", { mode: "number" }),
  accessCount: bigint("access_count", { mode: "number" }).notNull().default(0)
});
var shareAuditEvents2 = mysqlTable("share_audit_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  shareId: varchar("share_id", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  actorType: varchar("actor_type", { length: 50 }).notNull(),
  eventAt: bigint("event_at", { mode: "number" }).notNull(),
  ownerId: varchar("owner_id", { length: 255 }).notNull(),
  ipHash: varchar("ip_hash", { length: 255 }),
  userAgentHash: varchar("user_agent_hash", { length: 255 }),
  metadata: longtext("metadata")
});
var shareRateLimits2 = mysqlTable("share_rate_limits", {
  key: varchar("key", { length: 255 }).primaryKey(),
  shareId: varchar("share_id", { length: 255 }).notNull(),
  attempts: bigint("attempts", { mode: "number" }).notNull().default(0),
  windowStartedAt: bigint("window_started_at", { mode: "number" }).notNull(),
  lastAttemptAt: bigint("last_attempt_at", { mode: "number" }).notNull(),
  lockedUntil: bigint("locked_until", { mode: "number" })
});
var backupProviders2 = mysqlTable("backup_providers", {
  id: int("id").primaryKey().autoincrement(),
  type: varchar("type", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  isEnabled: boolean("is_enabled").default(true),
  config: longtext("config").notNull(),
  autoBackup: boolean("auto_backup").default(false),
  autoBackupPassword: longtext("auto_backup_password"),
  autoBackupRetain: int("auto_backup_retain").default(30),
  lastBackupAt: bigint("last_backup_at", { mode: "number" }),
  lastBackupStatus: varchar("last_backup_status", { length: 20 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull()
});
var backupTelegramHistory2 = mysqlTable("backup_telegram_history", {
  id: int("id").primaryKey().autoincrement(),
  providerId: int("provider_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileId: varchar("file_id", { length: 255 }).notNull(),
  messageId: int("message_id").notNull(),
  size: int("size").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull()
});
var backupEmailHistory2 = mysqlTable("backup_email_history", {
  id: int("id").primaryKey().autoincrement(),
  providerId: int("provider_id").notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  size: int("size").notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull()
});
var authPasskeys2 = mysqlTable("auth_passkeys", {
  credentialId: varchar("credential_id", { length: 255 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  publicKey: longtext("public_key").notNull(),
  counter: bigint("counter", { mode: "number" }).default(0),
  lastUsedAt: bigint("last_used_at", { mode: "number" }),
  transports: varchar("transports", { length: 255 }),
  createdAt: bigint("created_at", { mode: "number" }).notNull()
});
var authSessions2 = mysqlTable("auth_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  deviceId: varchar("device_id", { length: 255 }),
  provider: varchar("provider", { length: 50 }),
  deviceType: varchar("device_type", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  lastActiveAt: bigint("last_active_at", { mode: "number" }).notNull(),
  createdAt: bigint("created_at", { mode: "number" }).notNull()
});
var rateLimits2 = mysqlTable("rate_limits", {
  key: varchar("key", { length: 255 }).primaryKey(),
  attempts: bigint("attempts", { mode: "number" }).default(0),
  lastAttempt: bigint("last_attempt", { mode: "number" }),
  expiresAt: bigint("expires_at", { mode: "number" })
});
var schemaMetadata2 = mysqlTable("_schema_metadata", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: varchar("value", { length: 255 })
});

// ../src/shared/db/schema/pg.ts
import { pgTable, varchar as varchar2, integer as integer2, boolean as boolean2, text as text2, serial, bigint as bigint2 } from "drizzle-orm/pg-core";
var vault3 = pgTable("vault", {
  id: varchar2("id").primaryKey(),
  service: varchar2("service").notNull(),
  account: varchar2("account").notNull(),
  category: varchar2("category"),
  secret: text2("secret").notNull(),
  digits: integer2("digits").default(6),
  period: integer2("period").default(30),
  type: varchar2("type").default("totp"),
  algorithm: varchar2("algorithm").default("SHA1"),
  counter: bigint2("counter", { mode: "number" }).default(0),
  createdAt: bigint2("created_at", { mode: "number" }).notNull(),
  createdBy: varchar2("created_by"),
  updatedAt: bigint2("updated_at", { mode: "number" }),
  updatedBy: varchar2("updated_by"),
  sortOrder: bigint2("sort_order", { mode: "number" }).default(0),
  deletedAt: bigint2("deleted_at", { mode: "number" })
});
var shareLinks3 = pgTable("share_links", {
  id: varchar2("id").primaryKey(),
  vaultItemId: varchar2("vault_item_id").notNull(),
  ownerId: varchar2("owner_id").notNull(),
  tokenHash: varchar2("token_hash").notNull(),
  accessCodeHash: varchar2("access_code_hash").notNull(),
  activeShareKey: varchar2("active_share_key"),
  expiresAt: bigint2("expires_at", { mode: "number" }).notNull(),
  revokedAt: bigint2("revoked_at", { mode: "number" }),
  createdAt: bigint2("created_at", { mode: "number" }).notNull(),
  lastAccessedAt: bigint2("last_accessed_at", { mode: "number" }),
  accessCount: bigint2("access_count", { mode: "number" }).notNull().default(0)
});
var shareAuditEvents3 = pgTable("share_audit_events", {
  id: varchar2("id").primaryKey(),
  shareId: varchar2("share_id").notNull(),
  eventType: varchar2("event_type").notNull(),
  actorType: varchar2("actor_type").notNull(),
  eventAt: bigint2("event_at", { mode: "number" }).notNull(),
  ownerId: varchar2("owner_id").notNull(),
  ipHash: varchar2("ip_hash"),
  userAgentHash: varchar2("user_agent_hash"),
  metadata: text2("metadata")
});
var shareRateLimits3 = pgTable("share_rate_limits", {
  key: varchar2("key").primaryKey(),
  shareId: varchar2("share_id").notNull(),
  attempts: bigint2("attempts", { mode: "number" }).notNull().default(0),
  windowStartedAt: bigint2("window_started_at", { mode: "number" }).notNull(),
  lastAttemptAt: bigint2("last_attempt_at", { mode: "number" }).notNull(),
  lockedUntil: bigint2("locked_until", { mode: "number" })
});
var backupProviders3 = pgTable("backup_providers", {
  id: serial("id").primaryKey(),
  type: varchar2("type").notNull(),
  name: varchar2("name").notNull(),
  isEnabled: boolean2("is_enabled").default(true),
  config: text2("config").notNull(),
  autoBackup: boolean2("auto_backup").default(false),
  autoBackupPassword: text2("auto_backup_password"),
  autoBackupRetain: integer2("auto_backup_retain").default(30),
  lastBackupAt: bigint2("last_backup_at", { mode: "number" }),
  lastBackupStatus: varchar2("last_backup_status"),
  createdAt: bigint2("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint2("updated_at", { mode: "number" }).notNull()
});
var backupTelegramHistory3 = pgTable("backup_telegram_history", {
  id: serial("id").primaryKey(),
  providerId: integer2("provider_id").notNull(),
  filename: varchar2("filename").notNull(),
  fileId: varchar2("file_id").notNull(),
  messageId: integer2("message_id").notNull(),
  size: integer2("size").notNull(),
  createdAt: bigint2("created_at", { mode: "number" }).notNull()
});
var backupEmailHistory3 = pgTable("backup_email_history", {
  id: serial("id").primaryKey(),
  providerId: integer2("provider_id").notNull(),
  filename: varchar2("filename").notNull(),
  recipient: varchar2("recipient").notNull(),
  size: integer2("size").notNull(),
  createdAt: bigint2("created_at", { mode: "number" }).notNull()
});
var authPasskeys3 = pgTable("auth_passkeys", {
  credentialId: varchar2("credential_id").primaryKey(),
  userId: varchar2("user_id").notNull(),
  name: varchar2("name"),
  publicKey: text2("public_key").notNull(),
  counter: bigint2("counter", { mode: "number" }).default(0),
  lastUsedAt: bigint2("last_used_at", { mode: "number" }),
  transports: text2("transports"),
  createdAt: bigint2("created_at", { mode: "number" }).notNull()
});
var authSessions3 = pgTable("auth_sessions", {
  id: varchar2("id").primaryKey(),
  userId: varchar2("user_id").notNull(),
  deviceId: varchar2("device_id"),
  provider: varchar2("provider"),
  deviceType: varchar2("device_type").notNull(),
  ipAddress: varchar2("ip_address").notNull(),
  lastActiveAt: bigint2("last_active_at", { mode: "number" }).notNull(),
  createdAt: bigint2("created_at", { mode: "number" }).notNull()
});
var rateLimits3 = pgTable("rate_limits", {
  key: varchar2("key").primaryKey(),
  attempts: bigint2("attempts", { mode: "number" }).default(0),
  lastAttempt: bigint2("last_attempt", { mode: "number" }),
  expiresAt: bigint2("expires_at", { mode: "number" })
});
var schemaMetadata3 = pgTable("_schema_metadata", {
  key: varchar2("key").primaryKey(),
  value: text2("value")
});

// ../src/shared/db/schema/index.ts
var engine = typeof process !== "undefined" && process.env.DB_ENGINE ? process.env.DB_ENGINE.toLowerCase() : "sqlite";
var vault4;
var backupProviders4;
var backupTelegramHistory4;
var backupEmailHistory4;
var authPasskeys4;
var authSessions4;
var rateLimits4;
var shareLinks4;
var shareAuditEvents4;
var shareRateLimits4;
var schemaMetadata4;
if (engine === "mysql") {
  vault4 = vault2;
  backupProviders4 = backupProviders2;
  backupTelegramHistory4 = backupTelegramHistory2;
  backupEmailHistory4 = backupEmailHistory2;
  authPasskeys4 = authPasskeys2;
  authSessions4 = authSessions2;
  rateLimits4 = rateLimits2;
  shareLinks4 = shareLinks2;
  shareAuditEvents4 = shareAuditEvents2;
  shareRateLimits4 = shareRateLimits2;
  schemaMetadata4 = schemaMetadata2;
} else if (engine === "postgres" || engine === "postgresql") {
  vault4 = vault3;
  backupProviders4 = backupProviders3;
  backupTelegramHistory4 = backupTelegramHistory3;
  backupEmailHistory4 = backupEmailHistory3;
  authPasskeys4 = authPasskeys3;
  authSessions4 = authSessions3;
  rateLimits4 = rateLimits3;
  shareLinks4 = shareLinks3;
  shareAuditEvents4 = shareAuditEvents3;
  shareRateLimits4 = shareRateLimits3;
  schemaMetadata4 = schemaMetadata3;
} else {
  vault4 = vault;
  backupProviders4 = backupProviders;
  backupTelegramHistory4 = backupTelegramHistory;
  backupEmailHistory4 = backupEmailHistory;
  authPasskeys4 = authPasskeys;
  authSessions4 = authSessions;
  rateLimits4 = rateLimits;
  shareLinks4 = shareLinks;
  shareAuditEvents4 = shareAuditEvents;
  shareRateLimits4 = shareRateLimits;
  schemaMetadata4 = schemaMetadata;
}

// ../src/shared/db/repositories/sessionRepository.ts
var SessionRepository = class {
  db;
  constructor(db) {
    this.db = db;
  }
  async create(session) {
    await this.db.insert(authSessions4).values(session);
  }
  async findByUserId(userId) {
    return await this.db.select().from(authSessions4).where(eq(authSessions4.userId, userId));
  }
  async findAll() {
    return await this.db.select().from(authSessions4);
  }
  async findSessionByDevice(userId, deviceId) {
    const result = await this.db.select().from(authSessions4).where(and(
      eq(authSessions4.userId, userId),
      eq(authSessions4.deviceId, deviceId)
    )).limit(1);
    return result[0] || null;
  }
  async findById(sessionId) {
    const result = await this.db.select().from(authSessions4).where(eq(authSessions4.id, sessionId)).limit(1);
    return result[0] || null;
  }
  async deleteById(sessionId) {
    const result = await this.db.delete(authSessions4).where(eq(authSessions4.id, sessionId));
    return result.success;
  }
  async deleteAllExcept(userId, excludeSessionId) {
    const conditions = userId ? and(eq(authSessions4.userId, userId), ne(authSessions4.id, excludeSessionId)) : ne(authSessions4.id, excludeSessionId);
    const countRes = await this.db.select().from(authSessions4).where(conditions);
    await this.db.delete(authSessions4).where(conditions);
    return countRes.length;
  }
  async updateLastActive(sessionId, ipAddress, timestamp) {
    const result = await this.db.update(authSessions4).set({
      lastActiveAt: timestamp,
      ipAddress
    }).where(eq(authSessions4.id, sessionId)).execute();
    return result.success;
  }
  async cleanupExpired(cutoffTimestamp) {
    const conditions = lt(authSessions4.lastActiveAt, cutoffTimestamp);
    const countRes = await this.db.select().from(authSessions4).where(conditions);
    await this.db.delete(authSessions4).where(conditions);
    return countRes.length;
  }
};

// ../src/shared/utils/ua.ts
function parseUserAgent(ua) {
  if (!ua || ua === "Unknown Device") return "Unknown Device";
  const dt = ua.toLowerCase();
  let os = "Unknown OS";
  let osVersion = "";
  if (dt.includes("iphone")) {
    os = "iPhone";
    const match = ua.match(/OS (\d+[_.\d]+)/i);
    if (match) osVersion = match[1].replace(/_/g, ".");
  } else if (dt.includes("ipad")) {
    os = "iPad";
    const match = ua.match(/OS (\d+[_.\d]+)/i);
    if (match) osVersion = match[1].replace(/_/g, ".");
  } else if (dt.includes("android")) {
    os = "Android";
    const match = ua.match(/Android (\d+)/i);
    if (match) osVersion = match[1];
  } else if (dt.includes("windows nt")) {
    os = "Windows";
    if (dt.includes("nt 10.0")) osVersion = "10/11";
    else if (dt.includes("nt 6.3")) osVersion = "8.1";
    else if (dt.includes("nt 6.2")) osVersion = "8";
    else if (dt.includes("nt 6.1")) osVersion = "7";
  } else if (dt.includes("macintosh")) {
    os = "macOS";
    const match = ua.match(/Mac OS X (\d+[_.\d]+)/i);
    if (match) osVersion = match[1].replace(/_/g, ".");
  } else if (dt.includes("linux")) {
    os = "Linux";
  }
  let browser = "Browser";
  if (dt.includes("micromessenger")) browser = "WeChat";
  else if (dt.includes("edg/") || dt.includes("edgios/")) browser = "Edge";
  else if (dt.includes("chromium/")) browser = "Chromium";
  else if ((dt.includes("chrome/") || dt.includes("crios/")) && !dt.includes("chromium")) browser = "Chrome";
  else if (dt.includes("firefox/") || dt.includes("fxios/")) browser = "Firefox";
  else if (dt.includes("opios/")) browser = "Opera";
  else if (dt.includes("safari/") && !dt.includes("chrome/") && !dt.includes("crios/") && !dt.includes("fxios/") && !dt.includes("edgios/") && !dt.includes("opios/") && !dt.includes("chromium/")) browser = "Safari";
  const osFull = osVersion ? `${os} ${osVersion}` : os;
  return `${browser} on ${osFull}`;
}

// ../src/shared/utils/masking.ts
import { Buffer as Buffer2 } from "buffer";
var maskUserId = (id) => {
  if (!id) return "***";
  if (id.includes("@")) {
    const [username, domain] = id.split("@");
    if (username.length >= 3) {
      return `${username.slice(0, 3)}***@${domain}`;
    }
    return `${username.slice(0, 1) || ""}***@${domain}`;
  }
  if (id.length >= 3) {
    return `${id.slice(0, 3)}***`;
  }
  return `${id.slice(0, 1) || ""}***`;
};
var maskIp = (ip) => {
  if (!ip) return "***";
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length >= 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
  }
  if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 4) {
      return `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:****`;
    }
  }
  return ip;
};
var ALGORITHM = "AES-GCM";
async function deriveMaskingKey(salt) {
  const encoder = new TextEncoder();
  const saltBuffer = typeof salt === "string" ? encoder.encode(salt) : salt;
  const hashBuffer = await crypto.subtle.digest("SHA-256", new Uint8Array(saltBuffer));
  return Buffer2.from(hashBuffer);
}
async function maskSecret(secretText, maskingKey) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyUsage = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(maskingKey),
    ALGORITHM,
    false,
    ["encrypt"]
  );
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(secretText);
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    keyUsage,
    dataBuffer
  );
  const combined = new Uint8Array(iv.length + ciphertextBuffer.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertextBuffer), iv.length);
  return "nodeauth:" + Buffer2.from(combined).toString("base64");
}
async function unmaskSecret(maskedData, maskingKey) {
  if (!maskedData.startsWith("nodeauth:")) {
    throw new Error("invalid_masking_prefix");
  }
  const payload = maskedData.slice("nodeauth:".length);
  const combined = Buffer2.from(payload, "base64");
  if (combined.length < 12) {
    throw new Error("invalid_payload_length");
  }
  const iv = combined.subarray(0, 12);
  const ciphertext = combined.subarray(12);
  const keyUsage = await crypto.subtle.importKey(
    "raw",
    new Uint8Array(maskingKey),
    ALGORITHM,
    false,
    ["decrypt"]
  );
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    keyUsage,
    ciphertext
  );
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// ../src/features/auth/sessionService.ts
var SessionService = class {
  repo;
  env;
  constructor(env, repo) {
    this.env = env;
    this.repo = repo || new SessionRepository(env.DB);
  }
  /**
   * Create or Refresh a session based on DeviceID fingerprinting
   */
  async createSession(userId, deviceType, ipAddress, deviceId, provider) {
    const now = Date.now();
    const typeStr = deviceType?.trim() ? deviceType : "Unknown Device";
    if (deviceId) {
      const existing = await this.repo.findSessionByDevice(userId, deviceId);
      if (existing) {
        await this.repo.updateLastActive(existing.id, ipAddress, now);
        return existing.id;
      }
    }
    const sessionId = crypto.randomUUID();
    await this.repo.create({
      id: sessionId,
      userId,
      deviceId: deviceId || null,
      provider: provider || "unknown",
      deviceType: typeStr,
      ipAddress,
      lastActiveAt: now,
      createdAt: now
    });
    return sessionId;
  }
  /**
   * Get all active sessions in the system (Modified for Private Mode: Global View)
   */
  async getUserSessions(_userId, currentSessionId) {
    const sessions = await this.repo.findAll();
    return sessions.map((s) => ({
      id: s.id,
      userId: maskUserId(s.userId),
      // 🛡️ 架构师修复：脱敏处理
      deviceType: s.deviceType,
      friendlyName: parseUserAgent(s.deviceType),
      ipAddress: maskIp(s.ipAddress),
      // 🛡️ 架构师修复：脱敏处理
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
      isCurrent: s.id === currentSessionId,
      provider: s.provider
    })).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  }
  /**
   * Kick out a single target device session
   */
  async deleteSession(_userId, targetSessionId, currentSessionId) {
    if (targetSessionId === currentSessionId) {
      throw new AppError("Cannot kick current device", 400);
    }
    const session = await this.repo.findById(targetSessionId);
    if (!session) {
      return;
    }
    await this.repo.deleteById(targetSessionId);
  }
  /**
   * Kick out all other devices across the entire system (Global Purge)
   */
  async deleteAllOtherSessions(_userId, currentSessionId) {
    return await this.repo.deleteAllExcept(null, currentSessionId);
  }
  /**
   * Middleware/Background heartbeat check to update active timestamp
   */
  async heartbeat(sessionId, ipAddress) {
    await this.repo.updateLastActive(sessionId, ipAddress, Date.now());
  }
  /**
   * Periodic cleanup for zombie sessions
   */
  async cleanupZombieSessions() {
    const ttlDays = this.env.SESSION_TTL_DAYS || 30;
    const cutoffTime = Date.now() - ttlDays * 24 * 60 * 60 * 1e3;
    return await this.repo.cleanupExpired(cutoffTime);
  }
  /**
   * Quick boolean valid check for incoming requests
   */
  async validateSession(sessionId) {
    if (!sessionId) return false;
    const session = await this.repo.findById(sessionId);
    if (!session) return false;
    const ttlDays = this.env.SESSION_TTL_DAYS || 30;
    const cutoffTime = Date.now() - ttlDays * 24 * 60 * 60 * 1e3;
    if (session.lastActiveAt < cutoffTime) {
      return false;
    }
    return true;
  }
};

// ../src/shared/middleware/auth.ts
async function authMiddleware(c, next) {
  const token = getCookie(c, "auth_token");
  if (!token) {
    throw new AppError("no_session", 401);
  }
  const csrfCookie = getCookie(c, "csrf_token");
  const csrfHeader = c.req.header("X-CSRF-Token");
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    throw new AppError("csrf_mismatch", 403);
  }
  const payload = await verifySecureJWT(token, c.env.JWT_SECRET);
  if (!payload || !payload.userInfo) {
    throw new AppError("token_expired", 401);
  }
  const sessionId = payload.sessionId;
  if (!sessionId) {
    throw new AppError("session_invalid_schema", 401);
  }
  const sessionService = new SessionService(c.env);
  const isValid = await sessionService.validateSession(sessionId);
  if (!isValid) {
    throw new AppError("session_kicked_out", 401);
  }
  c.set("user", payload.userInfo);
  c.set("sessionId", sessionId);
  await next();
}

// ../src/shared/middleware/rateLimitMiddleware.ts
init_config();
import { eq as eq2 } from "drizzle-orm";
init_logger();
var rateLimit = (options) => {
  return async (c, next) => {
    const db = c.env.DB;
    if (!db) {
      await next();
      return;
    }
    const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
    const path = c.req.path;
    const key = options.keyBuilder ? options.keyBuilder(c) : `rl:${clientIp}:${path}`;
    const now = Date.now();
    try {
      if (typeof db.prepare === "function") {
        const record = await db.prepare(
          "SELECT attempts, last_attempt, expires_at FROM rate_limits WHERE key = ?"
        ).bind(key).first();
        if (record) {
          if (record.expires_at && record.expires_at > now) {
            throw new AppError("too_many_requests", 429);
          }
          if (now - record.last_attempt > options.windowMs) {
            await db.prepare(
              "UPDATE rate_limits SET attempts = 1, last_attempt = ?, expires_at = NULL WHERE key = ?"
            ).bind(now, key).run();
          } else {
            const newAttempts = record.attempts + 1;
            if (newAttempts > options.max) {
              const expiresAt = now + options.windowMs;
              await db.prepare(
                "UPDATE rate_limits SET attempts = ?, last_attempt = ?, expires_at = ? WHERE key = ?"
              ).bind(newAttempts, now, expiresAt, key).run();
              throw new AppError("too_many_requests", 429);
            } else {
              await db.prepare(
                "UPDATE rate_limits SET attempts = ?, last_attempt = ? WHERE key = ?"
              ).bind(newAttempts, now, key).run();
            }
          }
        } else {
          await db.prepare(
            "INSERT INTO rate_limits (key, attempts, last_attempt) VALUES (?, 1, ?)"
          ).bind(key, now).run();
        }
      } else {
        const result = await db.select().from(rateLimits4).where(eq2(rateLimits4.key, key)).limit(1);
        const record = result[0];
        if (record) {
          if (record.expiresAt && record.expiresAt > now) {
            throw new AppError("too_many_requests", 429);
          }
          if (now - (record.lastAttempt || 0) > options.windowMs) {
            await db.update(rateLimits4).set({ attempts: 1, lastAttempt: now, expiresAt: null }).where(eq2(rateLimits4.key, key));
          } else {
            const newAttempts = (record.attempts || 0) + 1;
            if (newAttempts > options.max) {
              const expiresAt = now + options.windowMs;
              await db.update(rateLimits4).set({ attempts: newAttempts, lastAttempt: now, expiresAt }).where(eq2(rateLimits4.key, key));
              throw new AppError("too_many_requests", 429);
            } else {
              await db.update(rateLimits4).set({ attempts: newAttempts, lastAttempt: now }).where(eq2(rateLimits4.key, key));
            }
          }
        } else {
          await db.insert(rateLimits4).values({ key, attempts: 1, lastAttempt: now });
        }
      }
    } catch (e) {
      if (e instanceof AppError && e.statusCode === 429) throw e;
      logger.error("[RateLimit] Database error:", e.message);
    }
    await next();
  };
};
var resetRateLimit = async (c, key) => {
  const db = c.env.DB;
  if (!db) return;
  try {
    if (typeof db.prepare === "function") {
      await db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
    } else {
      await db.delete(rateLimits4).where(eq2(rateLimits4.key, key));
    }
  } catch (e) {
    logger.error("[RateLimit] Reset failed:", e);
  }
};

// ../src/features/auth/authRoutes.ts
init_config();

// ../src/features/auth/providers/index.ts
init_config();

// ../src/features/auth/providers/baseOAuthProvider.ts
var BaseOAuthProvider = class {
  env;
  constructor(env) {
    this.env = env;
  }
};

// ../src/features/auth/providers/githubProvider.ts
init_config();
var GitHubProvider = class extends BaseOAuthProvider {
  id = "github";
  name = "GitHub";
  color = "#24292e";
  icon = "iconGithub";
  whitelistFields = ["email"];
  constructor(env) {
    super(env);
  }
  getAuthorizeUrl(state) {
    const clientId = this.env.OAUTH_GITHUB_CLIENT_ID;
    const redirectUri = this.env.OAUTH_GITHUB_REDIRECT_URI;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      scope: "read:user user:email"
      // 显式请求 Email 权限
    });
    return { url: `https://github.com/login/oauth/authorize?${params.toString()}` };
  }
  async handleCallback(params, _codeVerifier) {
    const code = typeof params === "string" ? params : params.get("code");
    if (!code) {
      throw new AppError("oauth_code_missing", 400);
    }
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        "User-Agent": "NodeAuth-Backend/1.0"
      },
      body: new URLSearchParams({
        client_id: this.env.OAUTH_GITHUB_CLIENT_ID,
        client_secret: this.env.OAUTH_GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: this.env.OAUTH_GITHUB_REDIRECT_URI
      })
    });
    if (!tokenResponse.ok) {
      throw new AppError(`oauth_token_exchange_failed: GitHub  | ${tokenResponse.status}`, 502);
    }
    const tokenData = await tokenResponse.json();
    if (tokenData.error) {
      throw new AppError(`oauth_token_exchange_failed: GitHub | ${tokenData.error_description || tokenData.error}`, 400);
    }
    const accessToken = tokenData.access_token;
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `token ${accessToken}`,
        "Accept": "application/json",
        "User-Agent": "NodeAuth-Backend/1.0"
      }
    });
    if (!userResponse.ok) throw new AppError(`oauth_api_error: GitHub  | ${userResponse.status}`, 502);
    const userData = await userResponse.json();
    let email = userData.email;
    if (!email) {
      try {
        const emailRes = await fetch("https://api.github.com/user/emails", {
          headers: { "Authorization": `token ${accessToken}`, "User-Agent": "NodeAuth-Backend/1.0" }
        });
        const emails = await emailRes.json();
        email = emails.find((e) => e.primary && e.verified)?.email || emails.find((e) => e.verified)?.email;
      } catch (e) {
      }
    }
    return {
      id: String(userData.id),
      username: userData.login || userData.username,
      email: email || "",
      avatar: userData.avatar_url,
      provider: this.id
    };
  }
};

// ../src/features/auth/providers/cloudflareAccessProvider.ts
init_config();
function base64UrlEncode2(str) {
  let binary = "";
  const len = str.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(str[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function generatePKCE2() {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64UrlEncode2(verifierBytes);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const challenge = base64UrlEncode2(new Uint8Array(hash));
  return { verifier, challenge };
}
var CloudflareAccessProvider = class extends BaseOAuthProvider {
  id = "cloudflare";
  name = "Cloudflare Access";
  color = "#F38020";
  icon = "iconCloudflare";
  whitelistFields = ["email"];
  // Cloudflare Access 主要基于邮箱验证
  constructor(env) {
    super(env);
  }
  // 提取公共方法处理 URL 标准化
  getBaseUrl() {
    const orgDomain = this.env.OAUTH_CLOUDFLARE_ORG_DOMAIN;
    if (!orgDomain) {
      throw new AppError("Cloudflare Access \u914D\u7F6E\u4E0D\u5B8C\u6574\uFF1A\u7F3A\u5C11 OAUTH_CLOUDFLARE_ORG_DOMAIN", 500);
    }
    let baseUrl = orgDomain.replace(/\/$/, "");
    if (!baseUrl.startsWith("http")) {
      baseUrl = `https://${baseUrl}`;
    }
    return baseUrl;
  }
  async getAuthorizeUrl(state) {
    const clientId = this.env.OAUTH_CLOUDFLARE_CLIENT_ID;
    const redirectUri = this.env.OAUTH_CLOUDFLARE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new AppError("Cloudflare Access \u914D\u7F6E\u4E0D\u5B8C\u6574", 500);
    }
    const baseUrl = this.getBaseUrl();
    const { verifier, challenge } = await generatePKCE2();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid profile email",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256"
    });
    const url = `${baseUrl}/cdn-cgi/access/sso/oidc/${clientId}/authorization?${params.toString()}`;
    return { url, codeVerifier: verifier };
  }
  async handleCallback(params, codeVerifier) {
    const code = typeof params === "string" ? params : params.get("code");
    if (!code) {
      throw new AppError("oauth_code_missing", 400);
    }
    const clientId = this.env.OAUTH_CLOUDFLARE_CLIENT_ID;
    const clientSecret = this.env.OAUTH_CLOUDFLARE_CLIENT_SECRET;
    const redirectUri = this.env.OAUTH_CLOUDFLARE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError("Cloudflare Access \u914D\u7F6E\u4E0D\u5B8C\u6574", 500);
    }
    const baseUrl = this.getBaseUrl();
    const tokenResponse = await fetch(`${baseUrl}/cdn-cgi/access/sso/oidc/${clientId}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: codeVerifier || "",
        // PKCE 必需参数
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`Cloudflare Access Token Error: ${tokenResponse.status} - ${errorText}`);
      throw new AppError(`oauth_token_exchange_failed: Cloudflare Access  | ${tokenResponse.status}`, 502);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const userResponse = await fetch(`${baseUrl}/cdn-cgi/access/sso/oidc/${clientId}/userinfo`, {
      headers: { "Authorization": `Bearer ${accessToken}` }
    });
    if (!userResponse.ok) throw new AppError(`oauth_api_error: Cloudflare Access  | ${userResponse.status}`, 502);
    const userData = await userResponse.json();
    return {
      id: userData.sub,
      // Cloudflare 用户唯一 ID
      username: userData.preferred_username || userData.email.split("@")[0],
      email: userData.email,
      avatar: "",
      // Cloudflare Access 通常不提供头像
      provider: this.id
    };
  }
};

// ../src/features/auth/providers/nodeLocProvider.ts
init_config();
var NodeLocProvider = class extends BaseOAuthProvider {
  id = "nodeloc";
  name = "NodeLoc";
  color = "#475569";
  icon = "iconNodeloc";
  whitelistFields = ["email"];
  constructor(env) {
    super(env);
  }
  getAuthorizeUrl(state) {
    const clientId = this.env.OAUTH_NODELOC_CLIENT_ID;
    const redirectUri = this.env.OAUTH_NODELOC_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new AppError("oauth_config_incomplete", 500);
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid profile email",
      state
    });
    return { url: `https://www.nodeloc.com/oauth-provider/authorize?${params.toString()}` };
  }
  async handleCallback(params, _codeVerifier) {
    const code = typeof params === "string" ? params : params.get("code");
    if (!code) {
      throw new AppError("oauth_code_missing", 400);
    }
    const clientId = this.env.OAUTH_NODELOC_CLIENT_ID;
    const clientSecret = this.env.OAUTH_NODELOC_CLIENT_SECRET;
    const redirectUri = this.env.OAUTH_NODELOC_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError("oauth_config_incomplete", 500);
    }
    const tokenResponse = await fetch("https://www.nodeloc.com/oauth-provider/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      })
    });
    if (!tokenResponse.ok) {
      throw new AppError(`oauth_token_exchange_failed: NodeLoc  | ${tokenResponse.status}`, 502);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const userResponse = await fetch("https://www.nodeloc.com/oauth-provider/userinfo", {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json"
      }
    });
    if (!userResponse.ok) throw new AppError(`oauth_api_error: NodeLoc  | ${userResponse.status}`, 502);
    const userData = await userResponse.json();
    return {
      id: String(userData.id),
      username: userData.username || userData.name || userData.nickname,
      email: userData.email || "",
      avatar: userData.avatar || userData.avatar_url || userData.avatarUrl || "",
      provider: this.id
    };
  }
};

// ../src/features/auth/providers/giteeProvider.ts
init_config();
var GiteeProvider = class extends BaseOAuthProvider {
  id = "gitee";
  name = "Gitee";
  color = "#C71D23";
  icon = "iconGitee";
  whitelistFields = ["email"];
  constructor(env) {
    super(env);
  }
  getAuthorizeUrl(state) {
    const clientId = this.env.OAUTH_GITEE_CLIENT_ID;
    const redirectUri = this.env.OAUTH_GITEE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new AppError("oauth_config_incomplete", 500);
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "user_info emails",
      state
    });
    return { url: `https://gitee.com/oauth/authorize?${params.toString()}` };
  }
  async handleCallback(params, _codeVerifier) {
    const code = typeof params === "string" ? params : params.get("code");
    if (!code) {
      throw new AppError("oauth_code_missing", 400);
    }
    const clientId = this.env.OAUTH_GITEE_CLIENT_ID;
    const clientSecret = this.env.OAUTH_GITEE_CLIENT_SECRET;
    const redirectUri = this.env.OAUTH_GITEE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError("oauth_config_incomplete", 500);
    }
    const tokenResponse = await fetch("https://gitee.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      })
    });
    if (!tokenResponse.ok) {
      throw new AppError(`oauth_token_exchange_failed: Gitee  | ${tokenResponse.status}`, 502);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const userResponse = await fetch(`https://gitee.com/api/v5/user?access_token=${accessToken}`);
    if (!userResponse.ok) throw new AppError(`oauth_api_error: Gitee  | ${userResponse.status}`, 502);
    const userData = await userResponse.json();
    let email = userData.email;
    if (!email) {
      try {
        const emailRes = await fetch(`https://gitee.com/api/v5/emails?access_token=${accessToken}`);
        if (emailRes.ok) {
          const emails = await emailRes.json();
          email = emails.find((e) => e.scope && e.scope.includes("primary"))?.email || emails[0]?.email;
        }
      } catch (e) {
      }
    }
    return {
      id: String(userData.id),
      username: userData.login || userData.name,
      email: email || "",
      avatar: userData.avatar_url || "",
      provider: this.id
    };
  }
};

// ../src/features/auth/providers/telegramProvider.ts
init_config();
var TelegramProvider = class extends BaseOAuthProvider {
  id = "telegram";
  name = "Telegram";
  color = "#54a9eb";
  icon = "iconTelegram";
  whitelistFields = ["id"];
  // Telegram 不保证提供 email
  constructor(env) {
    super(env);
  }
  // 修改为 Deep Link 模式：生成跳转到 Bot 的链接，并携带 state 参数
  // 例如：https://t.me/MyAuthBot?start=state_value
  getAuthorizeUrl(state) {
    const botName = this.env.OAUTH_TELEGRAM_BOT_NAME;
    if (!botName) throw new AppError("telegram_missing_bot_name", 500);
    return { url: `https://t.me/${botName}?start=${state}` };
  }
  async handleCallback(params, _codeVerifier) {
    if (typeof params === "string") {
      throw new AppError("telegram_missing_query", 400);
    }
    const botToken = this.env.OAUTH_TELEGRAM_BOT_TOKEN;
    if (!botToken) throw new AppError("telegram_missing_bot_token", 500);
    const hash = params.get("hash");
    if (!hash) throw new AppError("telegram_missing_hash", 400);
    const dataCheckArr = [];
    const allowedKeys = ["auth_date", "first_name", "id", "last_name", "photo_url", "username"];
    params.forEach((value, key2) => {
      if (key2 !== "hash" && allowedKeys.includes(key2)) {
        dataCheckArr.push(`${key2}=${value}`);
      }
    });
    dataCheckArr.sort();
    const dataCheckString = dataCheckArr.join("\n");
    const encoder = new TextEncoder();
    const secretKeyData = await crypto.subtle.digest("SHA-256", encoder.encode(botToken));
    const key = await crypto.subtle.importKey(
      "raw",
      secretKeyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const signature = this.hexToBuf(hash);
    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signature,
      encoder.encode(dataCheckString)
    );
    if (!isValid) {
      throw new AppError("telegram_signature_failed", 403);
    }
    const authDate = parseInt(params.get("auth_date") || "0");
    const now = Math.floor(Date.now() / 1e3);
    if (now - authDate > 86400) {
      throw new AppError("telegram_login_expired", 401);
    }
    return {
      id: params.get("id"),
      username: params.get("username") || `tg_user_${params.get("id")}`,
      email: "",
      // Telegram 登录通常没有 Email
      avatar: params.get("photo_url") || void 0,
      provider: this.id
    };
  }
  hexToBuf(hex) {
    const view = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return view.buffer;
  }
};

// ../src/features/auth/providers/googleProvider.ts
init_config();
var GoogleProvider = class extends BaseOAuthProvider {
  id = "google";
  name = "Google";
  color = "#33A854";
  icon = "iconGoogle";
  whitelistFields = ["email"];
  // Google 主要基于邮箱验证
  constructor(env) {
    super(env);
  }
  getAuthorizeUrl(state) {
    const clientId = this.env.OAUTH_GOOGLE_CLIENT_ID;
    const redirectUri = this.env.OAUTH_GOOGLE_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      throw new AppError("oauth_config_incomplete", 500);
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "online",
      prompt: "consent"
    });
    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
  }
  async handleCallback(params, _codeVerifier) {
    const code = typeof params === "string" ? params : params.get("code");
    if (!code) {
      throw new AppError("oauth_code_missing", 400);
    }
    const clientId = this.env.OAUTH_GOOGLE_CLIENT_ID;
    const clientSecret = this.env.OAUTH_GOOGLE_CLIENT_SECRET;
    const redirectUri = this.env.OAUTH_GOOGLE_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri) {
      throw new AppError("oauth_config_incomplete", 500);
    }
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri
      })
    });
    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new AppError(`oauth_token_exchange_failed: Google  | ${tokenResponse.status} - ${errText}`, 502);
    }
    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });
    if (!userResponse.ok) throw new AppError(`oauth_api_error: Google  | ${userResponse.status}`, 502);
    const userData = await userResponse.json();
    return {
      id: userData.sub,
      username: userData.name || userData.email.split("@")[0],
      email: userData.email,
      avatar: userData.picture,
      provider: this.id
    };
  }
};

// ../src/features/auth/providers/index.ts
function getOAuthProvider(providerId, env) {
  switch (providerId.toLowerCase()) {
    case "github":
      return new GitHubProvider(env);
    case "gitee":
      return new GiteeProvider(env);
    case "cloudflare":
      return new CloudflareAccessProvider(env);
    case "nodeloc":
      return new NodeLocProvider(env);
    case "telegram":
      return new TelegramProvider(env);
    case "google":
      return new GoogleProvider(env);
    default:
      throw new AppError(`unsupported_provider: ${providerId}`, 400);
  }
}
function getAvailableProviders(env) {
  const providers = [];
  const githubProvider = new GitHubProvider(env);
  const cloudflareProvider = new CloudflareAccessProvider(env);
  const nodelocProvider = new NodeLocProvider(env);
  const giteeProvider = new GiteeProvider(env);
  const telegramProvider = new TelegramProvider(env);
  const googleProvider = new GoogleProvider(env);
  if (env.OAUTH_GOOGLE_CLIENT_ID && env.OAUTH_GOOGLE_CLIENT_SECRET) {
    providers.push({
      id: googleProvider.id,
      name: googleProvider.name,
      icon: googleProvider.icon,
      color: googleProvider.color
    });
  }
  if (env.OAUTH_GITHUB_CLIENT_ID && env.OAUTH_GITHUB_CLIENT_SECRET) {
    providers.push({
      id: githubProvider.id,
      name: githubProvider.name,
      icon: githubProvider.icon,
      color: githubProvider.color
    });
  }
  if (env.OAUTH_TELEGRAM_BOT_TOKEN && env.OAUTH_TELEGRAM_BOT_NAME) {
    providers.push({
      id: telegramProvider.id,
      name: telegramProvider.name,
      icon: telegramProvider.icon,
      color: telegramProvider.color
    });
  }
  if (env.OAUTH_CLOUDFLARE_CLIENT_ID && env.OAUTH_CLOUDFLARE_CLIENT_SECRET) {
    providers.push({
      id: cloudflareProvider.id,
      name: cloudflareProvider.name,
      icon: cloudflareProvider.icon,
      color: cloudflareProvider.color
    });
  }
  if (env.OAUTH_GITEE_CLIENT_ID && env.OAUTH_GITEE_CLIENT_SECRET) {
    providers.push({
      id: giteeProvider.id,
      name: giteeProvider.name,
      icon: giteeProvider.icon,
      color: giteeProvider.color
    });
  }
  if (env.OAUTH_NODELOC_CLIENT_ID && env.OAUTH_NODELOC_CLIENT_SECRET) {
    providers.push({
      id: nodelocProvider.id,
      name: nodelocProvider.name,
      icon: nodelocProvider.icon,
      color: nodelocProvider.color
    });
  }
  if (env.OAUTH_WALLETCONNECT_PROJECT_ID) {
    providers.push({
      id: "web3",
      name: "Web3 Wallet",
      icon: "iconWallet",
      color: "#3396FF",
      projectId: env.OAUTH_WALLETCONNECT_PROJECT_ID,
      rpcUrl: env.OAUTH_WALLETCONNECT_RPC_URL || "https://cloudflare-eth.com",
      // If proxy is enabled, provide the internal proxy paths
      relayUrl: env.OAUTH_WALLETCONNECT_SELF_PROXY === "true" ? "/api/oauth/wc-proxy/relay" : void 0,
      verifyUrl: env.OAUTH_WALLETCONNECT_SELF_PROXY === "true" ? "/api/oauth/wc-proxy/verify" : void 0
    });
  }
  return providers;
}

// ../src/features/auth/authService.ts
init_config();
init_crypto();

// ../src/shared/db/repositories/emergencyRepository.ts
import { eq as eq3 } from "drizzle-orm";
var EmergencyRepository = class {
  db;
  constructor(dbClient) {
    this.db = dbClient;
  }
  /**
   * 获取元数据
   */
  async getMetadata(key) {
    const result = await this.db.select().from(schemaMetadata4).where(eq3(schemaMetadata4.key, key)).limit(1);
    return result[0]?.value || null;
  }
  /**
   * 设置元数据
   */
  async setMetadata(key, value) {
    const existing = await this.getMetadata(key);
    if (existing !== null) {
      await this.db.update(schemaMetadata4).set({ value }).where(eq3(schemaMetadata4.key, key));
    } else {
      await this.db.insert(schemaMetadata4).values({ key, value });
    }
  }
  /**
   * 检查系统是否已确认初始化 (Emergency 流程)
   */
  async isEmergencyConfirmed() {
    const value = await this.getMetadata("emergency_confirmed");
    return value === "1";
  }
  /**
   * 确认系统初始化 (Emergency 流程)
   */
  async confirmEmergency() {
    await this.setMetadata("emergency_confirmed", "1");
  }
};

// ../src/features/auth/authService.ts
var AuthService = class {
  env;
  emergencyRepository;
  sessionService;
  constructor(env) {
    this.env = env;
    this.emergencyRepository = new EmergencyRepository(env.DB);
    this.sessionService = new SessionService(env);
  }
  /**
   * 生成提供商的授权重定向地址
   */
  async generateAuthorizeUrl(providerName) {
    const provider = getOAuthProvider(providerName, this.env);
    const state = crypto.randomUUID();
    const result = await provider.getAuthorizeUrl(state);
    return {
      url: result.url,
      state,
      codeVerifier: result.codeVerifier
    };
  }
  /**
   * OAuth Callback 处理，生成会话并返回附加参数
   */
  async handleOAuthCallback(providerName, body, clientIp, userAgent, deviceId) {
    const provider = getOAuthProvider(providerName, this.env);
    let params;
    if (providerName === "telegram") {
      const searchParams = new URLSearchParams();
      Object.entries(body).forEach(([key, value]) => {
        if (value !== void 0 && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      params = searchParams;
    } else {
      if (!body.code) throw new AppError("oauth_code_missing", 400);
      params = body.code;
    }
    const userInfo = await provider.handleCallback(params, body.codeVerifier);
    this.verifyWhitelist(userInfo, provider.whitelistFields);
    const sessionId = await this.sessionService.createSession(userInfo.email || userInfo.id, userAgent, clientIp, deviceId, providerName);
    const token = await this.generateSystemToken(userInfo, sessionId);
    const deviceKey = await generateDeviceKey(userInfo.email || userInfo.id, this.env.JWT_SECRET || "");
    const isEmergencyConfirmed = await this.emergencyRepository.isEmergencyConfirmed();
    const needsEmergency = !isEmergencyConfirmed;
    return {
      token,
      userInfo,
      deviceKey,
      needsEmergency,
      ...needsEmergency && { encryptionKey: this.env.ENCRYPTION_KEY }
    };
  }
  /**
   * 白名单校验
   */
  verifyWhitelist(userInfo, whitelistFields) {
    const allowAllStr = String(this.env.OAUTH_ALLOW_ALL || "").toLowerCase();
    if (allowAllStr === "true" || allowAllStr === "1" || allowAllStr === "2") {
      return;
    }
    const allowedUsersStr = this.env.OAUTH_ALLOWED_USERS || "";
    const allowedIdentities = allowedUsersStr.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (allowedIdentities.length > 0) {
      const userEmail = (userInfo.email || "").toLowerCase();
      const userName = (userInfo.username || "").toLowerCase();
      let isAllowed = false;
      if (whitelistFields.includes("email") && userEmail) {
        if (allowedIdentities.some((id) => {
          if (id.startsWith("@")) {
            const domain = id.substring(1);
            return userEmail === domain || userEmail.endsWith("@" + domain);
          }
          return id === userEmail;
        })) {
          isAllowed = true;
        } else if (allowedIdentities.includes(userEmail)) {
          isAllowed = true;
        }
      }
      if (!isAllowed && whitelistFields.includes("username") && userName && allowedIdentities.includes(userName)) {
        isAllowed = true;
      }
      if (!isAllowed) {
        throw new AppError("unauthorized_user", 403);
      }
    } else {
      throw new AppError("not_whitelisted", 403);
    }
  }
  /**
   * 生成系统内部 Token
   */
  async generateSystemToken(userInfo, sessionId) {
    const payload = {
      sessionId,
      userInfo: {
        id: userInfo.id,
        username: userInfo.username,
        email: userInfo.email,
        avatar: userInfo.avatar,
        provider: userInfo.provider
      }
    };
    if (!this.env.JWT_SECRET) {
      throw new AppError("missing_jwt_secret", 500);
    }
    return await generateSecureJWT(payload, this.env.JWT_SECRET);
  }
};

// ../src/features/auth/webAuthnService.ts
init_config();
init_crypto();
import { eq as eq4, desc } from "drizzle-orm";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse
} from "@simplewebauthn/server";
var WebAuthnService = class {
  env;
  rpName = "NodeAuth";
  rpID;
  origin;
  emergencyRepository;
  sessionService;
  constructor(env, url, headers) {
    this.env = env;
    const parsedUrl = new URL(url);
    this.emergencyRepository = new EmergencyRepository(env.DB);
    this.sessionService = new SessionService(env);
    const proto = headers?.["x-forwarded-proto"] || parsedUrl.protocol.replace(":", "");
    const host = headers?.["x-forwarded-host"] || parsedUrl.host;
    this.rpID = host.split(":")[0];
    this.origin = `${proto.includes("://") ? proto : proto + "://"}${host}`;
  }
  /**
   * 生成注册选项
   */
  async generateRegistrationOptions(userId, userEmail, userNameExt) {
    const results = await this.env.DB.select({ credential_id: authPasskeys4.credentialId }).from(authPasskeys4).where(eq4(authPasskeys4.userId, userEmail));
    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: new TextEncoder().encode(userId),
      userName: userNameExt || userEmail,
      userDisplayName: `NodeAuth (${userNameExt || userEmail})`,
      attestationType: "none",
      excludeCredentials: results.map((row) => ({
        id: row.credential_id,
        type: "public-key"
      })),
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "preferred"
      }
    });
    return options;
  }
  /**
   * 验证注册响应
   */
  async verifyRegistrationResponse(userEmail, body, expectedChallenge, credentialName) {
    const verification = await verifyRegistrationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID
    });
    if (verification.verified && verification.registrationInfo) {
      const { credential } = verification.registrationInfo;
      await this.env.DB.insert(authPasskeys4).values({
        credentialId: credential.id,
        userId: userEmail,
        publicKey: credential.publicKey,
        counter: verification.registrationInfo.credential.counter,
        name: credentialName || `Passkey ${(/* @__PURE__ */ new Date()).toLocaleDateString()}`,
        createdAt: Date.now()
      });
      return { success: true };
    }
    throw new AppError("webauthn_registration_failed", 400);
  }
  /**
   * 生成登录选项
   */
  async generateAuthenticationOptions() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: "preferred"
    });
    return options;
  }
  /**
   * 验证登录响应
   */
  async verifyAuthenticationResponse(body, expectedChallenge, clientIp, userAgent, deviceId) {
    const credentialID = body.id;
    const [credential] = await this.env.DB.select().from(authPasskeys4).where(eq4(authPasskeys4.credentialId, credentialID)).limit(1);
    if (!credential) {
      throw new AppError("passkey_not_found", 404);
    }
    const verification = await verifyAuthenticationResponse({
      response: body,
      expectedChallenge,
      expectedOrigin: this.origin,
      expectedRPID: this.rpID,
      credential: {
        id: credential.credentialId,
        publicKey: new Uint8Array(Object.values(credential.publicKey)),
        counter: credential.counter,
        transports: []
      }
    });
    if (verification.verified && verification.authenticationInfo) {
      await this.env.DB.update(authPasskeys4).set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: Date.now()
      }).where(eq4(authPasskeys4.credentialId, credentialID));
      const userEmail = credential.userId;
      const sessionId = await this.sessionService.createSession(userEmail, userAgent, clientIp, deviceId, "passkey");
      const token = await this.generateSystemToken({
        id: userEmail,
        username: userEmail.includes("@") ? userEmail.split("@")[0] : userEmail,
        email: userEmail.includes("@") ? userEmail : void 0,
        provider: "passkey"
      }, sessionId);
      const deviceKey = await generateDeviceKey(userEmail, this.env.JWT_SECRET || "");
      const isEmergencyConfirmed = await this.emergencyRepository.isEmergencyConfirmed();
      const needsEmergency = !isEmergencyConfirmed;
      return {
        success: true,
        token,
        deviceKey,
        userInfo: {
          id: userEmail,
          username: userEmail.includes("@") ? userEmail.split("@")[0] : userEmail,
          email: userEmail.includes("@") ? userEmail : void 0,
          provider: "passkey"
        },
        needsEmergency,
        ...needsEmergency && { encryptionKey: this.env.ENCRYPTION_KEY }
      };
    }
    throw new AppError("webauthn_login_failed", 400);
  }
  async generateSystemToken(userInfo, sessionId) {
    const payload = {
      sessionId,
      userInfo: {
        id: userInfo.id,
        username: userInfo.username,
        email: userInfo.email,
        avatar: userInfo.avatar,
        provider: userInfo.provider
      }
    };
    if (!this.env.JWT_SECRET) {
      throw new AppError("missing_jwt_secret", 500);
    }
    return await generateSecureJWT(payload, this.env.JWT_SECRET);
  }
  /**
   * 获取用户的凭证列表
   */
  async listCredentials() {
    const results = await this.env.DB.select({
      id: authPasskeys4.credentialId,
      name: authPasskeys4.name,
      created_at: authPasskeys4.createdAt,
      last_used_at: authPasskeys4.lastUsedAt
    }).from(authPasskeys4).orderBy(desc(authPasskeys4.createdAt));
    return results;
  }
  /**
   * 更新凭证名称
   */
  async updateCredentialName(credentialId, name) {
    await this.env.DB.update(authPasskeys4).set({ name }).where(eq4(authPasskeys4.credentialId, credentialId));
    return { success: true };
  }
  /**
   * 删除凭证
   */
  async deleteCredential(credentialId) {
    await this.env.DB.delete(authPasskeys4).where(eq4(authPasskeys4.credentialId, credentialId));
    return { success: true };
  }
};

// ../src/features/auth/web3WalletAuthService.ts
init_config();
init_crypto();
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
var Web3WalletAuthService = class {
  env;
  emergencyRepository;
  sessionService;
  constructor(env) {
    this.env = env;
    this.emergencyRepository = new EmergencyRepository(env.DB);
    this.sessionService = new SessionService(env);
  }
  /**
   * 生成 Web3 登录的防篡改 Challenge 参数 (Nonce)
   */
  async generateAuthenticationOptions() {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    return { nonce };
  }
  /**
   * 校验前端上报的以太坊签名 (Ethereum Signature)
   */
  async verifyAuthenticationResponse(address, message, signature, expectedNonce, clientIp, userAgent, deviceId) {
    if (!expectedNonce) {
      throw new AppError("web3_nonce_missing", 400);
    }
    if (!message.includes(expectedNonce)) {
      throw new AppError("web3_nonce_mismatch", 400);
    }
    let isValid = false;
    try {
      const rpcUrl = this.env.OAUTH_WALLETCONNECT_RPC_URL || "https://cloudflare-eth.com";
      const client = createPublicClient({
        chain: mainnet,
        transport: http(rpcUrl)
      });
      isValid = await client.verifyMessage({
        address,
        message,
        signature
      });
    } catch (error) {
      throw new AppError("web3_signature_invalid", 400);
    }
    if (!isValid) {
      throw new AppError("web3_signature_invalid", 400);
    }
    const normalizedAddress = address.toLowerCase();
    this.verifyWhitelist(normalizedAddress);
    const sessionId = await this.sessionService.createSession(normalizedAddress, userAgent, clientIp, deviceId, "web3");
    const token = await this.generateSystemToken(normalizedAddress, sessionId);
    const deviceKey = await generateDeviceKey(normalizedAddress, this.env.JWT_SECRET || "");
    const isEmergencyConfirmed = await this.emergencyRepository.isEmergencyConfirmed();
    const needsEmergency = !isEmergencyConfirmed;
    return {
      token,
      userInfo: {
        id: normalizedAddress,
        username: normalizedAddress,
        provider: "web3",
        avatar: ""
        // Web3目前不自带内聚头像，可设为空处理
      },
      deviceKey,
      needsEmergency,
      ...needsEmergency && { encryptionKey: this.env.ENCRYPTION_KEY }
    };
  }
  /**
   * 内部白名单隔离审查机制
   */
  verifyWhitelist(userAddress) {
    const allowAllStr = String(this.env.OAUTH_ALLOW_ALL || "").toLowerCase();
    if (allowAllStr === "true" || allowAllStr === "1" || allowAllStr === "2") {
      return;
    }
    const allowedUsersStr = this.env.OAUTH_ALLOWED_USERS || "";
    const allowedIdentities = allowedUsersStr.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (allowedIdentities.length > 0) {
      let isAllowed = false;
      if (allowedIdentities.includes(userAddress)) {
        isAllowed = true;
      }
      if (!isAllowed) {
        throw new AppError("unauthorized_user", 403);
      }
    } else {
      throw new AppError("not_whitelisted", 403);
    }
  }
  /**
   * 生成与现有生命周期对齐的内部系统 JWT Token
   */
  async generateSystemToken(address, sessionId) {
    const payload = {
      sessionId,
      userInfo: {
        id: address,
        username: address,
        email: address,
        // 将邮箱字段复写为地址以兼容下游遗留设计
        provider: "web3"
      }
    };
    if (!this.env.JWT_SECRET) {
      throw new AppError("missing_jwt_secret", 500);
    }
    return await generateSecureJWT(payload, this.env.JWT_SECRET);
  }
};

// ../src/features/auth/authRoutes.ts
init_logger();
var auth = new Hono();
var isSecureContext = (c) => c.env.ENVIRONMENT !== "development";
var getService = (c) => new AuthService(c.env);
var getWebAuthnService = (c) => new WebAuthnService(c.env, c.req.url, c.req.header());
var getWeb3WalletAuthService = (c) => new Web3WalletAuthService(c.env);
var getSessionService = (c) => new SessionService(c.env);
auth.get("/providers", (c) => {
  const providers = getAvailableProviders(c.env);
  if (providers.length === 0) {
    logger.warn("[OAuth] No providers configured. Please check environment variables.");
  }
  const enhancedProviders = providers.map((p) => {
    if (p.id === "telegram") {
      const rawName = c.env.OAUTH_TELEGRAM_BOT_NAME || "";
      return { ...p, botName: rawName.replace(/^@/, "") };
    }
    return p;
  });
  return c.json({
    success: true,
    providers: enhancedProviders
  });
});
auth.get("/authorize/:provider", async (c) => {
  const providerName = c.req.param("provider");
  const service = getService(c);
  const authData = await service.generateAuthorizeUrl(providerName);
  const stateCookieName = `oauth_state_${providerName}`;
  setCookie(c, stateCookieName, authData.state, {
    httpOnly: true,
    secure: isSecureContext(c),
    sameSite: "Lax",
    // 允许从第三方回调跳回时携带
    maxAge: 10 * 60,
    // 10分钟有效期
    path: "/"
  });
  return c.json({
    success: true,
    authUrl: authData.url,
    state: authData.state,
    codeVerifier: authData.codeVerifier
  });
});
auth.post("/callback/:provider", rateLimit({
  windowMs: SECURITY_CONFIG.LOCKOUT_TIME,
  max: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS
}), async (c) => {
  const providerName = c.req.param("provider");
  const body = await c.req.json();
  const stateCookieName = `oauth_state_${providerName}`;
  const serverState = getCookie2(c, stateCookieName);
  const clientState = body.state;
  if (!serverState || !clientState || serverState !== clientState) {
    throw new AppError("oauth_state_invalid", 403);
  }
  deleteCookie(c, stateCookieName, { path: "/", secure: isSecureContext(c), sameSite: "Lax" });
  const service = getService(c);
  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  const userAgent = c.req.header("User-Agent") || "Unknown Device";
  const { token, userInfo, deviceKey, needsEmergency, encryptionKey } = await service.handleOAuthCallback(providerName, body, clientIp, userAgent, body.deviceId);
  setCookie(c, "auth_token", token, {
    httpOnly: true,
    secure: isSecureContext(c),
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    // 7天
    path: "/"
  });
  const csrfToken = crypto.randomUUID();
  setCookie(c, "csrf_token", csrfToken, {
    httpOnly: false,
    secure: isSecureContext(c),
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/"
  });
  await resetRateLimit(c, `rl:${clientIp}:/api/auth/callback/${providerName}`);
  const publicKey = body.publicKey;
  let finalDeviceKey = deviceKey;
  if (publicKey && deviceKey) {
    const { encryptWithRSAPublicKey: encryptWithRSAPublicKey2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
    finalDeviceKey = await encryptWithRSAPublicKey2(deviceKey, publicKey);
  }
  return c.json({
    success: true,
    userInfo,
    deviceKey: finalDeviceKey,
    needsEmergency,
    encryptionKey
  });
});
auth.post("/logout", (c) => {
  const cookieOpts = { path: "/", secure: isSecureContext(c), sameSite: "Lax" };
  deleteCookie(c, "auth_token", cookieOpts);
  deleteCookie(c, "csrf_token", cookieOpts);
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  return c.json({
    success: true,
    message: "Logged out successfully"
  });
});
auth.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
  const repository = new EmergencyRepository(c.env.DB);
  const isEmergencyConfirmed = await repository.isEmergencyConfirmed();
  const encryptionKey = !isEmergencyConfirmed ? c.env.ENCRYPTION_KEY : void 0;
  const { generateDeviceKey: generateDeviceKey2, encryptWithRSAPublicKey: encryptWithRSAPublicKey2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
  const deviceKey = await generateDeviceKey2(user.email || user.id, c.env.JWT_SECRET || "");
  const publicKey = c.req.header("X-Public-Key");
  let finalDeviceKey = deviceKey;
  if (publicKey && deviceKey) {
    finalDeviceKey = await encryptWithRSAPublicKey2(deviceKey, publicKey);
  }
  return c.json({
    success: true,
    userInfo: user,
    deviceKey: finalDeviceKey,
    needsEmergency: !isEmergencyConfirmed,
    encryptionKey
  });
});
auth.get("/webauthn/register/options", authMiddleware, async (c) => {
  const user = c.get("user");
  const service = getWebAuthnService(c);
  const identity = user.email || user.id;
  const displayName = user.username || identity;
  const options = await service.generateRegistrationOptions(user.id, identity, displayName);
  setCookie(c, "webauthn_registration_challenge", options.challenge, {
    httpOnly: true,
    secure: isSecureContext(c),
    sameSite: "Lax",
    maxAge: 120,
    path: "/"
  });
  return c.json(options);
});
auth.post("/webauthn/register/verify", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const expectedChallenge = getCookie2(c, "webauthn_registration_challenge");
  if (!expectedChallenge) throw new AppError("webauthn_challenge_missing", 400);
  const service = getWebAuthnService(c);
  const { name } = body;
  const identity = user.email || user.id;
  const result = await service.verifyRegistrationResponse(identity, body.response, expectedChallenge, name);
  deleteCookie(c, "webauthn_registration_challenge", { path: "/", secure: isSecureContext(c) });
  return c.json(result);
});
auth.get("/webauthn/login/options", rateLimit({
  windowMs: 60 * 1e3,
  // 1分钟内限制获取 options 的频率
  max: 10
}), async (c) => {
  const service = getWebAuthnService(c);
  const options = await service.generateAuthenticationOptions();
  setCookie(c, "webauthn_login_challenge", options.challenge, {
    httpOnly: true,
    secure: isSecureContext(c),
    sameSite: "Lax",
    maxAge: 120,
    path: "/"
  });
  return c.json(options);
});
auth.post("/webauthn/login/verify", rateLimit({
  windowMs: SECURITY_CONFIG.LOCKOUT_TIME,
  max: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS
}), async (c) => {
  const body = await c.req.json();
  const expectedChallenge = getCookie2(c, "webauthn_login_challenge");
  if (!expectedChallenge) throw new AppError("webauthn_challenge_missing", 400);
  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  const userAgent = c.req.header("User-Agent") || "Unknown Device";
  const service = getWebAuthnService(c);
  const result = await service.verifyAuthenticationResponse(body, expectedChallenge, clientIp, userAgent, body.deviceId);
  setCookie(c, "auth_token", result.token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/"
  });
  const csrfToken = crypto.randomUUID();
  setCookie(c, "csrf_token", csrfToken, {
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/"
  });
  await resetRateLimit(c, `rl:${clientIp}:/api/auth/webauthn/login/verify`);
  deleteCookie(c, "webauthn_login_challenge", { path: "/", secure: isSecureContext(c) });
  let finalDeviceKey = result.deviceKey;
  if (body.publicKey && result.deviceKey) {
    const { encryptWithRSAPublicKey: encryptWithRSAPublicKey2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
    finalDeviceKey = await encryptWithRSAPublicKey2(result.deviceKey, body.publicKey);
  }
  return c.json({
    success: true,
    deviceKey: finalDeviceKey,
    userInfo: result.userInfo,
    needsEmergency: result.needsEmergency,
    encryptionKey: result.encryptionKey
  });
});
auth.get("/webauthn/credentials", authMiddleware, async (c) => {
  const service = getWebAuthnService(c);
  const credentials = await service.listCredentials();
  return c.json({ success: true, credentials });
});
auth.delete("/webauthn/credentials/:id", authMiddleware, async (c) => {
  const credentialId = c.req.param("id");
  const service = getWebAuthnService(c);
  const result = await service.deleteCredential(credentialId);
  return c.json(result);
});
auth.put("/webauthn/credentials/:id", authMiddleware, async (c) => {
  const credentialId = c.req.param("id");
  const body = await c.req.json();
  const { name } = body;
  if (!name) {
    throw new AppError("credential_name_required", 400);
  }
  const service = getWebAuthnService(c);
  const result = await service.updateCredentialName(credentialId, name);
  return c.json(result);
});
auth.get("/web3/login/options", rateLimit({
  windowMs: 60 * 1e3,
  max: 10
}), async (c) => {
  const service = getWeb3WalletAuthService(c);
  const options = await service.generateAuthenticationOptions();
  setCookie(c, "web3_login_nonce", options.nonce, {
    httpOnly: true,
    secure: isSecureContext(c),
    sameSite: "Lax",
    maxAge: 120,
    path: "/"
  });
  return c.json(options);
});
auth.post("/web3/login/verify", rateLimit({
  windowMs: SECURITY_CONFIG.LOCKOUT_TIME,
  max: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS
}), async (c) => {
  const body = await c.req.json();
  const expectedNonce = getCookie2(c, "web3_login_nonce");
  if (!expectedNonce) throw new AppError("web3_nonce_missing", 400);
  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  const userAgent = c.req.header("User-Agent") || "Unknown Device";
  const service = getWeb3WalletAuthService(c);
  const result = await service.verifyAuthenticationResponse(
    body.address,
    body.message,
    body.signature,
    expectedNonce,
    clientIp,
    userAgent,
    body.deviceId
  );
  setCookie(c, "auth_token", result.token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/"
  });
  const csrfToken = crypto.randomUUID();
  setCookie(c, "csrf_token", csrfToken, {
    httpOnly: false,
    secure: isSecureContext(c),
    sameSite: "Lax",
    maxAge: 7 * 24 * 60 * 60,
    path: "/"
  });
  await resetRateLimit(c, `rl:${clientIp}:/api/auth/web3/login/verify`);
  deleteCookie(c, "web3_login_nonce", { path: "/", secure: isSecureContext(c) });
  let finalDeviceKey = result.deviceKey;
  if (body.publicKey && result.deviceKey) {
    const { encryptWithRSAPublicKey: encryptWithRSAPublicKey2 } = await Promise.resolve().then(() => (init_crypto(), crypto_exports));
    finalDeviceKey = await encryptWithRSAPublicKey2(result.deviceKey, body.publicKey);
  }
  return c.json({
    success: true,
    deviceKey: finalDeviceKey,
    userInfo: result.userInfo,
    needsEmergency: result.needsEmergency,
    encryptionKey: result.encryptionKey
  });
});
auth.get("/sessions", authMiddleware, async (c) => {
  const user = c.get("user");
  const currentSessionId = c.get("sessionId");
  const service = getSessionService(c);
  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  if (currentSessionId) {
    c.executionCtx.waitUntil(service.heartbeat(currentSessionId, clientIp));
  }
  const sessions = await service.getUserSessions(user.email || user.id, currentSessionId);
  return c.json({ success: true, sessions });
});
auth.delete("/sessions", authMiddleware, async (c) => {
  const user = c.get("user");
  const currentSessionId = c.get("sessionId");
  const service = getSessionService(c);
  if (!currentSessionId) {
    throw new AppError("Current session invalid", 400);
  }
  await service.deleteAllOtherSessions(user.email || user.id, currentSessionId);
  return new Response(null, { status: 204 });
});
auth.delete("/sessions/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const targetSessionId = c.req.param("id");
  const currentSessionId = c.get("sessionId");
  const service = getSessionService(c);
  if (!currentSessionId) {
    throw new AppError("Current session invalid", 400);
  }
  await service.deleteSession(user.email || user.id, targetSessionId || "", currentSessionId);
  return new Response(null, { status: 204 });
});
var authRoutes_default = auth;

// ../src/features/vault/vaultRoutes.ts
import { Hono as Hono2 } from "hono";

// ../src/features/vault/vaultService.ts
init_config();

// ../src/shared/db/db.ts
import { inArray } from "drizzle-orm";
init_crypto();
init_common();
init_logger();
async function encryptField(data, key) {
  const encrypted = await encryptData(data, key);
  return JSON.stringify(encrypted);
}
async function decryptField(encryptedStr, key) {
  try {
    const encryptedObj = JSON.parse(encryptedStr);
    return await decryptData(encryptedObj, key);
  } catch (e) {
    logger.error("Decryption failed", e);
    return null;
  }
}
async function batchInsertVaultItems(dbClient, items, key, createdBy, startSortOrder = 0) {
  const preparedItems = await Promise.all(items.map(async (item, index) => {
    const normalizedSecret = (item.secret || "").replace(/\s/g, "").toUpperCase();
    const secretEncrypted = await encryptField(normalizedSecret, key);
    return {
      id: crypto.randomUUID(),
      service: sanitizeInput(item.service, 50),
      account: sanitizeInput(item.account, 100),
      category: item.category ? sanitizeInput(item.category, 30) : "",
      secret: secretEncrypted,
      // Drizzle schema 字段名
      type: item.type || "totp",
      algorithm: (item.type === "steam" ? "SHA1" : item.algorithm || "SHA1").toUpperCase().replace(/-/g, ""),
      digits: item.digits || 6,
      period: item.period || 30,
      sortOrder: startSortOrder > 0 ? startSortOrder + (items.length - index) : 0,
      createdAt: Date.now(),
      // camelCase 匹配 Drizzle schema
      createdBy
      // camelCase 匹配 Drizzle schema
    };
  }));
  if (typeof dbClient.batch === "function") {
    const CHUNK_SIZE = 50;
    for (let i = 0; i < preparedItems.length; i += CHUNK_SIZE) {
      const chunk = preparedItems.slice(i, i + CHUNK_SIZE);
      const stmts = chunk.map((item) => dbClient.insert(vault4).values(item).onConflictDoNothing());
      await dbClient.batch(stmts);
    }
  } else {
    for (const item of preparedItems) {
      try {
        await dbClient.insert(vault4).values(item);
      } catch (e) {
        const msg = e.message?.toLowerCase() || "";
        const code = e.code || "";
        if (msg.includes("unique") || msg.includes("duplicate") || code === "ER_DUP_ENTRY" || code === "23505") {
        } else {
          throw e;
        }
      }
    }
  }
  return preparedItems.length;
}

// ../src/features/vault/vaultService.ts
init_crypto();
init_otp();
import { Buffer as Buffer3 } from "buffer";
var VaultService = class {
  repository;
  env;
  encryptionKey;
  constructor(env, repository) {
    this.env = env;
    this.repository = repository;
    if (!env.ENCRYPTION_KEY) {
      throw new AppError("missing_encryption_key", 500);
    }
    this.encryptionKey = env.ENCRYPTION_KEY;
  }
  async wrapZeroKnowledgeSecret(userId, sseEncryptedSecret) {
    if (!sseEncryptedSecret) return sseEncryptedSecret;
    try {
      const plain = await decryptField(sseEncryptedSecret, this.encryptionKey);
      const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || "");
      const maskingKey = await deriveMaskingKey(salt);
      return await maskSecret(plain, maskingKey);
    } catch (e) {
      return sseEncryptedSecret;
    }
  }
  /**
   * 获取所有账户 (解密)
   */
  async getAllAccounts() {
    const items = await this.repository.findAll();
    return await Promise.all(items.map(async (item) => ({
      ...item,
      secret: item.secret ? await decryptField(item.secret, this.encryptionKey) : item.secret
    })));
  }
  /**
   * 获取分页和搜索条件后的所有账户 (解密)
   */
  async getAccountsPaginated(userId, page, limit, search, category = "") {
    const items = await this.repository.findPaginated(page, limit, search, category);
    const totalCount = await this.repository.count(search, category);
    const categoryStats = await this.repository.getCategoryStats();
    const trashCount = await this.repository.countDeleted();
    const decryptedItems = await Promise.all(items.map(async (item) => {
      const { createdBy: _c, updatedBy: _u, ...rest } = item;
      return {
        ...rest,
        secret: await this.wrapZeroKnowledgeSecret(userId, item.secret)
      };
    }));
    return {
      items: decryptedItems,
      totalCount,
      trashCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      categoryStats: categoryStats.map((s) => ({
        category: s.category || "",
        count: s.count
      }))
    };
  }
  /**
   * 重新排序账户
   */
  async reorderAccounts(ids) {
    if (!ids || ids.length === 0) return;
    const maxSort = await this.repository.getMaxSortOrder();
    const baseOrder = Math.max(maxSort, ids.length * 1e3) + ids.length * 1e3;
    const updates = ids.map((id, index) => ({
      id,
      sortOrder: baseOrder - index * 1e3
      // 每个位置间距 1000
    }));
    await this.repository.updateSortOrders(updates);
  }
  /**
   * 分数索引：仅移动单个账号到指定排序值
   * 每次拖拽仅触发 1 次 DB UPDATE，替代全量重排
   */
  async moveSingleItem(id, sortOrder) {
    await this.repository.updateSingleSortOrder(id, sortOrder);
  }
  /**
   * 创建账户
   */
  // normalize a service+account pair for comparison
  normalizeSignature(service, account) {
    return `${(service || "").toString().trim().toLowerCase()}:${(account || "").toString().trim().toLowerCase()}`;
  }
  async createAccount(userId, data) {
    const normalized = normalizeOtpAccount(data);
    const { service, account, algorithm, digits, period, type, counter, category } = normalized;
    let secret = normalized.secret;
    if (secret && secret.startsWith("nodeauth:")) {
      const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || "");
      const maskingKey = await deriveMaskingKey(salt);
      try {
        secret = await unmaskSecret(secret, maskingKey);
      } catch (e) {
        throw new AppError("invalid_secret_format", 400);
      }
    }
    if (!service || !account || !secret) {
      throw new AppError("invalid_secret_format", 400);
    }
    if (type !== "steam" && !validateBase32Secret(secret)) {
      throw new AppError("invalid_secret_format", 400);
    }
    const existing = await this.repository.findByServiceAccountAny(service, account);
    if (existing) {
      if (existing.deletedAt !== null) {
        const encryptedSecret2 = await encryptField(secret, this.encryptionKey);
        const maxSort2 = await this.repository.getMaxSortOrder();
        await this.repository.update(existing.id, {
          category: category || "",
          secret: encryptedSecret2,
          algorithm,
          type,
          digits,
          period,
          counter,
          sortOrder: maxSort2 + 1,
          updatedAt: Date.now(),
          deletedAt: null
          // Explicitly revive!
        });
        return await this.repository.findById(existing.id);
      }
      throw new AppError("account_exists", 409);
    }
    const encryptedSecret = await encryptField(secret, this.encryptionKey);
    const maxSort = await this.repository.getMaxSortOrder();
    const created = await this.repository.create({
      id: crypto.randomUUID(),
      service,
      account,
      category: category || "",
      secret: encryptedSecret,
      algorithm,
      type,
      digits,
      period,
      counter,
      sortOrder: maxSort + 1,
      createdAt: Date.now(),
      createdBy: userId
    });
    const { createdBy: _c, updatedBy: _u, ...restCreated } = created;
    return {
      ...restCreated,
      secret: await this.wrapZeroKnowledgeSecret(userId, encryptedSecret)
    };
  }
  /**
   * HOTP 原子递增并获取新验证码
   */
  async incrementCounter(id, expectedUpdatedAt) {
    const item = await this.repository.findById(id);
    if (!item) throw new AppError("account_not_found", 404);
    if (item.type !== "hotp") {
      throw new AppError("\u8D26\u53F7\u7C7B\u578B\u4E0D\u652F\u6301\u624B\u52A8\u9012\u589E", 400);
    }
    const currentCounter = item.counter || 0;
    const secret = await decryptField(item.secret, this.encryptionKey);
    if (!secret) throw new AppError("decrypt_failed", 500);
    const { generate: generate2 } = await Promise.resolve().then(() => (init_otp(), otp_exports));
    const code = await generate2(secret, currentCounter, item.digits || 6, item.algorithm || "SHA1", "hotp");
    const newCounter = currentCounter + 1;
    const updated = await this.repository.update(id, {
      counter: newCounter,
      updatedAt: Date.now()
    }, expectedUpdatedAt);
    if (!updated) {
      throw new AppError("conflict_detected", 409);
    }
    return {
      id,
      code,
      counter: newCounter
    };
  }
  async updateAccount(userId, id, data) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new AppError("account_not_found", 404);
    const normalized = normalizeOtpAccount({ ...existing, ...data });
    const { service: normService, account: normAccount, secret: newSecret, algorithm: normAlgo, digits: normDigits, period: normPeriod, type: normType, counter: normCounter, category: normCategory } = normalized;
    let encryptedSecret;
    if (data.secret !== void 0) {
      let finalSecret = newSecret;
      if (finalSecret && finalSecret.startsWith("nodeauth:")) {
        const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || "");
        const maskingKey = await deriveMaskingKey(salt);
        try {
          finalSecret = await unmaskSecret(finalSecret, maskingKey);
        } catch (e) {
        }
      }
      if (!finalSecret || normType !== "steam" && !validateBase32Secret(finalSecret)) {
        throw new AppError("invalid_secret_format", 400);
      }
      encryptedSecret = await encryptField(finalSecret, this.encryptionKey);
    } else {
      encryptedSecret = existing.secret;
    }
    const updateFields = {
      service: normService,
      account: normAccount,
      secret: encryptedSecret,
      algorithm: normAlgo,
      type: normType,
      digits: normDigits,
      period: normPeriod,
      counter: normCounter,
      category: normCategory || "",
      updatedAt: Date.now()
    };
    const updated = await this.repository.update(id, updateFields, data.force ? void 0 : data.updatedAt);
    if (!updated) {
      const item = await this.repository.findById(id);
      if (!item) {
        throw new AppError("account_not_found", 404);
      } else {
        throw new AppError("conflict_detected", 409);
      }
    }
    const { createdBy: _c, updatedBy: _u, ...restExisting } = existing;
    return {
      ...restExisting,
      ...updateFields,
      secret: await this.wrapZeroKnowledgeSecret(userId, encryptedSecret)
    };
  }
  /**
   * 删除账户 (支持冲突校验与强制删除)
   */
  async deleteAccount(id, expectedUpdatedAt, force = false) {
    const success = await this.repository.delete(id, force ? void 0 : expectedUpdatedAt);
    if (!success) {
      const item = await this.repository.findById(id);
      if (!item) {
        throw new AppError("account_not_found", 404);
      } else {
        throw new AppError("conflict_detected", 409);
      }
    }
  }
  async batchDeleteAccounts(ids) {
    if (!ids || ids.length === 0) throw new AppError("no_account_ids", 400);
    const count2 = await this.repository.batchDelete(ids);
    return { count: count2 };
  }
  /**
   * 导出前将密文完全还原为明文（SSE 解密 + 零知识解封装）
   */
  async plainSecretForExport(userId, sseEncryptedSecret) {
    if (!sseEncryptedSecret) return null;
    try {
      const plain = await decryptField(sseEncryptedSecret, this.encryptionKey);
      if (!plain) return null;
      if (plain.startsWith("nodeauth:")) {
        const salt = await generateDeviceKey(userId, this.env.JWT_SECRET || "");
        const maskingKey = await deriveMaskingKey(salt);
        return await unmaskSecret(plain, maskingKey);
      }
      return plain;
    } catch (e) {
      return null;
    }
  }
  /**
   * 处理导出
   */
  async exportAccounts(userId, type, password) {
    const SECURITY_CONFIG2 = { MIN_EXPORT_PASSWORD_LENGTH: 5 };
    if (!["encrypted", "json", "2fas", "text"].includes(type)) {
      throw new AppError("export_type_invalid", 400);
    }
    if (type === "encrypted") {
      if (!password || password.length < SECURITY_CONFIG2.MIN_EXPORT_PASSWORD_LENGTH) {
        throw new AppError("export_password_length", 400);
      }
    }
    const rawItems = await this.getAllAccounts();
    const plainItems = await Promise.all(rawItems.map(async (item) => {
      const { createdBy: _c, updatedBy: _u, ...rest } = item;
      return {
        ...rest,
        secret: await this.plainSecretForExport(userId, item.secret)
      };
    }));
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const baseData = { version: "2.0", app: "nodeauth", timestamp };
    if (type === "encrypted") {
      const exportData = { ...baseData, encrypted: true, accounts: plainItems };
      const encryptedContent = await encryptData(exportData, password);
      return {
        data: { ...baseData, encrypted: true, data: encryptedContent, note: "This file is encrypted with your export password. Keep it safe!" },
        isText: false
      };
    } else if (type === "json") {
      return { data: { ...baseData, encrypted: false, accounts: plainItems }, isText: false };
    } else if (type === "2fas") {
      const services = plainItems.map((acc) => ({
        name: acc.service,
        secret: acc.secret,
        otp: {
          tokenType: "TOTP",
          issuer: acc.service,
          account: acc.account,
          digits: acc.digits,
          period: acc.period,
          algorithm: (acc.algorithm || "SHA1").replace("SHA-", "SHA"),
          counter: 0
        },
        order: { position: 0 }
      }));
      return { data: { schemaVersion: 4, appOrigin: "export", services }, isText: false };
    } else if (type === "text") {
      const lines = plainItems.map((acc) => {
        return buildOTPAuthURI({
          service: acc.service,
          account: acc.account,
          secret: acc.secret ?? "",
          algorithm: acc.algorithm ?? void 0,
          digits: acc.digits ?? void 0,
          period: acc.period ?? void 0
        });
      });
      return { data: lines.join("\n"), isText: true };
    }
    throw new AppError("export_type_invalid", 500);
  }
  /**
   * 处理导入
   */
  async importAccounts(userId, type, content, password) {
    if (!content || !type) throw new AppError("missing_content_type", 400);
    if (type === "encrypted" && !password) {
      throw new AppError("import_password_required", 400);
    }
    let rawAccounts = [];
    try {
      if (type === "encrypted") {
        const encryptedFile = JSON.parse(content);
        const decryptedData = await decryptData(encryptedFile.data, password);
        rawAccounts = decryptedData.accounts || [];
      } else if (type === "json") {
        const data = JSON.parse(content);
        if (data.accounts) {
          rawAccounts = data.accounts;
        } else if (Array.isArray(data.secrets)) {
          rawAccounts = data.secrets.map((item) => ({
            service: item.issuer || item.service || item.name || "Unknown",
            account: item.account || item.label || "",
            secret: item.secret,
            algorithm: item.algorithm || "SHA1",
            digits: item.digits || 6,
            period: item.period || 30
          }));
        } else if (data.app && data.app.includes("nodeauth") && Array.isArray(data.data)) {
          rawAccounts = data.data;
        } else if (Array.isArray(data)) {
          rawAccounts = data;
        } else if (data.services) {
          rawAccounts = data.services.map((s) => ({
            service: s.otp?.issuer || s.name || s.service,
            account: s.otp?.account || s.account || "",
            secret: s.secret,
            algorithm: s.otp?.algorithm || s.algorithm || "SHA1",
            digits: s.otp?.digits || s.digits || 6,
            period: s.otp?.period || s.period || 30
          }));
        }
      } else if (type === "2fas") {
        const data = JSON.parse(content);
        if (Array.isArray(data.services)) {
          rawAccounts = data.services.map((s) => ({
            service: s.otp?.issuer || s.name || s.otp?.issuer || "Unknown",
            account: s.otp?.account || s.account || s.username || "",
            secret: s.secret || "",
            algorithm: (s.otp?.algorithm || s.algorithm || "SHA1").toUpperCase(),
            digits: s.otp?.digits || s.digits || 6,
            period: s.otp?.period || s.period || 30,
            category: s.group || s.category || ""
          }));
        }
      } else if (type === "text") {
        const lines = content.split("\n").filter((line) => line.trim());
        for (const line of lines) {
          if (line.trim().startsWith("otpauth://")) {
            const parsed = parseOTPAuthURI(line.trim());
            if (parsed) rawAccounts.push({
              service: parsed.issuer,
              account: parsed.account,
              secret: parsed.secret,
              algorithm: parsed.algorithm,
              digits: parsed.digits,
              period: parsed.period,
              type: parsed.type,
              counter: parsed.counter
            });
          }
        }
      } else if (type === "raw") {
        rawAccounts = JSON.parse(content);
      }
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError("parse_failed", 400);
    }
    const allItems = await this.repository.findAllIncludeDeleted();
    const existingMap = new Map(
      allItems.map((row) => [this.normalizeSignature(row.service, row.account), row])
    );
    const uniqueAccountsToInsert = [];
    const accountsToRevive = [];
    const seenInBatch = /* @__PURE__ */ new Set();
    let validCount = 0;
    let duplicateCount = 0;
    for (const raw of rawAccounts) {
      const acc = normalizeOtpAccount(raw);
      const { service, account, secret, type: type2 } = acc;
      const isValidSecret = type2 === "steam" ? !!secret : validateBase32Secret(secret);
      if (service && account && isValidSecret) {
        const signature = this.normalizeSignature(service, account);
        if (seenInBatch.has(signature)) continue;
        seenInBatch.add(signature);
        validCount++;
        const existingItem = existingMap.get(signature);
        if (!existingItem) {
          uniqueAccountsToInsert.push(acc);
        } else if (existingItem.deletedAt !== null) {
          accountsToRevive.push({ ...acc, id: existingItem.id });
        } else {
          duplicateCount++;
        }
      }
    }
    let totalProcessedCount = 0;
    if (uniqueAccountsToInsert.length > 0) {
      const startSort = await this.repository.getMaxSortOrder();
      const count2 = await batchInsertVaultItems(this.env.DB, uniqueAccountsToInsert, this.encryptionKey, userId, startSort);
      totalProcessedCount += count2;
    }
    if (accountsToRevive.length > 0) {
      const startSortForRevive = await this.repository.getMaxSortOrder();
      const preparedRevives = await Promise.all(accountsToRevive.map(async (acc, idx) => {
        const secretEncrypted = await encryptField(acc.secret, this.encryptionKey);
        return {
          id: acc.id,
          data: {
            category: acc.category || "",
            secret: secretEncrypted,
            algorithm: acc.algorithm,
            type: acc.type,
            digits: acc.digits,
            period: acc.period,
            counter: acc.counter,
            sortOrder: startSortForRevive + (accountsToRevive.length - idx),
            deletedAt: null,
            // 👈 显式复活标记
            updatedBy: userId
          }
        };
      }));
      await this.repository.batchUpdate(preparedRevives);
      totalProcessedCount += accountsToRevive.length;
    }
    return {
      count: totalProcessedCount,
      duplicates: duplicateCount,
      pending: false
    };
  }
  /**
   * Blizzard/battle.net 账号还原
   * 利用现代 OAuth SSO 流程从暴雪 API 获取底层密钥
   */
  async restoreBlizzardNetAccount(serial2, restoreCode, ssoToken) {
    if (!serial2 || !serial2.trim()) throw new AppError("blizzard_serial_required", 400);
    if (!restoreCode || !restoreCode.trim()) throw new AppError("blizzard_restore_code_required", 400);
    if (!ssoToken || !ssoToken.trim()) throw new AppError("blizzard_sso_token_required", 400);
    const normalizedSerial = serial2.replace(/-/g, "").toUpperCase();
    const normalizedCode = restoreCode.toUpperCase().replace(/\s/g, "");
    try {
      const commonHeaders = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      };
      console.log("[BlizzardRestore] Exchanging ST for AccessToken...");
      const tokenRes = await fetch("https://oauth.battle.net/oauth/sso", {
        method: "POST",
        headers: {
          ...commonHeaders,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: "baedda12fe054e4abdfc3ad7bdea970a",
          grant_type: "client_sso",
          scope: "auth.authenticator",
          token: ssoToken.trim()
        }).toString()
      });
      if (!tokenRes.ok) {
        const errData = await tokenRes.text().catch(() => "{}");
        console.error("[BlizzardRestore] OAuth failed:", tokenRes.status, errData);
        throw new AppError(`blizzard_oauth_failed: ${tokenRes.status}`, 401);
      }
      const { access_token: accessToken } = await tokenRes.json();
      console.log("[BlizzardRestore] Requesting device secret...");
      const restoreRes = await fetch("https://authenticator-rest-api.bnet-identity.blizzard.net/v1/authenticator/device", {
        method: "POST",
        headers: {
          ...commonHeaders,
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          serial: normalizedSerial,
          restoreCode: normalizedCode
        })
      });
      if (!restoreRes.ok) {
        const errText = await restoreRes.text().catch(() => "unknown");
        console.error("[BlizzardRestore] Device API failed:", restoreRes.status, errText);
        throw new AppError(`blizzard_restore_failed: ${restoreRes.status}`, 400);
      }
      const { deviceSecret } = await restoreRes.json();
      if (!deviceSecret) throw new AppError("invalid_restore_response", 500);
      return bytesToBase32(new Uint8Array(Buffer3.from(deviceSecret, "hex")));
    } catch (err) {
      if (err instanceof AppError) throw err;
      console.error("[BlizzardRestore] Unexpected flow error:", err.message || err);
      throw new AppError(`blizzard_service_error: ${err.message || "unknown"}`, 502);
    }
  }
  /**
   * 批量同步离线操作 (Sync Mode)
   */
  async batchSync(userId, actions) {
    const results = [];
    for (const action of actions) {
      const { type, id, data } = action;
      try {
        let res;
        switch (type) {
          case "create":
            try {
              res = await this.createAccount(userId, data);
              results.push({ success: true, type, id: action.id, serverId: res.id });
            } catch (e) {
              if (e instanceof AppError && e.statusCode === 409) {
                const existing = await this.repository.findByServiceAccountAny(data.service, data.account);
                if (existing) {
                  results.push({ success: true, type, id: action.id, serverId: existing.id });
                } else {
                  throw e;
                }
              } else {
                throw e;
              }
            }
            break;
          case "update":
            try {
              await this.updateAccount(userId, id, data);
            } catch (e) {
              if (e.statusCode === 409) {
                const existing = await this.repository.findById(id);
                if (existing) {
                  const sigServer = this.normalizeSignature(existing.service, existing.account);
                  const sigClient = this.normalizeSignature(data.service, data.account);
                  const categoryServer = existing.category || "";
                  const categoryClient = data.category || "";
                  if (sigServer === sigClient && categoryServer === categoryClient) {
                  } else {
                    throw e;
                  }
                } else {
                  throw e;
                }
              } else {
                throw e;
              }
            }
            results.push({ success: true, type, id });
            break;
          case "delete":
            try {
              await this.deleteAccount(id, data?.updatedAt, !!data?.force);
            } catch (e) {
              if (e instanceof AppError && e.statusCode === 404) {
              } else {
                throw e;
              }
            }
            results.push({ success: true, type, id });
            break;
          case "reorder":
            if (data && Array.isArray(data.ids)) {
              await this.reorderAccounts(data.ids);
            }
            results.push({ success: true, type, id });
            break;
          default:
            results.push({ success: false, type, id, error: "unknown_action" });
        }
      } catch (e) {
        const errorCode = e.statusCode === 409 ? "conflict_detected" : e.code || "sync_error";
        results.push({
          success: false,
          type,
          id,
          error: e.message,
          code: errorCode
        });
      }
    }
    return results;
  }
};

// ../src/features/vault/trashService.ts
init_config();
var TrashService = class {
  repository;
  env;
  encryptionKey;
  constructor(env, repository) {
    this.env = env;
    this.repository = repository;
    this.encryptionKey = env?.ENCRYPTION_KEY || "";
  }
  /**
   * TRASH: 1.1 精准软瘫痪 - 将账号移入回收站
   */
  async moveToTrash(id) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new AppError("Item not found", 404);
    if (existing.deletedAt !== null) {
      return { success: true };
    }
    await this.repository.update(id, { deletedAt: Date.now() });
    return { success: true };
  }
  /**
   * TRASH: 1.4 回收站独立拉取
   */
  async getTrashList() {
    const items = await this.repository.findDeleted();
    return Promise.all(items.map(async (item) => ({
      ...item,
      secret: this.encryptionKey ? await decryptField(item.secret, this.encryptionKey) || "" : ""
    })));
  }
  /**
   * TRASH: 1.6 & 1.7 强制沉淀置顶恢复 (Restore Strategy B)
   */
  async restoreItem(id) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new AppError("Item not found", 404);
    if (existing.deletedAt === null) {
      return { success: true };
    }
    const maxSortOrder = await this.repository.getMaxSortOrder();
    const SAFE_MAX = Number.MAX_SAFE_INTEGER - 2e3;
    let nextSortOrder = maxSortOrder + 1e3;
    if (nextSortOrder > SAFE_MAX) {
      nextSortOrder = SAFE_MAX;
    }
    await this.repository.update(id, {
      deletedAt: null,
      sortOrder: nextSortOrder
    });
    return { success: true };
  }
  /**
   * TRASH: 1.9 批量软删除
   */
  async batchMoveToTrash(ids) {
    if (!ids || ids.length === 0) return { count: 0 };
    const count2 = await this.repository.batchSoftDelete(ids, Date.now());
    return { success: true, count: count2 };
  }
  /**
   * TRASH: 1.10 越权防御与物理硬删除
   */
  async hardDelete(id) {
    const res = await this.repository.delete(id);
    if (!res) throw new AppError("Item not found", 404);
    return { success: true };
  }
  /**
   * TRASH: 1.11 一键清空回收站
   */
  async emptyTrash() {
    const deletedCount = await this.repository.emptyTrashPhysical();
    return { success: true, deletedCount };
  }
  /**
   * TRASH: 2.6 时钟窜改防卫
   */
  async validateAndDelete(id, clientTimestamp) {
    const now = Date.now();
    let deletedAt = clientTimestamp;
    if (clientTimestamp < 0 || clientTimestamp > now + 3e5) {
      deletedAt = now;
    }
    await this.repository.update(id, { deletedAt });
    return { success: true };
  }
};

// ../src/shared/db/repositories/vaultRepository.ts
import { and as and2, desc as desc2, eq as eq5, inArray as inArray2, isNull, like, or, sql } from "drizzle-orm";
var VaultRepository = class {
  db;
  constructor(dbClient) {
    this.db = dbClient;
  }
  getOwnerCandidates(ownerId, ownerAliases = []) {
    return Array.from(new Set([ownerId, ...ownerAliases].filter((value) => typeof value === "string" && value.trim() !== "").map((value) => value.trim())));
  }
  /**
   * 获取所有的 vault items (仅查未删除)
   */
  async findAll() {
    return await this.db.select().from(vault4).where(isNull(vault4.deletedAt)).orderBy(desc2(vault4.sortOrder), desc2(vault4.createdAt));
  }
  /**
   * 获取所有的 vault items (包含软删除/回收站数据)
   * 专用于去重检查场景，防止将回收站账号重新导入
   */
  async findAllIncludeDeleted() {
    return await this.db.select().from(vault4).orderBy(desc2(vault4.sortOrder), desc2(vault4.createdAt));
  }
  /**
   * 获取当前最大排序值
   */
  async getMaxSortOrder() {
    const result = await this.db.select({ maxSort: sql`max(${vault4.sortOrder})` }).from(vault4).where(isNull(vault4.deletedAt));
    return result[0]?.maxSort || 0;
  }
  /**
   * 分页查询
   */
  async findPaginated(page, limit, search = "", category = "") {
    let query = this.db.select().from(vault4);
    const conditions = [];
    if (search) {
      conditions.push(or(
        like(vault4.service, `%${search}%`),
        like(vault4.account, `%${search}%`),
        like(vault4.category, `%${search}%`)
      ));
    }
    if (category) {
      if (category === "____UNCATEGORIZED____") {
        conditions.push(or(eq5(vault4.category, ""), isNull(vault4.category)));
      } else {
        conditions.push(eq5(vault4.category, category));
      }
    }
    conditions.push(isNull(vault4.deletedAt));
    if (conditions.length > 0) {
      query = query.where(and2(...conditions));
    }
    return await query.limit(limit).offset((page - 1) * limit).orderBy(desc2(vault4.sortOrder), desc2(vault4.createdAt));
  }
  /**
   * 获取分类统计
   */
  async getCategoryStats() {
    return await this.db.select({
      category: vault4.category,
      count: sql`count(*)`
    }).from(vault4).where(isNull(vault4.deletedAt)).groupBy(vault4.category);
  }
  /**
   * 批量更新排序 (高性能版 - CASE WHEN 批量 SQL)
   *
   * 旧实现：N 次串行 UPDATE，每次一个 DB 往返 → 8474 条记录需要 30+ 秒
   * 新实现：每批 30 条合并为 1 条 CASE WHEN SQL → 减少频繁网络开销，同时规避上限 
   * 
   * 分批原因：虽然 SQLite 默认参数上限为 999 个，但 **Cloudflare D1 硬性限制每条执行语句最多只能有 100 个绑定参数**！
   *   每条记录在此 CASE WHEN 结构中占用 3 个参数 (WHEN id / THEN sortOrder / WHERE IN id)
   *   33 乘以 3 = 99，所以安全分批大小最大为 33，此处使用 30 留有余量。
   */
  async updateSortOrders(updates) {
    if (!updates || updates.length === 0) return;
    const CHUNK_SIZE = 30;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);
      if (chunk.length === 1) {
        await this.db.update(vault4).set({ sortOrder: chunk[0].sortOrder }).where(eq5(vault4.id, chunk[0].id));
        continue;
      }
      const whenClauses = chunk.map((u) => sql`WHEN ${u.id} THEN ${u.sortOrder}`);
      const caseExpr = sql`CASE ${vault4.id} ${sql.join(whenClauses, sql` `)} ELSE ${vault4.sortOrder} END`;
      await this.db.update(vault4).set({ sortOrder: caseExpr }).where(inArray2(vault4.id, chunk.map((u) => u.id)));
    }
  }
  /**
   * 分数索引：仅更新单个账号的排序值
   * 配合前端分数索引算法，每次拖拽仅触发 1 次 DB UPDATE
   */
  async updateSingleSortOrder(id, sortOrder) {
    await this.db.update(vault4).set({ sortOrder }).where(eq5(vault4.id, id));
  }
  /**
   * 获取满足条件的总记录数，用于分页计算
   */
  async count(search, category = "") {
    let query = this.db.select({ count: sql`count(*)` }).from(vault4);
    const conditions = [];
    if (search) {
      conditions.push(or(
        like(vault4.service, `%${search}%`),
        like(vault4.account, `%${search}%`),
        like(vault4.category, `%${search}%`)
      ));
    }
    if (category) {
      if (category === "____UNCATEGORIZED____") {
        conditions.push(or(eq5(vault4.category, ""), isNull(vault4.category)));
      } else {
        conditions.push(eq5(vault4.category, category));
      }
    }
    conditions.push(isNull(vault4.deletedAt));
    if (conditions.length > 0) {
      query = query.where(and2(...conditions));
    }
    const result = await query;
    return result[0]?.count || 0;
  }
  /**
   * 根据 ID 获取单个 item
   */
  async findById(id) {
    const result = await this.db.select().from(vault4).where(eq5(vault4.id, id)).limit(1);
    return result[0];
  }
  /**
   * 获取 owner 可访问且未删除的单个 item
   */
  async findActiveByIdForOwner(id, ownerId, ownerAliases = []) {
    const ownerCandidates = this.getOwnerCandidates(ownerId, ownerAliases);
    const ownerCondition = ownerCandidates.length > 1 ? inArray2(vault4.createdBy, ownerCandidates) : eq5(vault4.createdBy, ownerId);
    const result = await this.db.select().from(vault4).where(
      and2(
        eq5(vault4.id, id),
        isNull(vault4.deletedAt),
        or(isNull(vault4.createdBy), ownerCondition)
      )
    ).limit(1);
    return result[0] || null;
  }
  /**
   * 根据 service/account 查找记录 (大小写不敏感，自动 trim)
   * 只匹配未被软删除的记录
   */
  async findByServiceAccount(service, account) {
    const normalizedService = service.trim().toLowerCase();
    const normalizedAccount = account.trim().toLowerCase();
    const result = await this.db.select().from(vault4).where(
      and2(
        sql`lower(${vault4.service}) = ${normalizedService}`,
        sql`lower(${vault4.account}) = ${normalizedAccount}`,
        isNull(vault4.deletedAt)
      )
    ).limit(1);
    return result[0];
  }
  /**
   * 根据 service/account 查找记录 (包含过回收站的软删除记录)
   * 专用于去重检查，防止添加回收站中尚存在的账号
   */
  async findByServiceAccountAny(service, account) {
    const normalizedService = service.trim().toLowerCase();
    const normalizedAccount = account.trim().toLowerCase();
    const result = await this.db.select().from(vault4).where(
      and2(
        sql`lower(${vault4.service}) = ${normalizedService}`,
        sql`lower(${vault4.account}) = ${normalizedAccount}`
        // 注意：此处故意不加 isNull(vault.deletedAt)，覆盖回收站内已删除的记录
      )
    ).limit(1);
    return result[0];
  }
  /**
   * 创建一个新 item
   */
  async create(item) {
    await this.db.insert(vault4).values(item);
    const result = await this.findById(item.id);
    return result;
  }
  /**
   * 批量创建
   */
  async batchCreate(items) {
    if (!items || items.length === 0) return;
    const BATCH_SIZE = 50;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      await this.db.insert(vault4).values(chunk);
    }
  }
  /**
   * 更新一个 item (支持乐观锁校验)
   */
  async update(id, data, expectedUpdatedAt) {
    const existing = await this.findById(id);
    if (!existing) return void 0;
    if (expectedUpdatedAt !== void 0 && existing.updatedAt !== expectedUpdatedAt) {
      return void 0;
    }
    await this.db.update(vault4).set({ ...data, updatedAt: Date.now() }).where(eq5(vault4.id, id));
    return await this.findById(id);
  }
  /**
   * 批量更新 (用于导入复活场景等)
   */
  async batchUpdate(updates) {
    if (!updates || updates.length === 0) return;
    if (this.db.batch) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const chunk = updates.slice(i, i + BATCH_SIZE);
        const stmts = chunk.map(
          (u) => this.db.update(vault4).set({ ...u.data, updatedAt: Date.now() }).where(eq5(vault4.id, u.id))
        );
        await this.db.batch(stmts);
      }
    } else {
      for (const u of updates) {
        await this.update(u.id, u.data);
      }
    }
  }
  /**
   * 删除单个 item (支持乐观锁校验)
   */
  async delete(id, expectedUpdatedAt) {
    const existing = await this.findById(id);
    if (!existing) return false;
    if (expectedUpdatedAt !== void 0 && existing.updatedAt !== expectedUpdatedAt) {
      return false;
    }
    await this.db.delete(vault4).where(eq5(vault4.id, id));
    return true;
  }
  /**
   * 批量删除
   */
  async batchDelete(ids) {
    if (!ids || ids.length === 0) return 0;
    let deletedCount = 0;
    const BATCH_SIZE = 50;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      await this.db.delete(vault4).where(inArray2(vault4.id, chunk));
      deletedCount += chunk.length;
    }
    return deletedCount;
  }
  /**
   * TRASH: 获取所有软删除账号
   */
  async findDeleted() {
    return await this.db.select().from(vault4).where(sql`${vault4.deletedAt} IS NOT NULL`).orderBy(desc2(vault4.deletedAt));
  }
  /**
   * TRASH: 批量软删除
   */
  async batchSoftDelete(ids, timestamp) {
    if (!ids || ids.length === 0) return 0;
    let count2 = 0;
    const BATCH = 50;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      await this.db.update(vault4).set({ deletedAt: timestamp, sortOrder: 0 }).where(inArray2(vault4.id, chunk));
      count2 += chunk.length;
    }
    return count2;
  }
  /**
   * TRASH: 清空回收站
   */
  async emptyTrashPhysical() {
    await this.db.delete(vault4).where(sql`${vault4.deletedAt} IS NOT NULL`);
    return 1;
  }
  /**
   * TRASH: 统计软删除的数量
   */
  async countDeleted() {
    const result = await this.db.select({ count: sql`count(*)` }).from(vault4).where(sql`${vault4.deletedAt} IS NOT NULL`);
    return result[0]?.count || 0;
  }
};

// ../src/features/vault/vaultRoutes.ts
init_otp();
var vault5 = new Hono2();
var getService2 = (c) => {
  const repo = new VaultRepository(c.env.DB);
  return new VaultService(c.env, repo);
};
var getTrashService = (c) => {
  const repo = new VaultRepository(c.env.DB);
  return new TrashService(c.env, repo);
};
vault5.use("/*", authMiddleware);
vault5.get("/", async (c) => {
  const page = parseInt(c.req.query("page") || "1", 10);
  const limit = parseInt(c.req.query("limit") || "12", 10);
  const search = c.req.query("search") || "";
  const category = c.req.query("category") || "";
  const user = c.get("user");
  const service = getService2(c);
  const result = await service.getAccountsPaginated(user.email || user.id, page, limit, search, category);
  return c.json({
    success: true,
    vault: result.items,
    categoryStats: result.categoryStats,
    trashCount: result.trashCount,
    pagination: {
      page,
      limit,
      totalItems: result.totalCount,
      totalPages: result.totalPages
    }
  });
});
vault5.post("/reorder", async (c) => {
  const { ids } = await c.req.json();
  if (!Array.isArray(ids)) {
    return c.json({ success: false, error: "ids must be an array" }, 400);
  }
  const service = getService2(c);
  await service.reorderAccounts(ids);
  return c.json({ success: true });
});
vault5.patch("/:id/sort-order", async (c) => {
  const id = c.req.param("id");
  const { sortOrder } = await c.req.json();
  if (typeof sortOrder !== "number") {
    return c.json({ success: false, error: "sortOrder must be a number" }, 400);
  }
  const service = getService2(c);
  await service.moveSingleItem(id, sortOrder);
  return c.json({ success: true });
});
vault5.get("/trash", async (c) => {
  const trashService = getTrashService(c);
  const vault6 = await trashService.getTrashList();
  return c.json({ success: true, vault: vault6 });
});
vault5.post("/:id/trash_move", async (c) => {
  const id = c.req.param("id");
  const trashService = getTrashService(c);
  const result = await trashService.moveToTrash(id);
  return c.json(result);
});
vault5.post("/:id/trash_restore", async (c) => {
  const id = c.req.param("id");
  const trashService = getTrashService(c);
  const result = await trashService.restoreItem(id);
  return c.json(result);
});
vault5.post("/trash_batch_move", async (c) => {
  const { ids } = await c.req.json();
  const trashService = getTrashService(c);
  const result = await trashService.batchMoveToTrash(ids || []);
  return c.json(result);
});
vault5.delete("/:id/trash_hard", async (c) => {
  const id = c.req.param("id");
  const trashService = getTrashService(c);
  const result = await trashService.hardDelete(id);
  return c.json(result);
});
vault5.delete("/trash_empty", async (c) => {
  const trashService = getTrashService(c);
  const result = await trashService.emptyTrash();
  return c.json(result);
});
vault5.post("/", async (c) => {
  const user = c.get("user");
  const data = await c.req.json();
  const service = getService2(c);
  const item = await service.createAccount(user.email || user.id, data);
  return c.json({ success: true, item });
});
vault5.put("/:id", async (c) => {
  const id = c.req.param("id");
  const data = await c.req.json();
  const user = c.get("user");
  const service = getService2(c);
  const item = await service.updateAccount(user.email || user.id, id, data);
  return c.json({ success: true, item });
});
vault5.delete("/:id", async (c) => {
  const id = c.req.param("id");
  const service = getService2(c);
  await service.deleteAccount(id);
  return c.json({ success: true, message: "Deleted successfully" });
});
vault5.patch("/:id/increment", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const service = getService2(c);
  try {
    const result = await service.incrementCounter(id, body.updatedAt);
    return c.json({ success: true, ...result });
  } catch (e) {
    return c.json({ success: false, error: e.message }, e.statusCode || 500);
  }
});
vault5.post("/batch-delete", async (c) => {
  const { ids } = await c.req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return c.json({ success: false, error: "ids must be a non-empty array" }, 400);
  }
  const service = getService2(c);
  const result = await service.batchDeleteAccounts(ids);
  return c.json({ success: true, count: result.count });
});
vault5.post("/export", rateLimit({
  windowMs: 60 * 1e3,
  max: 5
}), async (c) => {
  const user = c.get("user");
  const service = getService2(c);
  const { type, password } = await c.req.json();
  const result = await service.exportAccounts(user.email || user.id, type, password);
  if (result.isText) {
    return c.text(result.data);
  }
  return c.json(result.data);
});
vault5.post("/import", rateLimit({
  windowMs: 60 * 1e3,
  max: 5
}), async (c) => {
  const user = c.get("user");
  const service = getService2(c);
  const { content, type, password } = await c.req.json();
  const result = await service.importAccounts(user.email || user.id, type, content, password);
  return c.json({ success: true, ...result });
});
vault5.post("/import/blizzard-net", rateLimit({
  windowMs: 60 * 1e3,
  max: 5
}), async (c) => {
  const { serial: serial2, restoreCode, ssoToken } = await c.req.json();
  if (!serial2 || !restoreCode) {
    return c.json({ success: false, error: "serial_and_restore_code_required" }, 400);
  }
  const service = getService2(c);
  try {
    const secret = await service.restoreBlizzardNetAccount(serial2, restoreCode, ssoToken);
    return c.json({ success: true, secret });
  } catch (e) {
    return c.json({ success: false, error: e.message }, e.statusCode || 500);
  }
});
vault5.post("/add-from-uri", async (c) => {
  const user = c.get("user");
  const { uri, category } = await c.req.json();
  if (!uri || typeof uri !== "string") {
    return c.json({ success: false, error: "URI is required" }, 400);
  }
  const parsed = parseOTPAuthURI(uri);
  if (!parsed) {
    return c.json({ success: false, error: "\u65E0\u6548\u7684 OTP URI \u683C\u5F0F" }, 400);
  }
  const service = getService2(c);
  const item = await service.createAccount(user.email || user.id, {
    service: parsed.issuer,
    account: parsed.account,
    secret: parsed.secret,
    algorithm: parsed.algorithm,
    digits: parsed.digits,
    period: parsed.period,
    type: parsed.type,
    counter: parsed.counter,
    category: category || "\u624B\u673A\u626B\u7801"
  });
  return c.json({ success: true, item });
});
vault5.post("/sync", async (c) => {
  const user = c.get("user");
  const { actions } = await c.req.json();
  if (!Array.isArray(actions)) {
    return c.json({ success: false, error: "actions must be an array" }, 400);
  }
  const service = getService2(c);
  const results = await service.batchSync(user.email || user.id, actions);
  return c.json({ success: true, results });
});
vault5.post("/migrate-crypto", async (c) => {
  return c.json({ success: true, message: "\u4E0D\u518D\u652F\u6301\u65E7\u7248\u76D0\u503C\u8FC1\u79FB\u903B\u8F91\uFF0C\u6240\u6709\u6570\u636E\u9ED8\u8BA4\u5DF2\u4F7F\u7528\u65B0\u7248\u903B\u8F91", migrated: 0, remaining: 0 });
});
var vaultRoutes_default = vault5;

// ../src/features/backup/backupRoutes.ts
import { Hono as Hono3 } from "hono";

// ../src/features/backup/backupService.ts
init_config();
import { eq as eq9, desc as desc6 } from "drizzle-orm";

// ../src/shared/db/repositories/backupRepository.ts
import { eq as eq6, desc as desc3 } from "drizzle-orm";
var BackupRepository = class {
  db;
  constructor(dbClient) {
    this.db = dbClient;
  }
  /**
   * 获取所有启用的备份提供商配置 (按名称排序)
   */
  async findAllSettings() {
    return await this.db.select().from(backupProviders4).orderBy(desc3(backupProviders4.updatedAt));
  }
  /**
   * 根据提供商类型获取配置
   */
  async findByType(type) {
    const result = await this.db.select().from(backupProviders4).where(eq6(backupProviders4.type, type)).limit(1);
    return result[0];
  }
  /**
   * 保存或更新某个提供商的配置
   */
  async upsert(type, data) {
    const existing = await this.findByType(type);
    if (existing) {
      await this.db.update(backupProviders4).set({ ...data, updatedAt: Date.now() }).where(eq6(backupProviders4.type, type));
      const result = await this.findByType(type);
      return result;
    } else {
      const insertData = {
        type,
        name: data.name || type.toUpperCase(),
        config: data.config || "{}",
        isEnabled: data.isEnabled ?? true,
        autoBackup: data.autoBackup ?? false,
        autoBackupPassword: data.autoBackupPassword || null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.db.insert(backupProviders4).values(insertData);
      const result = await this.findByType(type);
      return result;
    }
  }
};

// ../src/features/backup/backupService.ts
init_crypto();

// ../src/features/backup/providers/webDavProvider.ts
import { createClient } from "webdav";
var WebDavProvider = class {
  client;
  saveDir;
  config;
  constructor(config) {
    if (!config.url || !config.username || !config.password) {
      throw new Error("webdav_config_incomplete");
    }
    this.config = config;
    this.client = createClient(config.url, {
      username: config.username,
      password: config.password
    });
    let dir = (config.saveDir || "/").trim();
    if (!dir.startsWith("/")) dir = "/" + dir;
    if (dir.length > 1 && dir.endsWith("/")) dir = dir.slice(0, -1);
    this.saveDir = dir;
  }
  async testConnection() {
    await this.client.getDirectoryContents("/");
    return true;
  }
  async listBackups() {
    const items = await this.client.getDirectoryContents(this.saveDir);
    return items.filter((item) => item.type === "file" && item.basename.startsWith("nodeauth-backup-") && item.basename.endsWith(".json")).map((item) => {
      let displayTime = item.lastmod;
      return {
        filename: item.basename,
        path: item.filename,
        // 返回 WebDAV 服务器提供的绝对路径
        size: item.size,
        lastModified: displayTime
      };
    }).sort((a, b) => b.filename.localeCompare(a.filename));
  }
  getAuthHeader() {
    const str = `${this.config.username}:${this.config.password}`;
    try {
      return "Basic " + btoa(unescape(encodeURIComponent(str)));
    } catch {
      return "Basic " + btoa(str);
    }
  }
  getRequestUrl(path) {
    let baseUrl = this.config.url.trim();
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    let cleanPath = path.replace(/\/+/g, "/");
    if (!cleanPath.startsWith("/")) cleanPath = "/" + cleanPath;
    const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
    const cleanUrl = new URL(baseUrl + encodedPath);
    cleanUrl.username = "";
    cleanUrl.password = "";
    return cleanUrl.toString();
  }
  async uploadBackup(filename, data) {
    const fullPath = this.saveDir === "/" ? `/${filename}` : `${this.saveDir}/${filename}`;
    const bufferData = new TextEncoder().encode(data).buffer;
    try {
      if (this.saveDir !== "/") {
        const dirExists = await this.client.exists(this.saveDir);
        if (!dirExists) {
          await this.client.createDirectory(this.saveDir);
        }
      }
      await this.client.putFileContents(fullPath, bufferData);
    } catch (e) {
      console.error("[WebDAV Fallback] Original upload failed:", e.message);
      if (this.saveDir !== "/") {
        const dirUrl = this.getRequestUrl(this.saveDir);
        await fetch(dirUrl, { method: "MKCOL", headers: { "Authorization": this.getAuthHeader() } }).catch(() => {
        });
      }
      const fileUrl = this.getRequestUrl(fullPath);
      const res = await fetch(fileUrl, {
        method: "PUT",
        body: bufferData,
        headers: {
          "Authorization": this.getAuthHeader(),
          "Content-Type": "application/json",
          "Content-Length": bufferData.byteLength.toString()
          // 依然显式声明长度确保稳妥
        }
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`webdav_upload_failed: ${res.status} ${res.statusText} ${errText}`);
      }
    }
  }
  async downloadBackup(filename) {
    const cleanFilename = filename.trim().replace(/^\/+/, "");
    const fullPath = this.saveDir === "/" ? `/${cleanFilename}` : `${this.saveDir}/${cleanFilename}`;
    try {
      const content = await this.client.getFileContents(fullPath, { format: "text" });
      return content;
    } catch (e) {
      console.error("[WebDAV Fallback] Original download failed:", e.message);
      const fileUrl = this.getRequestUrl(fullPath);
      const res = await fetch(fileUrl, {
        headers: { "Authorization": this.getAuthHeader() },
        redirect: "manual"
      });
      if (res.status >= 300 && res.status < 400) {
        const redirectUrl = res.headers.get("location");
        if (redirectUrl) {
          const finalRes = await fetch(redirectUrl);
          if (!finalRes.ok) throw new Error(`webdav_download_redirect_failed: ${finalRes.status}`);
          return await finalRes.text();
        }
      } else if (!res.ok) {
        throw new Error(`webdav_download_failed: ${res.status} ${res.statusText}`);
      }
      return await res.text();
    }
  }
  async deleteBackup(filename) {
    const cleanFilename = filename.trim().replace(/^\/+/, "");
    const fullPath = this.saveDir === "/" ? `/${cleanFilename}` : `${this.saveDir}/${cleanFilename}`;
    try {
      await this.client.deleteFile(fullPath);
    } catch (e) {
      console.error("[WebDAV Fallback] Original delete failed:", e.message);
      const fileUrl = this.getRequestUrl(fullPath);
      const res = await fetch(fileUrl, {
        method: "DELETE",
        headers: { "Authorization": this.getAuthHeader() }
      });
      if (!res.ok) throw new Error(`webdav_delete_failed: ${res.status} ${res.statusText}`);
    }
  }
};

// ../src/features/backup/providers/s3Provider.ts
import { AwsClient } from "aws4fetch";
import { XMLParser } from "fast-xml-parser";
var S3Provider = class {
  client;
  bucket;
  endpoint;
  prefix;
  parser;
  constructor(config) {
    if (!config.endpoint || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
      throw new Error("s3_config_incomplete");
    }
    this.client = new AwsClient({
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      region: config.region || "auto",
      service: "s3"
    });
    this.bucket = config.bucket;
    this.endpoint = config.endpoint.replace(/\/+$/, "");
    this.prefix = (config.saveDir || "").trim();
    if (this.prefix.startsWith("/")) this.prefix = this.prefix.slice(1);
    if (this.prefix.length > 0 && !this.prefix.endsWith("/")) this.prefix += "/";
    this.parser = new XMLParser({
      ignoreAttributes: true,
      removeNSPrefix: true,
      trimValues: true
    });
  }
  // 构造 Path-Style URL: endpoint/bucket/key
  // 这种方式兼容性最好 (支持 R2, MinIO 等)
  getUrl(key = "", params = {}) {
    const url = new URL(`${this.endpoint}/${this.bucket}/${key}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
    return url.toString();
  }
  async testConnection() {
    const url = this.getUrl("", { "list-type": "2", "max-keys": "1" });
    const res = await this.client.fetch(url);
    if (!res.ok) {
      throw new Error(`s3_api_error: ${res.status} ${res.statusText}`);
    }
    return true;
  }
  async listBackups() {
    const url = this.getUrl("", { "list-type": "2", "prefix": this.prefix });
    const res = await this.client.fetch(url);
    if (!res.ok) throw new Error(`s3_list_failed: ${res.status}`);
    const text3 = await res.text();
    const result = this.parser.parse(text3);
    const contents = result.ListBucketResult?.Contents;
    if (!contents) return [];
    const items = Array.isArray(contents) ? contents : [contents];
    const backups2 = [];
    for (const item of items) {
      const fullKey = item.Key?.toString();
      const size = parseInt(item.Size, 10);
      const lastModified = item.LastModified?.toString();
      if (!fullKey) continue;
      const filename = fullKey.replace(this.prefix, "");
      if (filename.startsWith("nodeauth-backup-") && filename.endsWith(".json")) {
        backups2.push({
          filename,
          size,
          lastModified: lastModified || ""
        });
      }
    }
    return backups2.sort((a, b) => b.filename.localeCompare(a.filename));
  }
  async uploadBackup(filename, data) {
    const key = this.prefix + filename;
    const url = this.getUrl(key);
    const res = await this.client.fetch(url, {
      method: "PUT",
      body: data,
      headers: { "Content-Type": "application/json" }
    });
    if (!res.ok) throw new Error(`s3_upload_failed: ${res.status}`);
  }
  async downloadBackup(filename) {
    const key = this.prefix + filename;
    const url = this.getUrl(key);
    const res = await this.client.fetch(url);
    if (!res.ok) throw new Error(`s3_download_failed: ${res.status}`);
    return await res.text();
  }
  async deleteBackup(filename) {
    const key = this.prefix + filename;
    const url = this.getUrl(key);
    const res = await this.client.fetch(url, {
      method: "DELETE"
    });
    if (!res.ok) throw new Error(`s3_delete_failed: ${res.status}`);
  }
};

// ../src/features/backup/providers/telegramProvider.ts
import { eq as eq7, desc as desc4, and as and3 } from "drizzle-orm";
var TelegramProvider2 = class {
  botToken;
  chatId;
  db;
  providerId;
  constructor(config, db, providerId) {
    if (!config.botToken || !config.chatId) {
      throw new Error("telegram_config_incomplete");
    }
    this.botToken = config.botToken;
    this.chatId = config.chatId;
    this.db = db;
    this.providerId = providerId;
  }
  getApiUrl(method) {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }
  async testConnection() {
    const sendUrl = this.getApiUrl("sendMessage");
    try {
      const sendRes = await fetch(sendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: "\u{1F517} NodeAuth Backup Connected / \u5907\u4EFD\u6E90\u8FDE\u63A5\u6210\u529F",
          disable_notification: true
        })
      });
      if (!sendRes.ok) {
        const errResult = await sendRes.json();
        throw new Error(`telegram_api_error: ${errResult.description}`);
      }
      const sendResult = await sendRes.json();
      const messageId = sendResult.result.message_id;
      const deleteUrl = this.getApiUrl("deleteMessage");
      await fetch(deleteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          message_id: messageId
        })
      });
      return true;
    } catch (e) {
      throw e;
    }
  }
  async listBackups() {
    if (!this.db || !this.providerId) {
      throw new Error("telegram_db_missing");
    }
    const histories = await this.db.select().from(backupTelegramHistory4).where(eq7(backupTelegramHistory4.providerId, this.providerId)).orderBy(desc4(backupTelegramHistory4.createdAt));
    return histories.map((h) => ({
      filename: h.filename,
      size: h.size,
      lastModified: new Date(h.createdAt).toISOString()
    }));
  }
  async uploadBackup(filename, data) {
    if (!this.db || !this.providerId) {
      throw new Error("telegram_db_missing");
    }
    const sendUrl = this.getApiUrl("sendDocument");
    const formData = new FormData();
    formData.append("chat_id", this.chatId);
    const blob = new Blob([data], { type: "application/json" });
    formData.append("document", blob, filename);
    const res = await fetch(sendUrl, {
      method: "POST",
      body: formData
    });
    if (!res.ok) {
      const errResult = await res.json();
      throw new Error(`telegram_upload_failed: ${errResult.description}`);
    }
    const result = await res.json();
    const document = result.result.document;
    const messageId = result.result.message_id;
    const fileId = document.file_id;
    const fileSize = document.file_size || data.length;
    await this.db.insert(backupTelegramHistory4).values({
      providerId: this.providerId,
      filename,
      fileId,
      messageId,
      size: fileSize,
      createdAt: Date.now()
    });
  }
  async downloadBackup(filename) {
    if (!this.db || !this.providerId) {
      throw new Error("telegram_db_missing");
    }
    const _fileRecord = await this.db.select().from(backupTelegramHistory4).where(and3(eq7(backupTelegramHistory4.providerId, this.providerId), eq7(backupTelegramHistory4.filename, filename))).limit(1);
    const fileRecord = _fileRecord[0];
    if (!fileRecord) {
      throw new Error("file_not_found_in_history");
    }
    const getFileUrl = this.getApiUrl("getFile") + `?file_id=${fileRecord.fileId}`;
    const fileInfoRes = await fetch(getFileUrl);
    if (!fileInfoRes.ok) {
      const errResult = await fileInfoRes.json();
      if (fileInfoRes.status === 400 && errResult.description && errResult.description.includes("file is unavailable")) {
        throw new Error("FILE_UNAVAILABLE");
      }
      throw new Error(`telegram_download_failed: ${errResult.description}`);
    }
    const fileInfo = await fileInfoRes.json();
    const filePath = fileInfo.result.file_path;
    if (!filePath) {
      throw new Error("telegram_file_path_missing");
    }
    const downloadUrl = `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
    const downloadRes = await fetch(downloadUrl);
    if (!downloadRes.ok) throw new Error(`telegram_download_failed: ${downloadRes.statusText}`);
    return await downloadRes.text();
  }
  async deleteBackup(filename) {
    if (!this.db || !this.providerId) {
      throw new Error("telegram_db_missing");
    }
    const _fileRecord = await this.db.select().from(backupTelegramHistory4).where(and3(eq7(backupTelegramHistory4.providerId, this.providerId), eq7(backupTelegramHistory4.filename, filename))).limit(1);
    const fileRecord = _fileRecord[0];
    if (!fileRecord) {
      return;
    }
    try {
      const deleteUrl = this.getApiUrl("deleteMessage");
      await fetch(deleteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: this.chatId,
          message_id: fileRecord.messageId
        })
      });
    } catch (e) {
      console.error(`Error deleting message from Telegram:`, e);
    }
    await this.db.delete(backupTelegramHistory4).where(eq7(backupTelegramHistory4.id, fileRecord.id));
  }
};

// ../src/features/backup/providers/googleDriveProvider.ts
init_config();
var GoogleDriveProvider = class {
  clientId;
  clientSecret;
  refreshToken;
  accessToken = null;
  folderId;
  saveDir;
  config;
  onConfigUpdate;
  constructor(config, env) {
    this.config = config;
    this.clientId = env.OAUTH_GOOGLE_CLIENT_ID;
    this.clientSecret = env.OAUTH_GOOGLE_CLIENT_SECRET;
    if (!config.refreshToken) {
      throw new Error("gdrive_token_missing");
    }
    this.refreshToken = config.refreshToken;
    this.folderId = config.folderId || null;
    this.saveDir = config.saveDir || "/nodeauth-backup";
  }
  async resolveFolderId() {
    if (this.folderId) return this.folderId;
    if (!this.saveDir || this.saveDir === "/" || this.saveDir === "") return null;
    const token = await this.getAccessToken();
    const parts = this.saveDir.split("/").filter((p) => p !== "");
    let currentParentId = null;
    for (const part of parts) {
      const query = `name = '${part}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false${currentParentId ? ` and '${currentParentId}' in parents` : " and 'root' in parents"}`;
      const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
      const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`gdrive_resolve_folder_failed: ${res.status}`);
      const data = await res.json();
      if (data.files && data.files.length > 0) {
        currentParentId = data.files[0].id;
      } else {
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: part,
            mimeType: "application/vnd.google-apps.folder",
            parents: currentParentId ? [currentParentId] : void 0
          })
        });
        if (!createRes.ok) throw new Error("gdrive_create_folder_failed");
        const newData = await createRes.json();
        currentParentId = newData.id;
      }
    }
    this.folderId = currentParentId;
    return this.folderId;
  }
  async getAccessToken() {
    if (this.accessToken) return this.accessToken;
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token"
      })
    });
    if (!res.ok) {
      const err = await res.json();
      const errorDesc = (err.error || err.error_description || "").toLowerCase();
      if (errorDesc.includes("invalid_grant") || errorDesc.includes("unauthorized") || res.status === 401) {
        throw new AppError("oauth_token_revoked", 401);
      }
      throw new Error(`gdrive_auth_failed: ${err.error_description || res.statusText}`);
    }
    const data = await res.json();
    this.accessToken = data.access_token;
    if (data.refresh_token && data.refresh_token !== this.refreshToken) {
      this.refreshToken = data.refresh_token;
      if (this.onConfigUpdate) {
        await this.onConfigUpdate({ ...this.config, refreshToken: this.refreshToken });
      }
    }
    return this.accessToken;
  }
  async testConnection() {
    await this.getAccessToken();
    await this.resolveFolderId();
    await this.listBackups();
    return true;
  }
  async listBackups() {
    const token = await this.getAccessToken();
    const fId = await this.resolveFolderId();
    let query = "name contains 'nodeauth-backup-' and trashed = false";
    if (fId) {
      query += ` and '${fId}' in parents`;
    } else {
      query += " and 'root' in parents";
    }
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime)&orderBy=name desc`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`gdrive_list_failed: ${res.status}`);
    const data = await res.json();
    return (data.files || []).map((f) => ({
      filename: f.name,
      size: parseInt(f.size || "0", 10),
      lastModified: f.modifiedTime
    }));
  }
  async uploadBackup(filename, data) {
    const token = await this.getAccessToken();
    const fId = await this.resolveFolderId();
    const metadata = {
      name: filename,
      parents: fId ? [fId] : void 0
    };
    const boundary = "-------nodeauth_worker_boundary";
    const delimiter = `\r
--${boundary}\r
`;
    const closeDelimiter = `\r
--${boundary}--`;
    const body = delimiter + "Content-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + delimiter + "Content-Type: application/json\r\n\r\n" + data + closeDelimiter;
    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`gdrive_upload_failed: ${err.error?.message || res.statusText}`);
    }
  }
  async downloadBackup(filename) {
    const token = await this.getAccessToken();
    const fileId = await this.getFileIdByName(filename);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`gdrive_download_failed: ${res.status}`);
    return await res.text();
  }
  async deleteBackup(filename) {
    const token = await this.getAccessToken();
    const fileId = await this.getFileIdByName(filename);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`gdrive_delete_failed: ${res.status}`);
  }
  async getFileIdByName(filename) {
    const token = await this.getAccessToken();
    let query = `name = '${filename}' and trashed = false`;
    if (this.folderId) {
      query += ` and '${this.folderId}' in parents`;
    }
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`gdrive_find_file_failed: ${res.status}`);
    const data = await res.json();
    if (!data.files || data.files.length === 0) throw new Error("file_not_found");
    return data.files[0].id;
  }
};

// ../src/features/backup/providers/oneDriveProvider.ts
init_config();
var OneDriveProvider = class {
  refreshToken;
  folderId = null;
  saveDir;
  env;
  config;
  accessToken = null;
  tokenExpiry = 0;
  constructor(config, env) {
    this.config = config;
    this.refreshToken = config.refreshToken;
    this.saveDir = config.saveDir || "/nodeauth-backup";
    this.env = env;
  }
  onConfigUpdate;
  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    const clientId = this.env.OAUTH_MICROSOFT_CLIENT_ID;
    const clientSecret = this.env.OAUTH_MICROSOFT_CLIENT_SECRET;
    if (!clientId) {
      throw new Error("OAUTH_MICROSOFT_CLIENT_ID is not configured");
    }
    const params = new URLSearchParams({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: this.refreshToken
    });
    if (clientSecret) {
      params.append("client_secret", clientSecret);
    }
    const res = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params
    });
    if (!res.ok) {
      const err = await res.json();
      const errorDesc = (err.error_description || err.error || "").toLowerCase();
      if (errorDesc.includes("invalid_grant") || errorDesc.includes("aadsts70000")) {
        throw new AppError("oauth_token_revoked", 401);
      }
      throw new Error(`Failed to refresh token: ${err.error_description || err.error}`);
    }
    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1e3 * 0.9;
    if (data.refresh_token && data.refresh_token !== this.refreshToken) {
      this.refreshToken = data.refresh_token;
      if (this.onConfigUpdate) {
        await this.onConfigUpdate({
          ...this.config,
          refreshToken: this.refreshToken
        });
      }
    }
    return this.accessToken;
  }
  normalizePath(path) {
    let p = path.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
    if (!p.startsWith("/")) p = "/" + p;
    if (p.endsWith("/") && p.length > 1) p = p.slice(0, -1);
    if (p === "/") return "";
    return ":" + p + ":";
  }
  async testConnection() {
    const token = await this.getAccessToken();
    let res = await fetch("https://graph.microsoft.com/v1.0/me/drive/special/approot", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      const err = await res.json();
      const errMsg = err.error?.message || res.statusText;
      if (errMsg.toLowerCase().includes("pending provisioning") || res.status === 404) {
        const fallbackRes = await fetch("https://graph.microsoft.com/v1.0/me", {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (!fallbackRes.ok) {
          const fallbackErr = await fallbackRes.json();
          throw new Error(`Connection test failed: ${fallbackErr.error?.message || fallbackRes.statusText}`);
        }
        return true;
      }
      throw new Error(`Connection test failed: ${errMsg}`);
    }
    return true;
  }
  async uploadBackup(filename, content) {
    const token = await this.getAccessToken();
    const normPath = this.normalizePath(`${this.saveDir}/${filename}`);
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot${normPath}/content`;
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: content
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Upload failed: ${err.error?.message || res.statusText}`);
    }
  }
  async downloadBackup(filename) {
    const token = await this.getAccessToken();
    const normPath = this.normalizePath(`${this.saveDir}/${filename}`);
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot${normPath}/content`;
    let res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` },
      redirect: "manual"
    });
    if (res.status >= 300 && res.status < 400) {
      const redirectUrl = res.headers.get("Location");
      if (redirectUrl) {
        res = await fetch(redirectUrl);
      }
    }
    if (!res.ok) {
      if (res.status === 404) throw new Error("File not found");
      let errMsg = res.statusText;
      try {
        const err = await res.clone().json();
        errMsg = err.error?.message || err.message || errMsg;
      } catch (e) {
        const errText = await res.text();
        errMsg = errText || errMsg;
      }
      throw new Error(`Download failed: ${errMsg}`);
    }
    return await res.text();
  }
  async listBackups() {
    const token = await this.getAccessToken();
    const normPath = this.normalizePath(this.saveDir);
    const urlEnd = normPath === "" ? "/children" : `${normPath}/children`;
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot${urlEnd}`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok) {
      if (res.status === 404) return [];
      const err = await res.json();
      throw new Error(`List failed: ${err.error?.message || res.statusText}`);
    }
    const data = await res.json();
    if (!data.value) return [];
    return data.value.filter((item) => item.file).map((item) => ({
      filename: item.name,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      id: item.id
    })).sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
  }
  async deleteBackup(filename) {
    const token = await this.getAccessToken();
    const normPath = this.normalizePath(`${this.saveDir}/${filename}`);
    const url = `https://graph.microsoft.com/v1.0/me/drive/special/approot${normPath}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    });
    if (!res.ok && res.status !== 404) {
      const err = await res.json();
      throw new Error(`Delete failed: ${err.error?.message || res.statusText}`);
    }
  }
};

// ../src/features/backup/providers/baiduNetdiskProvider.ts
init_config();
var BaiduNetdiskProvider = class {
  clientId;
  clientSecret;
  refreshToken;
  accessToken = null;
  tokenExpiry = 0;
  saveDir;
  env;
  config;
  onConfigUpdate;
  constructor(config, env) {
    this.config = config;
    this.clientId = env.OAUTH_BAIDU_CLIENT_ID || "";
    this.clientSecret = env.OAUTH_BAIDU_CLIENT_SECRET || "";
    this.refreshToken = config.refreshToken;
    this.saveDir = config.saveDir || "/apps/nodeauth-backup";
    this.env = env;
    if (!this.clientId) {
      throw new Error("OAUTH_BAIDU_CLIENT_ID is not configured");
    }
  }
  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }
    const params = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret
    });
    const res = await fetch(`https://openapi.baidu.com/oauth/2.0/token?${params.toString()}`, {
      method: "GET"
    });
    if (!res.ok) {
      const err = await res.json();
      const errorDesc = (err.error_description || err.error || "").toLowerCase();
      if (errorDesc.includes("invalid_grant") || res.status === 401) {
        throw new AppError("oauth_token_revoked", 401);
      }
      throw new Error(`Baidu Auth Failed: ${errorDesc || res.statusText}`);
    }
    const data = await res.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + data.expires_in * 1e3 * 0.9;
    if (data.refresh_token && data.refresh_token !== this.refreshToken) {
      this.refreshToken = data.refresh_token;
      if (this.onConfigUpdate) {
        await this.onConfigUpdate({ ...this.config, refreshToken: this.refreshToken });
      }
    }
    return this.accessToken;
  }
  async testConnection() {
    await this.getAccessToken();
    const token = await this.getAccessToken();
    const res = await fetch(`https://pan.baidu.com/rest/2.0/xpan/nas?method=uinfo&access_token=${token}`);
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`Connection test failed: ${err.errmsg || res.statusText}`);
    }
    return true;
  }
  async listBackups() {
    const token = await this.getAccessToken();
    const url = `https://pan.baidu.com/rest/2.0/xpan/file?method=list&dir=${encodeURIComponent(this.saveDir)}&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`List failed: ${res.statusText}`);
    }
    const data = await res.json();
    if (data.errno !== 0) {
      if (data.errno === -9) return [];
      throw new Error(`Baidu List Error: ${data.errno}`);
    }
    return (data.list || []).filter((item) => item.isdir === 0 && item.server_filename.startsWith("nodeauth-backup-")).map((item) => ({
      filename: item.server_filename,
      size: item.size,
      lastModified: new Date(item.server_mtime * 1e3).toISOString()
    })).sort((a, b) => b.filename.localeCompare(a.filename));
  }
  async calculateMD5(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    try {
      const hashBuffer = await crypto.subtle.digest("MD5", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) {
      return "0";
    }
  }
  async uploadBackup(filename, content) {
    const token = await this.getAccessToken();
    const path = `${this.saveDir}/${filename}`;
    const contentBlob = new Blob([content]);
    const size = contentBlob.size;
    const md5 = await this.calculateMD5(content);
    const precreateUrl = `https://pan.baidu.com/rest/2.0/xpan/file?method=precreate&access_token=${token}`;
    const precreateRes = await fetch(precreateUrl, {
      method: "POST",
      body: new URLSearchParams({
        path,
        size: size.toString(),
        isdir: "0",
        autoinit: "1",
        rtype: "3",
        // 3: Overwrite
        block_list: JSON.stringify([md5])
      })
    });
    const precreateData = await precreateRes.json();
    if (precreateData.errno !== 0) {
      throw new Error(`Upload Precreate Failed: ${precreateData.errno}`);
    }
    const uploadid = precreateData.uploadid;
    const uploadUrl = `https://d.pcs.baidu.com/rest/2.0/pcs/superfile2?method=upload&type=tmpfile&path=${encodeURIComponent(path)}&uploadid=${uploadid}&partseq=0&access_token=${token}`;
    const formData = new FormData();
    formData.append("file", contentBlob, filename);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      body: formData
    });
    if (!uploadRes.ok) throw new Error(`Upload Chunk Failed: ${uploadRes.statusText}`);
    const createUrl = `https://pan.baidu.com/rest/2.0/xpan/file?method=create&access_token=${token}`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      body: new URLSearchParams({
        path,
        size: size.toString(),
        isdir: "0",
        uploadid,
        block_list: JSON.stringify([md5])
      })
    });
    const createData = await createRes.json();
    if (createData.errno !== 0) {
      throw new Error(`Upload Create Failed: ${createData.errno}`);
    }
  }
  async downloadBackup(filename) {
    const token = await this.getAccessToken();
    const path = `${this.saveDir}/${filename}`;
    const metaUrl = `https://pan.baidu.com/rest/2.0/xpan/multimedia?method=filemetas&path=${encodeURIComponent(JSON.stringify([path]))}&dlink=1&access_token=${token}`;
    const metaRes = await fetch(metaUrl);
    const metaData = await metaRes.json();
    if (metaData.errno !== 0 || !metaData.list || metaData.list.length === 0) {
      throw new Error(`Get Download Link Failed: ${metaData.errno}`);
    }
    const dlink = `${metaData.list[0].dlink}&access_token=${token}`;
    const res = await fetch(dlink, {
      headers: {
        "User-Agent": "pan.baidu.com"
      }
    });
    if (!res.ok) throw new Error(`Download Failed: ${res.statusText}`);
    return await res.text();
  }
  async deleteBackup(filename) {
    const token = await this.getAccessToken();
    const path = `${this.saveDir}/${filename}`;
    const url = `https://pan.baidu.com/rest/2.0/xpan/file?method=filemanager&opera=delete&access_token=${token}`;
    const res = await fetch(url, {
      method: "POST",
      body: new URLSearchParams({
        filelist: JSON.stringify([path])
      })
    });
    const data = await res.json();
    if (data.errno !== 0 && data.errno !== -8) {
      throw new Error(`Delete Failed: ${data.errno}`);
    }
  }
};

// ../src/features/backup/providers/dropboxProvider.ts
init_config();
var DropboxProvider = class {
  clientId;
  clientSecret;
  refreshToken;
  accessToken = null;
  saveDir;
  config;
  onConfigUpdate;
  constructor(config, env) {
    this.config = config;
    this.clientId = env.OAUTH_DROPBOX_CLIENT_ID;
    this.clientSecret = env.OAUTH_DROPBOX_CLIENT_SECRET;
    if (!config.refreshToken) {
      throw new Error("dropbox_token_missing");
    }
    this.refreshToken = config.refreshToken;
    this.saveDir = config.saveDir || "";
  }
  async getAccessToken() {
    if (this.accessToken) return this.accessToken;
    const res = await fetch("https://api.dropboxapi.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token"
      })
    });
    if (!res.ok) {
      const err = await res.json();
      const errorDesc = (err.error || err.error_description || "").toLowerCase();
      if (errorDesc.includes("invalid_grant") || res.status === 401) {
        throw new AppError("oauth_token_revoked", 401);
      }
      throw new Error(`dropbox_auth_failed: ${err.error_description || res.statusText}`);
    }
    const data = await res.json();
    this.accessToken = data.access_token;
    if (data.refresh_token && data.refresh_token !== this.refreshToken) {
      this.refreshToken = data.refresh_token;
      if (this.onConfigUpdate) {
        await this.onConfigUpdate({ ...this.config, refreshToken: this.refreshToken });
      }
    }
    return this.accessToken;
  }
  async testConnection() {
    await this.getAccessToken();
    await this.listBackups();
    return true;
  }
  async listBackups() {
    const token = await this.getAccessToken();
    const path = this.saveDir === "/" || this.saveDir === "" ? "" : this.saveDir.startsWith("/") ? this.saveDir : "/" + this.saveDir;
    const res = await fetch("https://api.dropboxapi.com/2/files/list_folder", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path,
        recursive: false,
        include_media_info: false,
        include_deleted: false
      })
    });
    if (res.status === 409) {
      return [];
    }
    if (!res.ok) {
      const err = await res.json();
      if (err?.error?.[".tag"] === "path" && err?.error?.path?.[".tag"] === "not_found") {
        return [];
      }
      throw new Error(`dropbox_list_failed: ${res.status}`);
    }
    const data = await res.json();
    return (data.entries || []).filter((f) => f[".tag"] === "file" && f.name.includes("nodeauth-backup-")).map((f) => ({
      filename: f.name,
      size: f.size,
      lastModified: f.server_modified
    }));
  }
  async uploadBackup(filename, data) {
    const token = await this.getAccessToken();
    const path = this.saveDir === "/" || this.saveDir === "" ? "" : this.saveDir.startsWith("/") ? this.saveDir : "/" + this.saveDir;
    const fullPath = `${path}/${filename}`.replace(/\/+/g, "/");
    const args = {
      path: fullPath,
      mode: "overwrite",
      autorename: false,
      mute: false,
      strict_conflict: false
    };
    const res = await fetch("https://content.dropboxapi.com/2/files/upload", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify(args),
        "Content-Type": "application/octet-stream"
      },
      body: data
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(`dropbox_upload_failed: ${err.error_summary || res.statusText}`);
    }
  }
  async downloadBackup(filename) {
    const token = await this.getAccessToken();
    const path = this.saveDir === "/" || this.saveDir === "" ? "" : this.saveDir.startsWith("/") ? this.saveDir : "/" + this.saveDir;
    const fullPath = `${path}/${filename}`.replace(/\/+/g, "/");
    const args = {
      path: fullPath
    };
    const res = await fetch("https://content.dropboxapi.com/2/files/download", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Dropbox-API-Arg": JSON.stringify(args)
      }
    });
    if (!res.ok) throw new Error(`dropbox_download_failed: ${res.status}`);
    return await res.text();
  }
  async deleteBackup(filename) {
    const token = await this.getAccessToken();
    const path = this.saveDir === "/" || this.saveDir === "" ? "" : this.saveDir.startsWith("/") ? this.saveDir : "/" + this.saveDir;
    const fullPath = `${path}/${filename}`.replace(/\/+/g, "/");
    const res = await fetch("https://api.dropboxapi.com/2/files/delete_v2", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ path: fullPath })
    });
    if (!res.ok) {
      const err = await res.json();
      if (err?.error_summary?.includes("path_lookup/not_found")) return;
      throw new Error(`dropbox_delete_failed: ${res.statusText}`);
    }
  }
};

// ../src/features/backup/providers/emailProvider.ts
import { eq as eq8, desc as desc5, and as and4 } from "drizzle-orm";
function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary);
}
function buildMimeEmail(params) {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const encodedSubject = `=?UTF-8?B?${encodeBase64Utf8(params.subject)}?=`;
  const b64Lines = params.attachmentData.match(/.{1,76}/g)?.join("\r\n") || params.attachmentData;
  return [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    encodeBase64Utf8(params.body),
    ``,
    `--${boundary}`,
    `Content-Type: application/json; name="${params.filename}"`,
    `Content-Transfer-Encoding: base64`,
    `Content-Disposition: attachment; filename="${params.filename}"`,
    ``,
    b64Lines,
    ``,
    `--${boundary}--`
  ].join("\r\n");
}
var EMAIL_TRANSLATIONS = {
  "zh-CN": {
    subject: "\u{1F4E6} NodeAuth \u5B9A\u671F\u5907\u4EFD {time}",
    intro: "\u60A8\u597D\uFF0C\n\n\u8FD9\u662F\u60A8\u7684 NodeAuth \u81EA\u52A8\u5B9A\u671F\u5907\u4EFD\u6587\u4EF6\uFF0C\u8BF7\u59A5\u5584\u4FDD\u7BA1\u3002",
    filename: "\u6587\u4EF6\u540D\uFF1A{filename}",
    time: "\u5907\u4EFD\u65F6\u95F4\uFF1A{time}",
    note: "\u6CE8\u610F\uFF1A\u9644\u4EF6\u5185\u5BB9\u7ECF\u8FC7 AES-256 \u52A0\u5BC6\uFF0C\u8BF7\u4F7F\u7528\u60A8\u8BBE\u7F6E\u7684\u5907\u4EFD\u5BC6\u7801\u8FDB\u884C\u89E3\u5BC6\u6062\u590D\u3002",
    footer: "---\nNodeAuth \u81EA\u52A8\u5907\u4EFD\u7CFB\u7EDF",
    testSubject: "\u{1F517} NodeAuth \u5907\u4EFD\u6E90\u8FDE\u63A5\u6D4B\u8BD5",
    testBody: "\u2705 \u60A8\u7684 NodeAuth \u90AE\u4EF6\u5907\u4EFD\u6E90\u5DF2\u6210\u529F\u8FDE\u63A5\uFF01"
  },
  "en-US": {
    subject: "\u{1F4E6} NodeAuth Scheduled Backup {time}",
    intro: "Hello,\n\nThis is your NodeAuth automatic scheduled backup file. Please keep it safe.",
    filename: "Filename: {filename}",
    time: "Backup Time: {time}",
    note: "Note: The attachment is encrypted with AES-256. Please use your backup password to decrypt and restore it.",
    footer: "---\nNodeAuth Automatic Backup System",
    testSubject: "\u{1F517} NodeAuth Backup Connection Test",
    testBody: "\u2705 Your NodeAuth email backup connection is working correctly!"
  }
};
async function sendEmail(smtp, subject, body, filename, attachmentData) {
  let isRealNode = false;
  try {
    new Function("return true")();
    isRealNode = typeof process !== "undefined" && !!process.versions?.node;
  } catch (_) {
    isRealNode = false;
  }
  if (isRealNode) {
    const nodemailer = await new Function("m", "return import(m)")("nodemailer");
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: {
        user: smtp.user,
        pass: smtp.password
      }
    });
    await transporter.sendMail({
      from: smtp.from || smtp.user,
      to: smtp.to,
      subject,
      text: body,
      attachments: [
        {
          filename,
          content: attachmentData,
          encoding: "base64",
          contentType: "application/json"
        }
      ]
    });
  } else {
    const MAX_ATTEMPTS = 3;
    let lastError = new Error("email_send_failed: unknown");
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await sendViaSmtpTcp(smtp, subject, body, filename, attachmentData);
        return;
      } catch (e) {
        lastError = e;
        const isAuthError = e.message?.includes("auth_success_failed") || e.message?.includes("535") || e.message?.includes("534") || e.message?.includes("Username and Password not accepted");
        if (isAuthError || attempt === MAX_ATTEMPTS) break;
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }
    throw lastError;
  }
}
async function sendViaSmtpTcp(smtp, subject, body, filename, attachmentData) {
  const { connect } = await import("cloudflare:sockets");
  const rawEmail = buildMimeEmail({
    from: smtp.from || smtp.user,
    to: smtp.to,
    subject,
    body,
    filename,
    attachmentData
  });
  const isSSL = smtp.secure;
  let sock = connect(`${smtp.host}:${smtp.port}`, {
    secureTransport: isSSL ? "on" : "starttls",
    allowHalfOpen: false
  });
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  let buf = "";
  let reader = sock.readable.getReader();
  let writer = sock.writable.getWriter();
  const readResp = async () => {
    let last = "";
    for (; ; ) {
      const nl = buf.indexOf("\n");
      if (nl !== -1) {
        const line = buf.slice(0, nl).replace(/\r$/, "");
        buf = buf.slice(nl + 1);
        last = line;
        if (line.length < 4 || line[3] !== "-") return line;
      } else {
        try {
          const { value, done } = await reader.read();
          if (done) {
            if (last) return last;
            throw new Error("smtp_connection_closed: Server closed the connection unexpectedly");
          }
          buf += dec.decode(value);
        } catch (e) {
          if (e.message?.includes("smtp_")) throw e;
          throw new Error(
            `smtp_connection_closed: ${e.message}. Possible causes: server rejected your IP (common with Chinese providers from Cloudflare), wrong credentials, or TLS handshake failure.`
          );
        }
      }
    }
  };
  const send = (s) => writer.write(enc.encode(s + "\r\n"));
  const expect = async (code, label) => {
    const resp = await readResp();
    if (!resp.startsWith(code)) throw new Error(`smtp_${label}_failed: ${resp.slice(0, 120)}`);
    return resp;
  };
  try {
    await expect("220", "greeting");
    await send("EHLO nodeauth");
    await expect("250", "ehlo");
    if (!isSSL) {
      await send("STARTTLS");
      await expect("220", "starttls_ready");
      reader.releaseLock();
      writer.releaseLock();
      const tlsSock = sock.startTls();
      buf = "";
      reader = tlsSock.readable.getReader();
      writer = tlsSock.writable.getWriter();
      await send("EHLO nodeauth");
      await expect("250", "ehlo_after_tls");
    }
    await send("AUTH LOGIN");
    await expect("334", "auth_prompt_user");
    await send(encodeBase64Utf8(smtp.user));
    await expect("334", "auth_prompt_pass");
    await send(encodeBase64Utf8(smtp.password));
    await expect("235", "auth_success");
    await send(`MAIL FROM:<${smtp.from || smtp.user}>`);
    await expect("250", "mail_from");
    await send(`RCPT TO:<${smtp.to}>`);
    await expect("250", "rcpt_to");
    await send("DATA");
    await expect("354", "data_ready");
    const stuffed = rawEmail.split("\r\n").map((line) => line.startsWith(".") ? "." + line : line).join("\r\n");
    await writer.write(enc.encode(stuffed + "\r\n.\r\n"));
    await expect("250", "message_accepted");
    await send("QUIT");
    await readResp().catch(() => {
    });
  } finally {
    writer.close().catch(() => {
    });
  }
}
var EmailProvider = class {
  smtp;
  db;
  providerId;
  lang;
  constructor(config, db, providerId, lang = "en-US") {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPassword || !config.smtpTo) {
      throw new Error("email_config_incomplete");
    }
    this.smtp = {
      host: config.smtpHost,
      port: parseInt(config.smtpPort || "587", 10),
      secure: config.smtpSecure === true || config.smtpSecure === "true",
      user: config.smtpUser,
      password: config.smtpPassword,
      from: config.smtpFrom || config.smtpUser,
      to: config.smtpTo
    };
    this.db = db;
    this.providerId = providerId;
    this.lang = lang;
  }
  async testConnection() {
    const t = EMAIL_TRANSLATIONS[this.lang] || EMAIL_TRANSLATIONS["en-US"];
    const subject = t.testSubject;
    const body = t.testBody;
    const filename = "nodeauth-test-email.txt";
    try {
      await sendEmail(this.smtp, subject, body, filename, encodeBase64Utf8(body));
      return true;
    } catch (e) {
      throw new Error(`email_send_failed: ${e.message}`);
    }
  }
  async listBackups() {
    if (!this.db || !this.providerId) {
      throw new Error("email_db_missing");
    }
    const histories = await this.db.select().from(backupEmailHistory4).where(eq8(backupEmailHistory4.providerId, this.providerId)).orderBy(desc5(backupEmailHistory4.createdAt));
    return histories.map((h) => ({
      filename: h.filename,
      size: h.size,
      lastModified: new Date(h.createdAt).toISOString()
    }));
  }
  async uploadBackup(filename, data) {
    if (!this.db || !this.providerId) {
      throw new Error("email_db_missing");
    }
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    const t = EMAIL_TRANSLATIONS[this.lang] || EMAIL_TRANSLATIONS["en-US"];
    const subject = t.subject.replace("{time}", ts);
    const body = [
      t.intro,
      "",
      t.filename.replace("{filename}", filename),
      t.time.replace("{time}", ts),
      "",
      t.note,
      "",
      t.footer
    ].join("\n");
    const attachmentData = encodeBase64Utf8(data);
    await sendEmail(this.smtp, subject, body, filename, attachmentData);
    await this.db.insert(backupEmailHistory4).values({
      providerId: this.providerId,
      filename,
      recipient: this.smtp.to,
      size: data.length,
      createdAt: Date.now()
    });
  }
  async downloadBackup(filename) {
    throw new Error("email_download_not_supported");
  }
  async deleteBackup(filename) {
    if (!this.db || !this.providerId) {
      throw new Error("email_db_missing");
    }
    const _recordResult = await this.db.select().from(backupEmailHistory4).where(and4(
      eq8(backupEmailHistory4.providerId, this.providerId),
      eq8(backupEmailHistory4.filename, filename)
    )).limit(1);
    const record = _recordResult[0];
    if (record) {
      await this.db.delete(backupEmailHistory4).where(eq8(backupEmailHistory4.id, record.id));
    }
  }
};

// ../src/features/backup/providers/githubProvider.ts
init_config();
var GithubProvider = class {
  token;
  owner;
  repo;
  branch;
  saveDir;
  onConfigUpdate;
  constructor(config) {
    this.token = config.token;
    this.owner = config.owner;
    this.repo = config.repo;
    this.branch = config.branch || "main";
    this.saveDir = (config.saveDir || "/nodeauth-backup").replace(/^\/+|\/+$/g, "");
  }
  getApiUrl(path) {
    return `https://api.github.com/repos/${this.owner}/${this.repo}${path}`;
  }
  async request(path, options = {}) {
    const url = this.getApiUrl(path);
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${this.token}`);
    headers.set("Accept", "application/vnd.github.v3+json");
    headers.set("X-GitHub-Api-Version", "2022-11-28");
    headers.set("User-Agent", "NodeAuth-Backup");
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 401) {
        throw new AppError("oauth_token_revoked", 401);
      }
      if (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0") {
        throw new AppError("github_rate_limit_exceeded", 429);
      }
      throw new AppError(data?.message || `GitHub API Error ${res.status}`, res.status);
    }
    return data;
  }
  async testConnection() {
    try {
      await this.request("");
      return true;
    } catch (e) {
      if (e instanceof AppError) throw e;
      throw new AppError(e.message, 400);
    }
  }
  async listBackups() {
    try {
      const data = await this.request(`/contents/${this.saveDir}`);
      if (!Array.isArray(data)) {
        return [];
      }
      return data.filter((item) => item.type === "file").map((item) => ({
        filename: item.name,
        size: item.size,
        lastModified: (/* @__PURE__ */ new Date()).toISOString()
      }));
    } catch (e) {
      if (e.statusCode === 404 || e.status === 404) return [];
      throw e;
    }
  }
  async uploadBackup(filename, content) {
    const path = `/contents/${this.saveDir ? this.saveDir + "/" : ""}${filename}`;
    const bytes = new TextEncoder().encode(content);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Content = btoa(binary);
    let sha;
    try {
      const existing = await this.request(path);
      if (existing && existing.sha) {
        sha = existing.sha;
      }
    } catch (e) {
    }
    let bodyObj = {
      message: `NodeAuth Backup: ${filename}`,
      content: base64Content,
      sha
    };
    if (this.branch) {
      bodyObj.branch = this.branch;
    }
    const body = JSON.stringify(bodyObj);
    await this.request(path, { method: "PUT", body });
  }
  async downloadBackup(filename) {
    const path = `/contents/${this.saveDir ? this.saveDir + "/" : ""}${filename}`;
    const data = await this.request(path);
    if (data.encoding === "base64") {
      const binary = atob(data.content);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    throw new AppError("invalid_file_encoding", 500);
  }
  async deleteBackup(filename) {
    const path = `/contents/${this.saveDir ? this.saveDir + "/" : ""}${filename}`;
    let sha;
    try {
      const existing = await this.request(path);
      if (existing && existing.sha) {
        sha = existing.sha;
      } else {
        throw new AppError("file_not_found", 404);
      }
    } catch (e) {
      if (e.statusCode === 404 || e.status === 404) return;
      throw e;
    }
    let bodyObj = {
      message: `NodeAuth Delete Backup: ${filename}`,
      sha
    };
    if (this.branch) {
      bodyObj.branch = this.branch;
    }
    const body = JSON.stringify(bodyObj);
    await this.request(path, { method: "DELETE", body });
  }
};

// ../src/features/backup/backupService.ts
init_logger();
var BackupService = class {
  repository;
  env;
  db;
  constructor(env, lang = "en-US") {
    this.env = env;
    this.db = env.DB;
    this.repository = new BackupRepository(env.DB);
    this.lang = lang.toLowerCase().includes("zh") ? "zh-CN" : "en-US";
  }
  lang;
  MASK = "******";
  SENSITIVE_FIELDS = {
    webdav: ["password"],
    s3: ["secretAccessKey"],
    telegram: ["botToken"],
    gdrive: ["refreshToken"],
    onedrive: ["refreshToken"],
    baidu: ["refreshToken"],
    dropbox: ["refreshToken"],
    email: ["smtpPassword"],
    github: ["token"]
  };
  maskConfigForFrontend(type, config) {
    const fields = this.SENSITIVE_FIELDS[type];
    if (!fields) return;
    for (const field of fields) {
      if (config[field]) config[field] = this.MASK;
    }
  }
  mergeMaskedConfig(type, incomingConfig, currentConfigBase) {
    const fields = this.SENSITIVE_FIELDS[type];
    if (!fields) return;
    for (const field of fields) {
      if (incomingConfig[field] === this.MASK || incomingConfig[field] === void 0 || incomingConfig[field] === null) {
        incomingConfig[field] = currentConfigBase[field];
      }
    }
  }
  async generateEncryptedPayload(key, backupPassword) {
    const vaultResults = await this.db.select().from(vault4);
    const accounts = (await Promise.all(vaultResults.map(async (row) => {
      const secret = await decryptField(row.secret, key);
      if (!secret) return null;
      return {
        service: row.service,
        account: row.account,
        category: row.category,
        secret,
        digits: row.digits,
        period: row.period
      };
    }))).filter(Boolean);
    const exportPayload = {
      version: "2.0",
      app: "nodeauth",
      encrypted: true,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      accounts
    };
    const userEncrypted = await encryptBackupFile(exportPayload, backupPassword);
    return JSON.stringify({ ...exportPayload, data: userEncrypted, accounts: void 0 });
  }
  validateSafeFilename(filename) {
    const safePattern = /^nodeauth-backup-(auto|manual|export)-[a-zA-Z0-9.-]+\.json$/;
    if (!safePattern.test(filename) || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
      throw new AppError("invalid_filename_detected", 400);
    }
  }
  async getProvider(type, config, id) {
    let provider;
    switch (type) {
      case "webdav":
        provider = new WebDavProvider(config);
        break;
      case "s3":
        provider = new S3Provider(config);
        break;
      case "telegram":
        provider = new TelegramProvider2(config, this.db, id);
        break;
      case "gdrive":
        provider = new GoogleDriveProvider(config, this.env);
        break;
      case "onedrive":
        provider = new OneDriveProvider(config, this.env);
        break;
      case "baidu":
        provider = new BaiduNetdiskProvider(config, this.env);
        break;
      case "dropbox":
        provider = new DropboxProvider(config, this.env);
        break;
      case "email":
        provider = new EmailProvider(config, this.db, id, this.lang);
        break;
      case "github":
        provider = new GithubProvider(config);
        break;
      default:
        throw new AppError("provider_not_found", 400);
    }
    if (id) {
      const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
      provider.onConfigUpdate = async (updatedConfig) => {
        const encryptedConfig = await this.processConfigForStorage(type, updatedConfig, key);
        await this.db.update(backupProviders4).set({
          config: encryptedConfig,
          updatedAt: Date.now()
        }).where(eq9(backupProviders4.id, id));
        logger.info(`[BackupService] Auto-updated config for provider ${id} (${type})`);
      };
    }
    return provider;
  }
  async processConfigForStorage(type, config, key) {
    const processed = { ...config };
    const fields = this.SENSITIVE_FIELDS[type];
    if (fields) {
      for (const field of fields) {
        if (processed[field] && processed[field] !== this.MASK) {
          processed[field] = await encryptData(processed[field], key);
        }
      }
    }
    return JSON.stringify(processed);
  }
  async processConfigForUsage(type, configStr, key) {
    const config = JSON.parse(configStr);
    const fields = this.SENSITIVE_FIELDS[type];
    if (fields) {
      for (const field of fields) {
        if (config[field]) {
          try {
            config[field] = await decryptData(config[field], key);
          } catch (e) {
            logger.error(`[BackupService] Decryption failed for field ${field} in ${type}`);
          }
        }
      }
    }
    return config;
  }
  async getProvidersList() {
    const results = await this.repository.findAllSettings();
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    return await Promise.all(results.map(async (row) => {
      const config = await this.processConfigForUsage(row.type, row.config, key);
      this.maskConfigForFrontend(row.type, config);
      return {
        ...row,
        config,
        auto_backup: !!row.autoBackup,
        auto_backup_password: !!row.autoBackupPassword,
        auto_backup_retain: row.autoBackupRetain !== null ? row.autoBackupRetain : 30
      };
    }));
  }
  async addProvider(data) {
    const { type, name, config, autoBackup, autoBackupPassword, autoBackupRetain } = data;
    if (!type || !name || !config) throw new AppError("missing_fields", 400);
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    const encryptedConfig = await this.processConfigForStorage(type, config, key);
    let encryptedAutoBackupPwd = null;
    if (autoBackup && autoBackupPassword) {
      if (autoBackupPassword.length < 6) throw new AppError("backup_password_length", 400);
      encryptedAutoBackupPwd = JSON.stringify(await encryptData(autoBackupPassword, key));
    } else if (autoBackup) {
      throw new AppError("backup_password_required", 400);
    }
    await this.db.insert(backupProviders4).values({
      type,
      name,
      config: encryptedConfig,
      autoBackup: autoBackup ? true : false,
      autoBackupPassword: encryptedAutoBackupPwd,
      autoBackupRetain: autoBackupRetain !== void 0 ? parseInt(autoBackupRetain, 10) : 30,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    const _newRecord = await this.db.select({ id: backupProviders4.id }).from(backupProviders4).where(eq9(backupProviders4.type, type)).orderBy(desc6(backupProviders4.id)).limit(1);
    const newRecord = _newRecord[0];
    return newRecord.id;
  }
  async updateProvider(id, data) {
    const { name, config, type, autoBackup, autoBackupPassword, autoBackupRetain } = data;
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    const _currentProvider = await this.db.select().from(backupProviders4).where(eq9(backupProviders4.id, id)).limit(1);
    const currentProvider = _currentProvider[0];
    if (currentProvider) {
      const currentConfigBase = await this.processConfigForUsage(currentProvider.type, currentProvider.config, key);
      this.mergeMaskedConfig(type, config, currentConfigBase);
    }
    const encryptedConfig = await this.processConfigForStorage(type, config, key);
    const _current = await this.db.select({ autoBackupPassword: backupProviders4.autoBackupPassword }).from(backupProviders4).where(eq9(backupProviders4.id, id)).limit(1);
    const current = _current[0];
    let finalAutoPwd = current?.autoBackupPassword;
    if (autoBackupPassword) {
      if (autoBackupPassword.length < 6) throw new AppError("backup_password_length", 400);
      finalAutoPwd = JSON.stringify(await encryptData(autoBackupPassword, key));
    } else if (autoBackup && !finalAutoPwd) {
      throw new AppError("backup_password_required", 400);
    }
    await this.db.update(backupProviders4).set({
      name,
      config: encryptedConfig,
      autoBackup: autoBackup ? true : false,
      autoBackupPassword: finalAutoPwd,
      autoBackupRetain: autoBackupRetain !== void 0 ? parseInt(autoBackupRetain, 10) : 30,
      updatedAt: Date.now()
    }).where(eq9(backupProviders4.id, id));
  }
  async deleteProvider(id) {
    await this.db.delete(backupProviders4).where(eq9(backupProviders4.id, id));
  }
  async testConnection(type, config, id) {
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    if (id) {
      const _currentProvider = await this.db.select().from(backupProviders4).where(eq9(backupProviders4.id, id)).limit(1);
      const currentProvider = _currentProvider[0];
      if (currentProvider) {
        const currentConfigBase = await this.processConfigForUsage(currentProvider.type, currentProvider.config, key);
        this.mergeMaskedConfig(type, config, currentConfigBase);
      }
    }
    try {
      const provider = await this.getProvider(type, config, id);
      await provider.testConnection();
    } catch (e) {
      if (e.message === "oauth_token_revoked" || e.message?.includes("oauth_token_revoked")) {
        throw new AppError("oauth_token_revoked", 401);
      }
      throw new AppError(`connection_failed: ${e.message}`, 400);
    }
  }
  async executeManualBackup(id, data) {
    const { filename, content, password } = data;
    let finalFilename;
    let finalContent;
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    if (filename && content) {
      finalFilename = filename;
      finalContent = content;
    } else if (password !== void 0) {
      let backupPassword = password;
      const _providerRow2 = await this.db.select({ autoBackupPassword: backupProviders4.autoBackupPassword }).from(backupProviders4).where(eq9(backupProviders4.id, id)).limit(1);
      const providerRow2 = _providerRow2[0];
      if (password === "") {
        if (!providerRow2 || !providerRow2.autoBackupPassword) {
          throw new AppError("manual_backup_password_needed", 400);
        }
        backupPassword = await decryptData(JSON.parse(providerRow2.autoBackupPassword), key);
      }
      if (!backupPassword || backupPassword.length < 6) {
        throw new AppError("backup_password_length", 400);
      }
      finalFilename = `nodeauth-backup-manual-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.json`;
      finalContent = await this.generateEncryptedPayload(key, backupPassword);
    } else {
      throw new AppError("missing_fields", 400);
    }
    const _providerRow = await this.db.select().from(backupProviders4).where(eq9(backupProviders4.id, id)).limit(1);
    const providerRow = _providerRow[0];
    if (!providerRow) throw new AppError("provider_not_found", 404);
    const configObj = await this.processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await this.getProvider(providerRow.type, configObj, providerRow.id);
    try {
      await provider.uploadBackup(finalFilename, finalContent);
      await this.db.update(backupProviders4).set({
        lastBackupAt: Date.now(),
        lastBackupStatus: "success"
      }).where(eq9(backupProviders4.id, id));
    } catch (e) {
      await this.db.update(backupProviders4).set({ lastBackupStatus: "failed" }).where(eq9(backupProviders4.id, id));
      if (e.message === "oauth_token_revoked" || e.message?.includes("oauth_token_revoked")) {
        throw new AppError("oauth_token_revoked", 401);
      }
      throw new AppError(`backup_failed: ${e.message}`, 500);
    }
  }
  async getFiles(id) {
    const _providerRow = await this.db.select().from(backupProviders4).where(eq9(backupProviders4.id, id)).limit(1);
    const providerRow = _providerRow[0];
    if (!providerRow) throw new AppError("provider_not_found", 404);
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    const config = await this.processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await this.getProvider(providerRow.type, config, providerRow.id);
    try {
      return await provider.listBackups();
    } catch (e) {
      if (e.message === "oauth_token_revoked" || e.message?.includes("oauth_token_revoked")) {
        throw new AppError("oauth_token_revoked", 401);
      }
      throw e;
    }
  }
  async downloadFile(id, filename) {
    if (!filename) throw new AppError("filename_required", 400);
    this.validateSafeFilename(filename);
    const _providerRow = await this.db.select().from(backupProviders4).where(eq9(backupProviders4.id, id)).limit(1);
    const providerRow = _providerRow[0];
    if (!providerRow) throw new AppError("provider_not_found", 404);
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    const config = await this.processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await this.getProvider(providerRow.type, config, providerRow.id);
    try {
      return await provider.downloadBackup(filename);
    } catch (e) {
      if (e.message === "oauth_token_revoked" || e.message?.includes("oauth_token_revoked")) {
        throw new AppError("oauth_token_revoked", 401);
      }
      if (e.message === "email_download_not_supported") {
        throw new AppError("email_download_not_supported", 400);
      }
      throw new AppError(`download_failed: ${e.message}`, 500);
    }
  }
  async deleteFile(id, filename) {
    if (!filename) throw new AppError("filename_required", 400);
    this.validateSafeFilename(filename);
    const _providerRow = await this.db.select().from(backupProviders4).where(eq9(backupProviders4.id, id)).limit(1);
    const providerRow = _providerRow[0];
    if (!providerRow) throw new AppError("provider_not_found", 404);
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    const config = await this.processConfigForUsage(providerRow.type, providerRow.config, key);
    const provider = await this.getProvider(providerRow.type, config, providerRow.id);
    try {
      await provider.deleteBackup(filename);
    } catch (e) {
      throw new AppError(`delete_failed: ${e.message}`, 500);
    }
  }
  async handleScheduledBackup() {
    logger.info("[Backup] Starting scheduled backup...");
    const providers = await this.db.select().from(backupProviders4);
    if (!providers || providers.length === 0) {
      logger.info("[Backup] No backup providers configured.");
      return;
    }
    const key = this.env.ENCRYPTION_KEY || this.env.JWT_SECRET;
    const filename = `nodeauth-backup-auto-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}.json`;
    for (const row of providers) {
      if (!row.autoBackup || !row.autoBackupPassword) continue;
      try {
        const backupPassword = await decryptData(JSON.parse(row.autoBackupPassword), key);
        const fileContent = await this.generateEncryptedPayload(key, backupPassword);
        const config = await this.processConfigForUsage(row.type, row.config, key);
        const provider = await this.getProvider(row.type, config, row.id);
        await provider.uploadBackup(filename, fileContent);
        await this.db.update(backupProviders4).set({
          lastBackupAt: Date.now(),
          lastBackupStatus: "success"
        }).where(eq9(backupProviders4.id, row.id));
        logger.info(`[Backup] Successfully backed up to ${row.name}`);
        const retainCount = row.autoBackupRetain !== null ? row.autoBackupRetain : 30;
        if (retainCount > 0) {
          try {
            const files = await provider.listBackups();
            const autoFiles = files.filter((f) => f.filename.startsWith("nodeauth-backup-auto-")).sort((a, b) => b.filename.localeCompare(a.filename));
            if (autoFiles.length > retainCount) {
              const filesToDelete = autoFiles.slice(retainCount);
              for (const fileToDelete of filesToDelete) {
                try {
                  await provider.deleteBackup(fileToDelete.filename);
                  logger.info(`[Backup Prune] Deleted old auto-backup: ${fileToDelete.filename}`);
                } catch (delErr) {
                  logger.error(`[Backup Prune] Failed to delete ${fileToDelete.filename}: ${delErr.message}`);
                }
              }
            }
          } catch (listErr) {
            logger.error(`[Backup Prune] Failed to list backups for pruning: ${listErr.message}`);
          }
        }
      } catch (e) {
        logger.error(`[Backup] Failed to backup to ${row.name}: ${e.message}`);
        await this.db.update(backupProviders4).set({ lastBackupStatus: "failed" }).where(eq9(backupProviders4.id, row.id));
      }
    }
  }
};

// ../src/features/backup/backupRoutes.ts
init_crypto();
init_config();
init_logger();
import { getCookie as getCookie3, setCookie as setCookie2 } from "hono/cookie";
var backups = new Hono3();
var isSecureContext2 = (c) => c.env.ENVIRONMENT !== "development";
backups.get("/oauth/google/callback", async (c) => {
  c.header("Cross-Origin-Opener-Policy", "unsafe-none");
  const stateInQuery = c.req.query("state");
  const stateInCookie = getCookie3(c, "gdrive_oauth_state");
  if (!stateInQuery || !stateInCookie || stateInQuery !== stateInCookie) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'GDRIVE_AUTH_ERROR', message: 'Security Warning: State mismatch.' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('gdrive_oauth_channel'); bc.postMessage(msg); bc.close(); } catch(e) {}
                window.close();
            </script></body></html>
        `);
  }
  const token = getCookie3(c, "auth_token");
  if (!token) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'GDRIVE_AUTH_ERROR', message: 'Session expired' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('gdrive_oauth_channel'); bc.postMessage(msg); bc.close(); } catch(e) {}
                window.close();
            </script></body></html>
        `);
  }
  const payload = await verifySecureJWT(token, c.env.JWT_SECRET);
  if (!payload?.userInfo) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'GDRIVE_AUTH_ERROR', message: 'Invalid session' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('gdrive_oauth_channel'); bc.postMessage(msg); bc.close(); } catch(e) {}
                window.close();
            </script></body></html>
        `);
  }
  const code = c.req.query("code");
  const error = c.req.query("error");
  if (error === "access_denied") {
    return c.html(`
            <html><body><script>
                const msg = { type: 'GDRIVE_AUTH_ERROR', message: 'User denied access' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('gdrive_oauth_channel'); bc.postMessage(msg); bc.close(); } catch(e) {}
                window.close();
            </script></body></html>
        `);
  }
  if (!code) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'GDRIVE_AUTH_ERROR', message: 'Auth code missing' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('gdrive_oauth_channel'); bc.postMessage(msg); bc.close(); } catch(e) {}
                window.close();
            </script></body></html>
        `);
  }
  const clientId = c.env.OAUTH_GOOGLE_CLIENT_ID;
  const clientSecret = c.env.OAUTH_GOOGLE_CLIENT_SECRET;
  const redirectUri = c.env.OAUTH_GOOGLE_BACKUP_REDIRECT_URI || `${new URL(c.req.url).origin}/api/backups/oauth/google/callback`;
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId || "",
      client_secret: clientSecret || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  if (!tokenRes.ok) {
    const errData = await tokenRes.json();
    logger.error("[OAuth] Token exchange failed:", errData);
    return c.html(`
            <html><body><script>
                const msg = { type: 'GDRIVE_AUTH_ERROR', message: 'Token exchange failed: ${errData.error_description || errData.error}' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('gdrive_oauth_channel'); bc.postMessage(msg); bc.close(); } catch(e) {}
                window.close();
            </script></body></html>
        `);
  }
  const tokenData = await tokenRes.json();
  const refreshToken = tokenData.refresh_token;
  if (!refreshToken) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'GDRIVE_AUTH_ERROR', message: 'No refresh token received. Please check app permissions.' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('gdrive_oauth_channel'); bc.postMessage(msg); bc.close(); } catch(e) {}
                window.close();
            </script></body></html>
        `);
  }
  return c.html(`
        <html>
        <head><title>Success</title></head>
        <body style="font-family:sans-serif; text-align:center; padding-top:50px; color:#555;">
            <div id="status">\u6388\u6743\u6210\u529F\uFF0C\u6B63\u5728\u8FD4\u56DE\u5E94\u7528...</div>
            <script>
                (function() {
                    const message = { 
                        type: 'GDRIVE_AUTH_SUCCESS', 
                        refreshToken: ${JSON.stringify(refreshToken)}
                    };
                    
                    function transmit() {
                        const success = !!window.opener;
                        
                        // 1. \u5C1D\u8BD5 postMessage (\u4F20\u7EDF\u65B9\u5F0F)
                        if (window.opener) {
                            window.opener.postMessage(message, '*');
                        }

                        // 2. \u5C1D\u8BD5 BroadcastChannel (\u73B0\u4EE3\u4E14\u66F4\u53EF\u9760\u7684\u65B9\u5F0F\uFF0C\u4E0D\u4F9D\u8D56 opener)
                        try {
                            const bc = new BroadcastChannel('gdrive_oauth_channel');
                            bc.postMessage(message);
                            bc.close();
                        } catch (e) {}

                        // 3. IndexedDB (PWA \u4E2D\u7EE7\u6A21\u5F0F)
                        try {
                            const request = indexedDB.open('NodeAuthDB', 1);
                            request.onsuccess = (event) => {
                                const db = event.target.result;
                                if (db.objectStoreNames.contains('app_key_store')) {
                                    const transaction = db.transaction('app_key_store', 'readwrite');
                                    transaction.objectStore('app_key_store').put(message, 'backup:oauth:gdrive');
                                }
                            };
                        } catch (e) {}
                        
                        return success;
                    }

                    const sent = transmit();
                    setTimeout(transmit, 100);
                    setTimeout(transmit, 400);

                    // PWA standalone mode redirect
                    if (!sent && window.matchMedia('(display-mode: standalone)').matches) {
                        setTimeout(() => { window.location.href = window.location.origin; }, 500);
                    }

                    setTimeout(() => {
                        transmit();
                        window.close();
                    }, 800);
                })();
            </script>
        </body>
        </html>
    `);
});
backups.get("/oauth/microsoft/callback", async (c) => {
  c.header("Cross-Origin-Opener-Policy", "unsafe-none");
  const stateInQuery = c.req.query("state");
  const stateInCookie = getCookie3(c, "ms_oauth_state");
  if (!stateInQuery || !stateInCookie || stateInQuery !== stateInCookie) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'MS_AUTH_ERROR', message: 'Security Warning: State mismatch.' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('ms_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const token = getCookie3(c, "auth_token");
  if (!token) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'MS_AUTH_ERROR', message: 'Session expired' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('ms_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const payload = await verifySecureJWT(token, c.env.JWT_SECRET);
  if (!payload?.userInfo) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'MS_AUTH_ERROR', message: 'Invalid session' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('ms_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const code = c.req.query("code");
  const error = c.req.query("error");
  if (error === "access_denied") {
    return c.html(`
            <html><body><script>
                const msg = { type: 'MS_AUTH_ERROR', message: 'User denied access' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('ms_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  if (!code) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'MS_AUTH_ERROR', message: 'Auth code missing' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('ms_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const clientId = c.env.OAUTH_MICROSOFT_CLIENT_ID;
  const clientSecret = c.env.OAUTH_MICROSOFT_CLIENT_SECRET;
  const redirectUri = c.env.OAUTH_MICROSOFT_BACKUP_REDIRECT_URI || `${new URL(c.req.url).origin}/api/backups/oauth/microsoft/callback`;
  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId || "",
      client_secret: clientSecret || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  if (!tokenRes.ok) {
    const errData = await tokenRes.json();
    logger.error("[OAuth] Microsoft Token exchange failed:", errData);
    return c.html(`
            <html><body><script>
                const msg = { type: 'MS_AUTH_ERROR', message: 'Token exchange failed: ${errData.error_description || errData.error}' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('ms_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const tokenData = await tokenRes.json();
  const refreshToken = tokenData.refresh_token;
  if (!refreshToken) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'MS_AUTH_ERROR', message: 'No refresh token received.' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('ms_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  return c.html(`
        <html>
        <head><title>Success</title></head>
        <body style="font-family:sans-serif; text-align:center; padding-top:50px; color:#555;">
            <div id="status">\u6388\u6743\u6210\u529F\uFF0C\u6B63\u5728\u8FD4\u56DE\u5E94\u7528...</div>
            <script>
                (function () {
                    const message = {
                        type: 'MS_AUTH_SUCCESS',
                        refreshToken: ${JSON.stringify(refreshToken)}
                    };

                    function transmit() {
                        const success = !!window.opener;
                        // 1. \u5C1D\u8BD5 postMessage (\u4F20\u7EDF\u65B9\u5F0F)
                        if (window.opener) {
                            window.opener.postMessage(message, '*');
                        }

                        // 2. \u5C1D\u8BD5 BroadcastChannel (\u73B0\u4EE3\u4E14\u66F4\u53EF\u9760\u7684\u65B9\u5F0F\uFF0C\u4E0D\u4F9D\u8D56 opener)
                        try {
                            const bc = new BroadcastChannel('ms_oauth_channel');
                            bc.postMessage(message);
                            bc.close();
                        } catch (e) { }

                        // 3. IndexedDB (PWA \u4E2D\u7EE7\u6A21\u5F0F)
                        try {
                            const request = indexedDB.open('NodeAuthDB', 1);
                            request.onsuccess = (event) => {
                                const db = event.target.result;
                                if (db.objectStoreNames.contains('app_key_store')) {
                                    const transaction = db.transaction('app_key_store', 'readwrite');
                                    transaction.objectStore('app_key_store').put(message, 'backup:oauth:onedrive');
                                }
                            };
                        } catch (e) {}
                        return success;
                    }

                    const sent = transmit();
                    setTimeout(transmit, 100);
                    setTimeout(transmit, 400);

                    if (!sent && window.matchMedia('(display-mode: standalone)').matches) {
                        setTimeout(() => { window.location.href = window.location.origin; }, 500);
                    }

                    setTimeout(() => {
                        transmit();
                        window.close();
                    }, 800);
                })();
            </script>
        </body>
        </html>
    `);
});
backups.get("/oauth/baidu/callback", async (c) => {
  c.header("Cross-Origin-Opener-Policy", "unsafe-none");
  const stateInQuery = c.req.query("state");
  const stateInCookie = getCookie3(c, "baidu_oauth_state");
  if (!stateInQuery || !stateInCookie || stateInQuery !== stateInCookie) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'BAIDU_AUTH_ERROR', message: 'Security Warning: State mismatch.' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('baidu_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const token = getCookie3(c, "auth_token");
  if (!token) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'BAIDU_AUTH_ERROR', message: 'Session expired' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('baidu_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const payload = await verifySecureJWT(token, c.env.JWT_SECRET);
  if (!payload?.userInfo) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'BAIDU_AUTH_ERROR', message: 'Invalid session' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('baidu_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const code = c.req.query("code");
  const error = c.req.query("error");
  if (error === "access_denied") {
    return c.html(`
            <html><body><script>
                const msg = { type: 'BAIDU_AUTH_ERROR', message: 'User denied access' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('baidu_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  if (!code) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'BAIDU_AUTH_ERROR', message: 'Auth code missing' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('baidu_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const clientId = c.env.OAUTH_BAIDU_CLIENT_ID;
  const clientSecret = c.env.OAUTH_BAIDU_CLIENT_SECRET;
  const redirectUri = c.env.OAUTH_BAIDU_BACKUP_REDIRECT_URI || `${new URL(c.req.url).origin}/api/backups/oauth/baidu/callback`;
  const tokenRes = await fetch("https://openapi.baidu.com/oauth/2.0/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId || "",
      client_secret: clientSecret || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  if (!tokenRes.ok) {
    const errData = await tokenRes.json();
    logger.error("[OAuth] Baidu Token exchange failed:", errData);
    return c.html(`
            <html><body><script>
                const msg = { type: 'BAIDU_AUTH_ERROR', message: 'Token exchange failed: ${errData.error_description || errData.error}' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('baidu_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const tokenData = await tokenRes.json();
  const refreshToken = tokenData.refresh_token;
  if (!refreshToken) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'BAIDU_AUTH_ERROR', message: 'No refresh token received.' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('baidu_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  return c.html(`
        <html>
        <head><title>Success</title></head>
        <body style="font-family:sans-serif; text-align:center; padding-top:50px; color:#555;">
            <div id="status">\u6388\u6743\u6210\u529F\uFF0C\u6B63\u5728\u8FD4\u56DE\u5E94\u7528...</div>
            <script>
                (function () {
                    const message = {
                        type: 'BAIDU_AUTH_SUCCESS',
                        refreshToken: ${JSON.stringify(refreshToken)}
                    };

                    function transmit() {
                        const success = !!window.opener;
                        // 1. \u5C1D\u8BD5 postMessage (\u4F20\u7EDF\u65B9\u5F0F)
                        if (window.opener) {
                            window.opener.postMessage(message, '*');
                        }

                        // 2. \u5C1D\u8BD5 BroadcastChannel (\u73B0\u4EE3\u4E14\u66F4\u53EF\u9760\u7684\u65B9\u5F0F\uFF0C\u4E0D\u4F9D\u8D56 opener)
                        try {
                            const bc = new BroadcastChannel('baidu_oauth_channel');
                            bc.postMessage(message);
                            bc.close();
                        } catch (e) { }

                        // 3. IndexedDB (PWA \u4E2D\u7EE7\u6A21\u5F0F)
                        try {
                            const request = indexedDB.open('NodeAuthDB', 1);
                            request.onsuccess = (event) => {
                                const db = event.target.result;
                                if (db.objectStoreNames.contains('app_key_store')) {
                                    const transaction = db.transaction('app_key_store', 'readwrite');
                                    transaction.objectStore('app_key_store').put(message, 'backup:oauth:baidu');
                                }
                            };
                        } catch (e) {}
                        return success;
                    }

                    const sent = transmit();
                    setTimeout(transmit, 100);
                    setTimeout(transmit, 400);

                    if (!sent && window.matchMedia('(display-mode: standalone)').matches) {
                        setTimeout(() => { window.location.href = window.location.origin; }, 500);
                    }

                    setTimeout(() => {
                        transmit();
                        window.close();
                    }, 800);
                })();
            </script>
        </body>
        </html>
    `);
});
backups.get("/oauth/dropbox/callback", async (c) => {
  c.header("Cross-Origin-Opener-Policy", "unsafe-none");
  const stateInQuery = c.req.query("state");
  const stateInCookie = getCookie3(c, "dropbox_oauth_state");
  if (!stateInQuery || !stateInCookie || stateInQuery !== stateInCookie) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'DROPBOX_AUTH_ERROR', message: 'Security Warning: State mismatch.' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('dropbox_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const token = getCookie3(c, "auth_token");
  if (!token) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'DROPBOX_AUTH_ERROR', message: 'Session expired' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('dropbox_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const payload = await verifySecureJWT(token, c.env.JWT_SECRET);
  if (!payload?.userInfo) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'DROPBOX_AUTH_ERROR', message: 'Invalid session' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('dropbox_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const code = c.req.query("code");
  const error = c.req.query("error");
  if (error === "access_denied") {
    return c.html(`
            <html><body><script>
                const msg = { type: 'DROPBOX_AUTH_ERROR', message: 'User denied access' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('dropbox_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  if (!code) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'DROPBOX_AUTH_ERROR', message: 'Auth code missing' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('dropbox_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const clientId = c.env.OAUTH_DROPBOX_CLIENT_ID;
  const clientSecret = c.env.OAUTH_DROPBOX_CLIENT_SECRET;
  const redirectUri = c.env.OAUTH_DROPBOX_BACKUP_REDIRECT_URI || `${new URL(c.req.url).origin}/api/backups/oauth/dropbox/callback`;
  const tokenRes = await fetch("https://api.dropboxapi.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId || "",
      client_secret: clientSecret || "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri
    })
  });
  if (!tokenRes.ok) {
    const errData = await tokenRes.json();
    logger.error("[OAuth] Dropbox Token exchange failed:", errData);
    return c.html(`
            <html><body><script>
                const msg = { type: 'DROPBOX_AUTH_ERROR', message: 'Token exchange failed: ${errData.error_description || errData.error}' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('dropbox_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  const tokenData = await tokenRes.json();
  const refreshToken = tokenData.refresh_token;
  if (!refreshToken) {
    return c.html(`
            <html><body><script>
                const msg = { type: 'DROPBOX_AUTH_ERROR', message: 'No refresh token received.' };
                if (window.opener) window.opener.postMessage(msg, '*');
                try { const bc = new BroadcastChannel('dropbox_oauth_channel'); bc.postMessage(msg); bc.close(); } catch (e) { }
                window.close();
            </script></body></html>
        `);
  }
  return c.html(`
        <html>
        <head><title>Success</title></head>
        <body style="font-family:sans-serif; text-align:center; padding-top:50px; color:#555;">
            <div id="status">\u6388\u6743\u6210\u529F\uFF0C\u6B63\u5728\u8FD4\u56DE\u5E94\u7528...</div>
            <script>
                (function () {
                    const message = {
                        type: 'DROPBOX_AUTH_SUCCESS',
                        refreshToken: ${JSON.stringify(refreshToken)}
                    };

                    function transmit() {
                        const success = !!window.opener;
                        // 1. \u5C1D\u8BD5 postMessage (\u4F20\u7EDF\u65B9\u5F0F)
                        if (window.opener) {
                            window.opener.postMessage(message, '*');
                        }

                        // 2. \u5C1D\u8BD5 BroadcastChannel (\u73B0\u4EE3\u4E14\u66F4\u53EF\u9760\u7684\u65B9\u5F0F\uFF0C\u4E0D\u4F9D\u8D56 opener)
                        try {
                            const bc = new BroadcastChannel('dropbox_oauth_channel');
                            bc.postMessage(message);
                            bc.close();
                        } catch (e) { }

                        // 3. IndexedDB (PWA \u4E2D\u7EE7\u6A21\u5F0F)
                        try {
                            const request = indexedDB.open('NodeAuthDB', 1);
                            request.onsuccess = (event) => {
                                const db = event.target.result;
                                if (db.objectStoreNames.contains('app_key_store')) {
                                    const transaction = db.transaction('app_key_store', 'readwrite');
                                    transaction.objectStore('app_key_store').put(message, 'backup:oauth:dropbox');
                                }
                            };
                        } catch (e) {}
                        return success;
                    }

                    const sent = transmit();
                    setTimeout(transmit, 100);
                    setTimeout(transmit, 400);

                    if (!sent && window.matchMedia('(display-mode: standalone)').matches) {
                        setTimeout(() => { window.location.href = window.location.origin; }, 500);
                    }

                    setTimeout(() => {
                        transmit();
                        window.close();
                    }, 800);
                })();
            </script>
        </body>
        </html>
    `);
});
backups.use("*", authMiddleware);
backups.get("/providers", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const providers = await service.getProvidersList();
  const availableTypes = ["s3", "telegram", "webdav", "email", "github"];
  if (c.env.OAUTH_GOOGLE_CLIENT_ID && c.env.OAUTH_GOOGLE_CLIENT_SECRET) {
    availableTypes.push("gdrive");
  }
  if (c.env.OAUTH_MICROSOFT_CLIENT_ID && c.env.OAUTH_MICROSOFT_CLIENT_SECRET) {
    availableTypes.push("onedrive");
  }
  if (c.env.OAUTH_BAIDU_CLIENT_ID && c.env.OAUTH_BAIDU_CLIENT_SECRET) {
    availableTypes.push("baidu");
  }
  if (c.env.OAUTH_DROPBOX_CLIENT_ID && c.env.OAUTH_DROPBOX_CLIENT_SECRET) {
    availableTypes.push("dropbox");
  }
  return c.json({ success: true, providers, availableTypes });
});
backups.post("/providers", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const data = await c.req.json();
  const id = await service.addProvider(data);
  return c.json({ success: true, id });
});
backups.put("/providers/:id", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const id = Number(c.req.param("id"));
  const data = await c.req.json();
  await service.updateProvider(id, data);
  return c.json({ success: true });
});
backups.delete("/providers/:id", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const id = Number(c.req.param("id"));
  await service.deleteProvider(id);
  return c.json({ success: true });
});
backups.post("/providers/test", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const { type, config, id } = await c.req.json();
  await service.testConnection(type, config, id);
  return c.json({ success: true, message: "Connection successful" });
});
backups.post("/providers/:id/backup", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const id = Number(c.req.param("id"));
  const body = await c.req.json();
  await service.executeManualBackup(id, body);
  return c.json({ success: true, message: "Backup successful" });
});
backups.get("/providers/:id/files", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const id = Number(c.req.param("id"));
  const files = await service.getFiles(id);
  return c.json({ success: true, files });
});
backups.post("/providers/:id/download", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const id = Number(c.req.param("id"));
  const { filename } = await c.req.json();
  const content = await service.downloadFile(id, filename);
  return c.json({ success: true, content });
});
backups.post("/providers/:id/files/delete", async (c) => {
  const service = new BackupService(c.env, c.req.header("Accept-Language"));
  const id = Number(c.req.param("id"));
  const { filename } = await c.req.json();
  await service.deleteFile(id, filename);
  return c.json({ success: true });
});
backups.post("/oauth/google/auth", async (c) => {
  const clientId = c.env.OAUTH_GOOGLE_CLIENT_ID;
  const redirectUri = c.env.OAUTH_GOOGLE_BACKUP_REDIRECT_URI || `${new URL(c.req.url).origin}/api/backups/oauth/google/callback`;
  if (!clientId) throw new AppError("oauth_config_incomplete", 400);
  const state = crypto.randomUUID();
  setCookie2(c, "gdrive_oauth_state", state, {
    path: "/api/backups/oauth/google/callback",
    secure: isSecureContext2(c),
    httpOnly: true,
    sameSite: "Lax",
    // Lax is required for cross-site redirect callback
    maxAge: 600
    // 10 minutes
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/drive.file",
    access_type: "offline",
    prompt: "consent",
    state
  });
  return c.json({
    success: true,
    authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  });
});
backups.post("/oauth/microsoft/auth", async (c) => {
  const clientId = c.env.OAUTH_MICROSOFT_CLIENT_ID;
  const redirectUri = c.env.OAUTH_MICROSOFT_BACKUP_REDIRECT_URI || `${new URL(c.req.url).origin}/api/backups/oauth/microsoft/callback`;
  if (!clientId) throw new AppError("oauth_config_incomplete", 400);
  const state = crypto.randomUUID();
  setCookie2(c, "ms_oauth_state", state, {
    path: "/api/backups/oauth/microsoft/callback",
    secure: isSecureContext2(c),
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "offline_access Files.ReadWrite.AppFolder",
    state
  });
  return c.json({
    success: true,
    authUrl: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
  });
});
backups.post("/oauth/baidu/auth", async (c) => {
  const clientId = c.env.OAUTH_BAIDU_CLIENT_ID;
  const redirectUri = c.env.OAUTH_BAIDU_BACKUP_REDIRECT_URI || `${new URL(c.req.url).origin}/api/backups/oauth/baidu/callback`;
  if (!clientId) throw new AppError("oauth_config_incomplete", 400);
  const state = crypto.randomUUID();
  setCookie2(c, "baidu_oauth_state", state, {
    path: "/api/backups/oauth/baidu/callback",
    secure: isSecureContext2(c),
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "basic,netdisk",
    state,
    display: "popup"
  });
  return c.json({
    success: true,
    authUrl: `https://openapi.baidu.com/oauth/2.0/authorize?${params.toString()}`
  });
});
backups.post("/oauth/dropbox/auth", async (c) => {
  const clientId = c.env.OAUTH_DROPBOX_CLIENT_ID;
  const redirectUri = c.env.OAUTH_DROPBOX_BACKUP_REDIRECT_URI || `${new URL(c.req.url).origin}/api/backups/oauth/dropbox/callback`;
  if (!clientId) throw new AppError("oauth_config_incomplete", 400);
  const state = crypto.randomUUID();
  setCookie2(c, "dropbox_oauth_state", state, {
    path: "/api/backups/oauth/dropbox/callback",
    secure: isSecureContext2(c),
    httpOnly: true,
    sameSite: "Lax",
    maxAge: 600
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    token_access_type: "offline",
    // Request refresh token
    state
  });
  return c.json({
    success: true,
    authUrl: `https://www.dropbox.com/oauth2/authorize?${params.toString()}`
  });
});
async function handleScheduledBackup(env) {
  const service = new BackupService(env);
  await service.handleScheduledBackup();
}
var backupRoutes_default = backups;

// ../src/features/telegram/telegramRoutes.ts
import { Hono as Hono4 } from "hono";
var telegram = new Hono4();
telegram.post("/webhook", async (c) => {
  const token = c.env.OAUTH_TELEGRAM_BOT_TOKEN;
  if (!token) return c.text("Bot Token not configured", 500);
  const secretToken = c.req.header("X-Telegram-Bot-Api-Secret-Token");
  if (c.env.OAUTH_TELEGRAM_WEBHOOK_SECRET && secretToken !== c.env.OAUTH_TELEGRAM_WEBHOOK_SECRET) {
    return c.text("Unauthorized", 403);
  }
  const update = await c.req.json();
  if (!update.message) return c.json({ ok: true });
  const chatId = update.message.chat.id;
  const text3 = update.message.text || "";
  if (text3.startsWith("/start")) {
    const args = text3.split(" ");
    const state = args[1];
    if (!state) {
      await sendTelegramMessage(token, chatId, "\u6B22\u8FCE\u4F7F\u7528 NodeAuth Bot\uFF01\n\u8BF7\u4ECE\u7F51\u9875\u7AEF\u53D1\u8D77\u767B\u5F55\u8BF7\u6C42\u3002");
      return c.json({ ok: true });
    }
    let origin;
    if (c.env.OAUTH_TELEGRAM_BOT_DOMAIN) {
      origin = `https://${c.env.OAUTH_TELEGRAM_BOT_DOMAIN.replace(/^https?:\/\//, "")}`;
    } else {
      const url = new URL(c.req.url);
      origin = `${url.protocol}//${url.hostname}`;
      if (!origin.startsWith("https://") && !origin.includes("localhost")) {
        origin = origin.replace("http:", "https:");
      }
    }
    const callbackUrl = `${origin}/callback/telegram?state=${state}`;
    await sendTelegramMessage(token, chatId, "\u8BF7\u70B9\u51FB\u4E0B\u65B9\u6309\u94AE\u5B8C\u6210\u767B\u5F55\u9A8C\u8BC1\uFF1A", {
      inline_keyboard: [[
        {
          text: "\u{1F510} \u786E\u8BA4\u767B\u5F55",
          login_url: { url: callbackUrl, request_write_access: true }
        }
      ]]
    });
  }
  return c.json({ ok: true });
});
async function sendTelegramMessage(token, chatId, text3, replyMarkup) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text3,
      reply_markup: replyMarkup
    })
  });
}
var telegramRoutes_default = telegram;

// ../src/features/tools/toolsRoutes.ts
import { Hono as Hono5 } from "hono";
var tools = new Hono5();
tools.use("/*", authMiddleware);
tools.get("/server-time", (c) => {
  return c.json({ success: true, time: Date.now() });
});
var toolsRoutes_default = tools;

// ../src/features/share/shareRoutes.ts
import { Hono as Hono6 } from "hono";

// ../src/features/share/shareService.ts
init_config();

// ../src/shared/db/repositories/shareRepository.ts
import { and as and5, count, desc as desc7, eq as eq10, gt, inArray as inArray3, isNull as isNull2, lt as lt2, lte, sql as sql2 } from "drizzle-orm";
var ACTIVE_SHARE_REPLACE_MAX_ATTEMPTS = 3;
function createActiveShareKey(ownerId, vaultItemId) {
  return `${ownerId}:${vaultItemId}`;
}
function getOwnerCandidates(ownerId, ownerAliases = []) {
  return Array.from(new Set([ownerId, ...ownerAliases].filter((value) => typeof value === "string" && value.trim() !== "").map((value) => value.trim())));
}
function createOwnerCondition(ownerColumn, ownerId, ownerAliases = []) {
  const ownerCandidates = getOwnerCandidates(ownerId, ownerAliases);
  return ownerCandidates.length > 1 ? inArray3(ownerColumn, ownerCandidates) : eq10(ownerColumn, ownerId);
}
function isUniqueConflict(error) {
  const err = error;
  const msg = err.message?.toLowerCase() || "";
  const code = String(err.code || "").toLowerCase();
  return msg.includes("unique") || msg.includes("duplicate") || code === "er_dup_entry" || code === "23505" || code === "2067";
}
var ShareRepository = class {
  constructor(db) {
    this.db = db;
  }
  async createShareLink(input) {
    await this.db.insert(shareLinks4).values(input);
    return await this.findByIdForOwner(input.id, input.ownerId);
  }
  async findByTokenHash(tokenHash) {
    const result = await this.db.select().from(shareLinks4).where(eq10(shareLinks4.tokenHash, tokenHash)).limit(1);
    return result[0] || null;
  }
  async findByIdForOwner(id, ownerId, ownerAliases = []) {
    const result = await this.db.select().from(shareLinks4).where(and5(eq10(shareLinks4.id, id), createOwnerCondition(shareLinks4.ownerId, ownerId, ownerAliases))).limit(1);
    return result[0] || null;
  }
  async listForOwner(ownerId, ownerAliases = []) {
    return await this.db.select().from(shareLinks4).where(createOwnerCondition(shareLinks4.ownerId, ownerId, ownerAliases)).orderBy(desc7(shareLinks4.createdAt));
  }
  async revokeForOwner(id, ownerId, revokedAt, ownerAliases = []) {
    const existing = await this.findByIdForOwner(id, ownerId, ownerAliases);
    if (!existing || existing.revokedAt !== null && existing.revokedAt !== void 0) {
      return false;
    }
    await this.db.update(shareLinks4).set({ revokedAt }).where(and5(eq10(shareLinks4.id, id), createOwnerCondition(shareLinks4.ownerId, ownerId, ownerAliases), isNull2(shareLinks4.revokedAt)));
    return true;
  }
  async createReplacingShareLink(input) {
    const revokedAt = Number(input.createdAt);
    const activeShareKey = createActiveShareKey(input.ownerId, input.vaultItemId);
    const replacedSharesById = /* @__PURE__ */ new Map();
    for (let attempt = 0; attempt < ACTIVE_SHARE_REPLACE_MAX_ATTEMPTS; attempt += 1) {
      for (const share2 of await this.revokeActiveForOwnerVaultItem(input.ownerId, input.vaultItemId, revokedAt)) {
        replacedSharesById.set(share2.id, share2);
      }
      try {
        const share2 = await this.createShareLink({
          ...input,
          activeShareKey
        });
        return { share: share2, replacedShares: Array.from(replacedSharesById.values()) };
      } catch (error) {
        if (!isUniqueConflict(error) || attempt === ACTIVE_SHARE_REPLACE_MAX_ATTEMPTS - 1) {
          throw error;
        }
      }
    }
    throw new Error("share_replace_conflict");
  }
  async revokeActiveForOwnerVaultItem(ownerId, vaultItemId, revokedAt) {
    const activeShares = await this.db.select().from(shareLinks4).where(and5(
      eq10(shareLinks4.ownerId, ownerId),
      eq10(shareLinks4.vaultItemId, vaultItemId),
      isNull2(shareLinks4.revokedAt),
      gt(shareLinks4.expiresAt, revokedAt)
    ));
    await this.db.update(shareLinks4).set({ revokedAt, activeShareKey: null }).where(and5(
      eq10(shareLinks4.ownerId, ownerId),
      eq10(shareLinks4.vaultItemId, vaultItemId),
      isNull2(shareLinks4.revokedAt)
    ));
    return activeShares;
  }
  async markAccessed(id, accessedAt) {
    await this.db.update(shareLinks4).set({
      lastAccessedAt: accessedAt,
      accessCount: sql2`coalesce(${shareLinks4.accessCount}, 0) + 1`
    }).where(eq10(shareLinks4.id, id));
  }
  async insertAuditEvent(input) {
    await this.db.insert(shareAuditEvents4).values(input);
  }
  async findExpiredSharesForCleanup(now) {
    return await this.db.select().from(shareLinks4).where(and5(lte(shareLinks4.expiresAt, now), isNull2(shareLinks4.revokedAt)));
  }
  async insertExpiredAuditEventIfMissing(share2, eventAt) {
    const existing = await this.db.select({ count: count() }).from(shareAuditEvents4).where(and5(eq10(shareAuditEvents4.shareId, share2.id), eq10(shareAuditEvents4.eventType, "expired")));
    if (Number(existing[0]?.count || 0) > 0) {
      return false;
    }
    await this.db.insert(shareAuditEvents4).values({
      id: `share-audit-${crypto.randomUUID()}`,
      shareId: share2.id,
      eventType: "expired",
      actorType: "system",
      eventAt,
      ownerId: share2.ownerId,
      ipHash: null,
      userAgentHash: null,
      metadata: JSON.stringify({
        expiredAt: eventAt,
        expiresAt: share2.expiresAt,
        status: "expired"
      })
    });
    return true;
  }
  async deleteStaleRateLimits(cutoff) {
    const conditions = lt2(shareRateLimits4.lastAttemptAt, cutoff);
    const countRes = await this.db.select().from(shareRateLimits4).where(conditions);
    await this.db.delete(shareRateLimits4).where(conditions);
    return countRes.length;
  }
  async enforceRateLimit(input) {
    const now = input.now ?? Date.now();
    const existing = await this.db.select().from(shareRateLimits4).where(eq10(shareRateLimits4.key, input.key)).limit(1);
    const current = existing[0];
    if (!current) {
      await this.db.insert(shareRateLimits4).values({
        key: input.key,
        shareId: input.shareId,
        attempts: 1,
        windowStartedAt: now,
        lastAttemptAt: now,
        lockedUntil: null
      });
      return { allowed: true, attempts: 1, lockedUntil: null };
    }
    if (current.lockedUntil && current.lockedUntil > now) {
      return { allowed: false, attempts: current.attempts || 0, lockedUntil: current.lockedUntil };
    }
    const windowExpired = now - current.windowStartedAt >= input.windowMs;
    const attempts = windowExpired ? 1 : (current.attempts || 0) + 1;
    const lockedUntil = attempts > input.maxAttempts ? now + input.lockMs : null;
    await this.db.update(shareRateLimits4).set({
      shareId: input.shareId,
      attempts,
      windowStartedAt: windowExpired ? now : current.windowStartedAt,
      lastAttemptAt: now,
      lockedUntil
    }).where(eq10(shareRateLimits4.key, input.key));
    return {
      allowed: lockedUntil === null,
      attempts,
      lockedUntil
    };
  }
};

// ../src/features/share/shareService.ts
init_otp();
init_logger();

// ../src/features/share/shareSecurity.ts
init_config();

// ../src/features/share/shareTypes.ts
var SHARE_TOKEN_BYTES = 32;
var SHARE_ACCESS_CODE_BYTES = 16;
var SHARE_DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;
var SHARE_MAX_TTL_SECONDS = 30 * 24 * 60 * 60;
var SHARE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1e3;
var SHARE_RATE_LIMIT_MAX_ATTEMPTS = 5;
var SHARE_RATE_LIMIT_LOCK_MS = 15 * 60 * 1e3;
var SHARE_RATE_LIMIT_RETENTION_MS = SHARE_RATE_LIMIT_WINDOW_MS + SHARE_RATE_LIMIT_LOCK_MS;

// ../src/features/share/shareSecurity.ts
var textEncoder = new TextEncoder();
function encodeBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function constantTimeEqual(left, right) {
  const leftBytes = textEncoder.encode(left);
  const rightBytes = textEncoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < maxLength; index += 1) {
    const leftByte = leftBytes[index] ?? 0;
    const rightByte = rightBytes[index] ?? 0;
    mismatch |= leftByte ^ rightByte;
  }
  return mismatch === 0;
}
function getRandomBytes(byteLength) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytes;
}
function generateShareToken() {
  return encodeBase64Url(getRandomBytes(SHARE_TOKEN_BYTES));
}
function generateAccessCode() {
  return encodeBase64Url(getRandomBytes(SHARE_ACCESS_CODE_BYTES));
}
async function hashShareSecret(pepper, purpose, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(`${purpose}:${value}`)
  );
  return encodeBase64Url(new Uint8Array(signature));
}
async function verifyShareSecret(pepper, purpose, value, hash) {
  const expectedHash = await hashShareSecret(pepper, purpose, value);
  return constantTimeEqual(expectedHash, hash);
}
function buildShareUrl(publicOrigin, token) {
  const origin = normalizePublicOrigin(publicOrigin);
  return new URL(`/share/${token}`, origin).toString();
}
function normalizePublicOrigin(publicOrigin) {
  let parsedUrl;
  try {
    parsedUrl = new URL(publicOrigin);
  } catch {
    throw new AppError("invalid_public_origin", 500);
  }
  const isHttps = parsedUrl.protocol === "https:";
  const isLocalHttp = parsedUrl.protocol === "http:" && (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "[::1]" || parsedUrl.hostname === "::1");
  if (!isHttps && !isLocalHttp) {
    throw new AppError("invalid_public_origin", 500);
  }
  return parsedUrl.origin;
}
function getSharePublicHeaders() {
  return {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
    "Referrer-Policy": "no-referrer"
  };
}
function getShareSecretPepper(env) {
  if (env.SHARE_SECRET_PEPPER) {
    return env.SHARE_SECRET_PEPPER;
  }
  if (env.JWT_SECRET) {
    return env.JWT_SECRET;
  }
  throw new AppError("missing_share_secret_pepper", 500);
}
function clampShareTtlSeconds(ttlSeconds) {
  if (!Number.isFinite(ttlSeconds)) {
    return SHARE_DEFAULT_TTL_SECONDS;
  }
  const normalized = Math.max(1, Math.floor(ttlSeconds));
  return Math.min(normalized, SHARE_MAX_TTL_SECONDS);
}

// ../src/features/share/shareService.ts
var textEncoder2 = new TextEncoder();
function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function toMetadata(value) {
  return JSON.stringify(value);
}
function toShareStatus(share2, now) {
  return share2.revokedAt != null ? "revoked" : Number(share2.expiresAt) <= now ? "expired" : "active";
}
function getOwnerCandidates2(ownerId, ownerAliases = []) {
  return Array.from(new Set([ownerId, ...ownerAliases].filter((value) => typeof value === "string" && value.trim() !== "").map((value) => value.trim())));
}
function resolveEffectiveOwnerId(ownerId, ownerAliases, vaultItem) {
  const createdBy = typeof vaultItem.createdBy === "string" ? vaultItem.createdBy.trim() : "";
  return createdBy && getOwnerCandidates2(ownerId, ownerAliases).includes(createdBy) ? createdBy : ownerId;
}
function buildOptionalShareUrl(publicOrigin, rawToken) {
  if (!publicOrigin) {
    return void 0;
  }
  try {
    return buildShareUrl(publicOrigin, rawToken);
  } catch (error) {
    logger.warn(`[Share] Could not build public share URL: ${error.message}`);
    return void 0;
  }
}
var ShareService = class {
  constructor(env, vaultRepository, shareRepository) {
    this.env = env;
    this.vaultRepository = vaultRepository;
    this.shareRepository = shareRepository;
  }
  toOwnerMetadataView(share2, vaultItem, now, publicUrl) {
    return {
      id: share2.id,
      item: {
        id: vaultItem.id,
        service: vaultItem.service,
        account: vaultItem.account
      },
      status: toShareStatus(share2, now),
      createdAt: String(share2.createdAt),
      expiresAt: String(share2.expiresAt),
      revokedAt: share2.revokedAt != null ? String(share2.revokedAt) : null,
      lastAccessedAt: share2.lastAccessedAt != null ? String(share2.lastAccessedAt) : null,
      accessCount: Number(share2.accessCount || 0),
      ...publicUrl ? { publicUrl } : {}
    };
  }
  async createShare(input) {
    if (!input.ownerId || !input.vaultItemId) {
      throw new AppError("share_item_inaccessible", 404);
    }
    const now = input.now ?? Date.now();
    const ttlSeconds = clampShareTtlSeconds(input.ttlSeconds ?? SHARE_DEFAULT_TTL_SECONDS);
    const expiresAt = input.expiresAt ?? now + ttlSeconds * 1e3;
    if (expiresAt <= now || expiresAt > now + SHARE_MAX_TTL_SECONDS * 1e3) {
      throw new AppError("share_item_inaccessible", 404);
    }
    const vaultItem = await this.vaultRepository.findActiveByIdForOwner(input.vaultItemId, input.ownerId, input.ownerAliases);
    if (!vaultItem) {
      throw new AppError("share_item_inaccessible", 404);
    }
    const ownerId = resolveEffectiveOwnerId(input.ownerId, input.ownerAliases, vaultItem);
    const rawToken = generateShareToken();
    const rawAccessCode = generateAccessCode();
    const pepper = getShareSecretPepper(this.env);
    const tokenHash = await hashShareSecret(pepper, "share-token", rawToken);
    const accessCodeHash = await hashShareSecret(pepper, "share-access-code", rawAccessCode);
    const shareId = createId("share");
    const { share: share2, replacedShares } = await this.shareRepository.createReplacingShareLink({
      id: shareId,
      vaultItemId: input.vaultItemId,
      ownerId,
      tokenHash,
      accessCodeHash,
      expiresAt,
      revokedAt: null,
      createdAt: now,
      lastAccessedAt: null,
      accessCount: 0
    });
    for (const replacedShare of replacedShares) {
      await this.shareRepository.insertAuditEvent({
        id: createId("share-audit"),
        shareId: replacedShare.id,
        eventType: "revoked",
        actorType: "owner",
        eventAt: now,
        ownerId,
        ipHash: null,
        userAgentHash: null,
        metadata: toMetadata({
          revokedAt: now,
          reason: "latest_share_wins"
        })
      });
    }
    const publicOrigin = input.publicOrigin || this.env.NODEAUTH_PUBLIC_ORIGIN;
    const publicUrl = buildOptionalShareUrl(publicOrigin, rawToken);
    await this.shareRepository.insertAuditEvent({
      id: createId("share-audit"),
      shareId: share2.id,
      eventType: "created",
      actorType: "owner",
      eventAt: now,
      ownerId,
      ipHash: null,
      userAgentHash: null,
      metadata: toMetadata({
        vaultItemId: input.vaultItemId,
        expiresAt
      })
    });
    return {
      share: {
        id: share2.id,
        ownerId: share2.ownerId,
        vaultItemId: share2.vaultItemId,
        tokenHash: share2.tokenHash,
        accessCodeHash: share2.accessCodeHash,
        status: share2.revokedAt ? "revoked" : share2.expiresAt <= now ? "expired" : "active",
        expiresAt: String(share2.expiresAt),
        revokedAt: share2.revokedAt ? String(share2.revokedAt) : null,
        createdAt: String(share2.createdAt),
        updatedAt: String(share2.createdAt),
        publicUrl
      },
      rawToken,
      rawAccessCode
    };
  }
  async createShareForOwner(input) {
    const created = await this.createShare(input);
    const vaultItem = await this.vaultRepository.findActiveByIdForOwner(input.vaultItemId, created.share.ownerId, input.ownerAliases);
    if (!vaultItem) {
      throw new AppError("share_item_inaccessible", 404);
    }
    return {
      ...this.toOwnerMetadataView(created.share, vaultItem, input.now ?? Date.now(), created.share.publicUrl),
      rawToken: created.rawToken,
      rawAccessCode: created.rawAccessCode
    };
  }
  async createSharesForOwnerBatch(input) {
    const batchNow = input.now ?? Date.now();
    const successes = [];
    const failures = [];
    for (const [requestIndex, vaultItemId] of input.vaultItemIds.entries()) {
      try {
        const share2 = await this.createShareForOwner({
          ownerId: input.ownerId,
          ownerAliases: input.ownerAliases,
          vaultItemId,
          ttlSeconds: input.ttlSeconds,
          expiresAt: input.expiresAt,
          now: batchNow,
          publicOrigin: input.publicOrigin
        });
        successes.push({ requestIndex, share: share2 });
      } catch {
        failures.push({ requestIndex, error: "could_not_create_share" });
      }
    }
    return { successes, failures };
  }
  async listSharesForOwner(ownerId, now = Date.now(), ownerAliases = []) {
    const shares = await this.shareRepository.listForOwner(ownerId, ownerAliases);
    const views = [];
    for (const share2 of shares) {
      const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share2.vaultItemId, share2.ownerId, ownerAliases);
      if (!vaultItem) {
        continue;
      }
      views.push(this.toOwnerMetadataView(share2, vaultItem, now));
    }
    return views;
  }
  async getShareForOwner(ownerId, shareId, now = Date.now(), ownerAliases = []) {
    const share2 = await this.shareRepository.findByIdForOwner(shareId, ownerId, ownerAliases);
    if (!share2) {
      throw new AppError("share_item_inaccessible", 404);
    }
    const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share2.vaultItemId, share2.ownerId, ownerAliases);
    if (!vaultItem) {
      throw new AppError("share_item_inaccessible", 404);
    }
    return this.toOwnerMetadataView(share2, vaultItem, now);
  }
  async revokeShareForOwner(ownerId, shareId, now = Date.now(), ownerAliases = []) {
    const share2 = await this.shareRepository.findByIdForOwner(shareId, ownerId, ownerAliases);
    if (!share2) {
      throw new AppError("share_item_inaccessible", 404);
    }
    const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share2.vaultItemId, share2.ownerId, ownerAliases);
    if (!vaultItem) {
      throw new AppError("share_item_inaccessible", 404);
    }
    const revoked = await this.shareRepository.revokeForOwner(shareId, ownerId, now, ownerAliases);
    if (!revoked) {
      throw new AppError("share_item_inaccessible", 404);
    }
    await this.shareRepository.insertAuditEvent({
      id: createId("share-audit"),
      shareId,
      eventType: "revoked",
      actorType: "owner",
      eventAt: now,
      ownerId: share2.ownerId,
      ipHash: null,
      userAgentHash: null,
      metadata: toMetadata({ revokedAt: now })
    });
    const revokedShare = {
      ...share2,
      revokedAt: now
    };
    return this.toOwnerMetadataView(revokedShare, vaultItem, now);
  }
  async revokeShare(ownerId, shareId, now = Date.now()) {
    const revoked = await this.shareRepository.revokeForOwner(shareId, ownerId, now);
    if (!revoked) {
      throw new AppError("share_item_inaccessible", 404);
    }
    await this.shareRepository.insertAuditEvent({
      id: createId("share-audit"),
      shareId,
      eventType: "revoked",
      actorType: "owner",
      eventAt: now,
      ownerId,
      ipHash: null,
      userAgentHash: null,
      metadata: toMetadata({ revokedAt: now })
    });
  }
  async cleanupShareState(now = Date.now()) {
    const expiredShares = await this.shareRepository.findExpiredSharesForCleanup(now);
    let expiredSharesMarked = 0;
    for (const share2 of expiredShares) {
      const inserted = await this.shareRepository.insertExpiredAuditEventIfMissing(share2, now);
      if (inserted) {
        expiredSharesMarked += 1;
      }
    }
    const staleRateLimitCutoff = now - SHARE_RATE_LIMIT_RETENTION_MS;
    const staleRateLimitRowsDeleted = await this.shareRepository.deleteStaleRateLimits(staleRateLimitCutoff);
    return {
      expiredSharesMarked,
      staleRateLimitRowsDeleted,
      ranAt: now
    };
  }
  async resolveShareAccess(input) {
    const now = input.now ?? Date.now();
    const pepper = getShareSecretPepper(this.env);
    const publicHeaders = getSharePublicHeaders();
    const tokenHash = await hashShareSecret(pepper, "share-token", input.token);
    const share2 = await this.shareRepository.findByTokenHash(tokenHash);
    if (!share2) {
      return { accessible: false, status: "revoked", reason: "inaccessible", share: null, itemView: null, publicHeaders };
    }
    if (share2.revokedAt !== null && share2.revokedAt !== void 0) {
      return { accessible: false, status: "revoked", reason: "inaccessible", share: null, itemView: null, publicHeaders };
    }
    if (share2.expiresAt <= now) {
      await this.shareRepository.insertAuditEvent({
        id: createId("share-audit"),
        shareId: share2.id,
        eventType: "expired",
        actorType: "system",
        eventAt: now,
        ownerId: share2.ownerId,
        ipHash: null,
        userAgentHash: null,
        metadata: toMetadata({
          expiredAt: now,
          expiresAt: share2.expiresAt,
          status: "expired"
        })
      });
      return { accessible: false, status: "expired", reason: "inaccessible", share: null, itemView: null, publicHeaders };
    }
    const vaultItem = await this.vaultRepository.findActiveByIdForOwner(share2.vaultItemId, share2.ownerId);
    if (!vaultItem) {
      return { accessible: false, status: "revoked", reason: "inaccessible", share: null, itemView: null, publicHeaders };
    }
    const accessCode = input.accessCode || "";
    const accessCodeOk = await verifyShareSecret(pepper, "share-access-code", accessCode, share2.accessCodeHash);
    if (!accessCodeOk) {
      return { accessible: false, status: "active", reason: "inaccessible", share: null, itemView: null, publicHeaders };
    }
    const decryptedSecret = await decryptField(vaultItem.secret, this.env.ENCRYPTION_KEY || this.env.JWT_SECRET || "");
    const period = Number(vaultItem.period || 30);
    const remainingSeconds = period - Math.floor(now / 1e3) % period;
    const itemView = {
      service: vaultItem.service,
      account: vaultItem.account,
      ...typeof decryptedSecret === "string" && decryptedSecret ? {
        otp: {
          code: await generate(
            decryptedSecret,
            period,
            Number(vaultItem.digits || 6),
            vaultItem.algorithm || "SHA1",
            vaultItem.type || "totp",
            now
          ),
          period,
          remainingSeconds
        }
      } : {}
    };
    await this.shareRepository.markAccessed(share2.id, now);
    await this.shareRepository.insertAuditEvent({
      id: createId("share-audit"),
      shareId: share2.id,
      eventType: "access_granted",
      actorType: "recipient",
      eventAt: now,
      ownerId: share2.ownerId,
      ipHash: null,
      userAgentHash: null,
      metadata: toMetadata({
        accessedAt: now,
        status: "active"
      })
    });
    return {
      accessible: true,
      status: "active",
      share: null,
      itemView,
      publicHeaders
    };
  }
};
function createShareService(env, db = env.DB) {
  const vaultRepository = new VaultRepository(db);
  const shareRepository = new ShareRepository(db);
  return new ShareService(env, vaultRepository, shareRepository);
}

// ../src/shared/middleware/shareRateLimitMiddleware.ts
init_logger();
function createId2(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}
function toMetadata2(value) {
  return JSON.stringify(value);
}
function returnShareInaccessible(c) {
  for (const [name, value] of Object.entries(getSharePublicHeaders())) {
    c.header(name, value);
  }
  return c.json({ success: false, message: "share_inaccessible", data: null }, 404);
}
function firstNonEmptyHeader(c, name) {
  const value = c.req.header(name)?.trim();
  return value || null;
}
function resolveShareRateLimitClientIp(c) {
  const cloudflareIp = firstNonEmptyHeader(c, "CF-Connecting-IP");
  if (cloudflareIp) {
    return cloudflareIp;
  }
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",").map((value) => value.trim()).find(Boolean);
  if (forwardedFor) {
    return forwardedFor;
  }
  return firstNonEmptyHeader(c, "x-real-ip") || firstNonEmptyHeader(c, "x-nf-client-connection-ip") || firstNonEmptyHeader(c, "client-ip") || "unknown";
}
var shareRateLimit = (options) => {
  return async (c, next) => {
    const db = c.env.DB;
    if (!db) {
      logger.warn("[ShareRateLimit] access blocked");
      return returnShareInaccessible(c);
    }
    try {
      const rawToken = c.req.param("token") || "";
      const pepper = getShareSecretPepper(c.env);
      const tokenHash = rawToken ? await hashShareSecret(pepper, "share-token", rawToken) : "missing-token";
      const key = options?.keyBuilder ? options.keyBuilder(c) : [
        "share",
        resolveShareRateLimitClientIp(c),
        "share-public-access",
        tokenHash
      ].filter(Boolean).join(":");
      const repository = new ShareRepository(db);
      const decision = await repository.enforceRateLimit({
        key,
        shareId: tokenHash,
        windowMs: SHARE_RATE_LIMIT_WINDOW_MS,
        maxAttempts: SHARE_RATE_LIMIT_MAX_ATTEMPTS,
        lockMs: SHARE_RATE_LIMIT_LOCK_MS
      });
      if (!decision.allowed) {
        const share2 = await repository.findByTokenHash(tokenHash);
        if (share2) {
          await repository.insertAuditEvent({
            id: createId2("share-audit"),
            shareId: share2.id,
            eventType: "access_denied_threshold",
            actorType: "recipient",
            eventAt: Date.now(),
            ownerId: share2.ownerId,
            ipHash: null,
            userAgentHash: null,
            metadata: toMetadata2({
              attempts: decision.attempts,
              lockedUntil: decision.lockedUntil ?? null,
              windowMs: SHARE_RATE_LIMIT_WINDOW_MS
            })
          });
        }
        logger.warn("[ShareRateLimit] access blocked");
        return returnShareInaccessible(c);
      }
    } catch {
      logger.warn("[ShareRateLimit] access blocked");
      return returnShareInaccessible(c);
    }
    await next();
  };
};

// ../src/features/share/shareRoutes.ts
init_logger();
var share = new Hono6();
var getService3 = (c) => createShareService(c.env);
var getPublicOrigin = (c) => {
  const configuredOrigin = c.env?.NODEAUTH_PUBLIC_ORIGIN;
  if (typeof configuredOrigin === "string" && configuredOrigin.trim() !== "") {
    try {
      return normalizePublicOrigin(configuredOrigin);
    } catch (error) {
      logger.warn(`[Share] Ignoring invalid NODEAUTH_PUBLIC_ORIGIN: ${error.message}`);
    }
  }
  return new URL(c.req.url).origin;
};
var getOwnerIdentity = (c) => {
  const user = c.get("user") || {};
  const ownerId = user.email || user.id;
  const ownerAliases = Array.from(new Set([ownerId, user.email, user.id, user.username].filter((value) => typeof value === "string" && value.trim() !== "").map((value) => value.trim())));
  return { ownerId, ownerAliases };
};
share.post("/", authMiddleware, async (c) => {
  const { ownerId, ownerAliases } = getOwnerIdentity(c);
  const body = await c.req.json().catch(() => ({}));
  if (typeof body.vaultItemId !== "string" || body.vaultItemId.trim() === "") {
    return c.json({ success: false, error: "vaultItemId is required" }, 400);
  }
  const publicOrigin = getPublicOrigin(c);
  const service = getService3(c);
  const ttlSeconds = Number.isFinite(body.ttlSeconds) ? body.ttlSeconds : void 0;
  const expiresAt = Number.isFinite(body.expiresAt) ? body.expiresAt : void 0;
  const share2 = await service.createShareForOwner({
    ownerId,
    ownerAliases,
    vaultItemId: body.vaultItemId,
    ttlSeconds,
    expiresAt,
    publicOrigin
  });
  return c.json({ success: true, share: share2 });
});
share.get("/", authMiddleware, async (c) => {
  const { ownerId, ownerAliases } = getOwnerIdentity(c);
  const service = getService3(c);
  const shares = await service.listSharesForOwner(ownerId, Date.now(), ownerAliases);
  return c.json({ success: true, shares });
});
share.post("/batch", authMiddleware, async (c) => {
  const { ownerId, ownerAliases } = getOwnerIdentity(c);
  const body = await c.req.json().catch(() => ({}));
  if (!Array.isArray(body.vaultItemIds) || body.vaultItemIds.length === 0 || body.vaultItemIds.some((id) => typeof id !== "string" || id.trim() === "")) {
    return c.json({ success: false, error: "vaultItemIds must be a non-empty array of strings" }, 400);
  }
  if (body.vaultItemIds.length > 50) {
    return c.json({ success: false, error: "vaultItemIds cannot exceed 50" }, 400);
  }
  const publicOrigin = getPublicOrigin(c);
  const service = getService3(c);
  const ttlSeconds = Number.isFinite(body.ttlSeconds) ? body.ttlSeconds : void 0;
  const expiresAt = Number.isFinite(body.expiresAt) ? body.expiresAt : void 0;
  const result = await service.createSharesForOwnerBatch({
    ownerId,
    ownerAliases,
    vaultItemIds: body.vaultItemIds,
    ttlSeconds,
    expiresAt,
    publicOrigin
  });
  return c.json({ success: true, result });
});
share.get("/:id", authMiddleware, async (c) => {
  const { ownerId, ownerAliases } = getOwnerIdentity(c);
  const service = getService3(c);
  const share2 = await service.getShareForOwner(ownerId, c.req.param("id"), Date.now(), ownerAliases);
  return c.json({ success: true, share: share2 });
});
share.delete("/:id", authMiddleware, async (c) => {
  const { ownerId, ownerAliases } = getOwnerIdentity(c);
  const service = getService3(c);
  const share2 = await service.revokeShareForOwner(ownerId, c.req.param("id"), Date.now(), ownerAliases);
  return c.json({
    success: true,
    share: share2,
    message: "Share link revoked. Future access is blocked, but NodeAuth cannot retract credentials already viewed or copied."
  });
});
share.post("/public/:token/access", shareRateLimit(), async (c) => {
  const token = c.req.param("token");
  const body = await c.req.json().catch(() => ({}));
  const accessCode = typeof body.accessCode === "string" ? body.accessCode : void 0;
  const service = getService3(c);
  const decision = await service.resolveShareAccess({
    token,
    accessCode,
    requestOrigin: new URL(c.req.url).origin
  });
  for (const [name, value] of Object.entries(decision.publicHeaders || getSharePublicHeaders())) {
    c.header(name, value);
  }
  if (!decision.accessible) {
    return c.json({ success: false, message: "share_inaccessible", data: null }, 404);
  }
  return c.json({ success: true, data: decision.itemView });
});
var shareRoutes_default = share;

// ../src/features/share/sharePublicPage.ts
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function toSafeScriptJson(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
function renderSharePublicPage(token) {
  const safeToken = escapeHtml(token);
  const tokenJson = toSafeScriptJson(token);
  const headers = {
    ...getSharePublicHeaders(),
    "Content-Type": "text/html; charset=utf-8",
    "X-Robots-Tag": "noindex, nofollow, noarchive"
  };
  return new Response(`<!doctype html>
<html lang="zh-CN">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex,nofollow,noarchive">
    <title>NodeAuth Share</title>
    <style>
        :root {
            color-scheme: light dark;
            --bg: #f7f8fb;
            --panel: #ffffff;
            --text: #1f2937;
            --muted: #6b7280;
            --border: #d7dde8;
            --primary: #2563eb;
            --primary-strong: #1d4ed8;
            --danger: #b42318;
            --success: #067647;
            --code: #101828;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg: #101418;
                --panel: #171c22;
                --text: #eef2f6;
                --muted: #a7b0bd;
                --border: #303846;
                --primary: #6da8ff;
                --primary-strong: #8bbcff;
                --danger: #ff9b8f;
                --success: #7bdca4;
                --code: #ffffff;
            }
        }
        * {
            box-sizing: border-box;
        }
        body {
            margin: 0;
            min-height: 100vh;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: var(--bg);
            color: var(--text);
        }
        main {
            width: min(100%, 560px);
            margin: 0 auto;
            padding: 48px 20px;
        }
        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 24px;
            font-weight: 700;
            font-size: 20px;
        }
        .mark {
            width: 32px;
            height: 32px;
            border-radius: 8px;
            background: var(--primary);
            color: #fff;
            display: grid;
            place-items: center;
            font-weight: 800;
        }
        .panel {
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--panel);
            padding: 24px;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
        }
        h1 {
            margin: 0 0 8px;
            font-size: 24px;
            line-height: 1.25;
        }
        p {
            margin: 0;
            color: var(--muted);
            line-height: 1.6;
        }
        form {
            margin-top: 24px;
            display: grid;
            gap: 12px;
        }
        label {
            font-weight: 600;
        }
        input {
            width: 100%;
            min-height: 44px;
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 0 12px;
            font: inherit;
            color: var(--text);
            background: transparent;
        }
        button {
            min-height: 44px;
            border: 0;
            border-radius: 6px;
            padding: 0 16px;
            font: inherit;
            font-weight: 700;
            color: #fff;
            background: var(--primary);
            cursor: pointer;
        }
        button:hover {
            background: var(--primary-strong);
        }
        button:disabled {
            opacity: 0.65;
            cursor: wait;
        }
        .status {
            margin-top: 16px;
            min-height: 24px;
            font-weight: 600;
        }
        .status.error {
            color: var(--danger);
        }
        .status.success {
            color: var(--success);
        }
        .result {
            display: none;
            margin-top: 20px;
            border-top: 1px solid var(--border);
            padding-top: 20px;
        }
        .result.visible {
            display: grid;
            gap: 14px;
        }
        .field {
            display: grid;
            gap: 4px;
        }
        .field span {
            color: var(--muted);
            font-size: 13px;
            font-weight: 600;
        }
        .field strong,
        .otp-code {
            color: var(--code);
            overflow-wrap: anywhere;
        }
        .otp-code {
            font-variant-numeric: tabular-nums;
            font-size: 32px;
            letter-spacing: 0;
            font-weight: 800;
        }
        .token {
            margin-top: 16px;
            font-size: 12px;
            overflow-wrap: anywhere;
        }
        @media (max-width: 480px) {
            main {
                padding: 28px 14px;
            }
            .panel {
                padding: 18px;
            }
        }
    </style>
</head>
<body>
    <main>
        <div class="brand"><div class="mark">N</div><div>NodeAuth</div></div>
        <section class="panel" aria-labelledby="share-title">
            <h1 id="share-title">\u5171\u4EAB\u8D26\u6237\u8BBF\u95EE</h1>
            <p>\u8F93\u5165\u5206\u4EAB\u8005\u63D0\u4F9B\u7684\u8BBF\u95EE\u7801\u67E5\u770B\u6B64\u8D26\u6237\u3002</p>
            <form id="access-form">
                <label for="access-code">\u8BBF\u95EE\u7801</label>
                <input id="access-code" name="accessCode" type="password" autocomplete="one-time-code" required>
                <button id="submit-button" type="submit">\u67E5\u770B\u8D26\u6237</button>
            </form>
            <div id="status" class="status" role="status" aria-live="polite"></div>
            <section id="result" class="result" aria-label="\u5171\u4EAB\u8D26\u6237\u8BE6\u60C5">
                <div class="field"><span>\u670D\u52A1</span><strong id="service"></strong></div>
                <div class="field"><span>\u8D26\u6237</span><strong id="account"></strong></div>
                <div class="field" id="otp-field"><span>\u5F53\u524D\u9A8C\u8BC1\u7801</span><strong id="otp-code" class="otp-code"></strong><p id="otp-meta"></p></div>
                <div class="field" id="password-field"><span>\u5BC6\u7801</span><strong id="password"></strong></div>
            </section>
            <p class="token">Share token: ${safeToken}</p>
        </section>
    </main>
    <script>
        const shareToken = ${tokenJson};
        const form = document.getElementById('access-form');
        const input = document.getElementById('access-code');
        const button = document.getElementById('submit-button');
        const statusEl = document.getElementById('status');
        const resultEl = document.getElementById('result');
        const serviceEl = document.getElementById('service');
        const accountEl = document.getElementById('account');
        const otpFieldEl = document.getElementById('otp-field');
        const otpCodeEl = document.getElementById('otp-code');
        const otpMetaEl = document.getElementById('otp-meta');
        const passwordFieldEl = document.getElementById('password-field');
        const passwordEl = document.getElementById('password');

        function setStatus(message, kind) {
            statusEl.textContent = message;
            statusEl.className = kind ? 'status ' + kind : 'status';
        }

        function showResult(item) {
            serviceEl.textContent = item.service || '';
            accountEl.textContent = item.account || '';
            if (item.otp && item.otp.code) {
                otpFieldEl.style.display = '';
                otpCodeEl.textContent = item.otp.code;
                otpMetaEl.textContent = '\u5237\u65B0\u5468\u671F ' + item.otp.period + ' \u79D2\uFF0C\u5269\u4F59 ' + item.otp.remainingSeconds + ' \u79D2';
            } else {
                otpFieldEl.style.display = 'none';
            }
            if (item.password) {
                passwordFieldEl.style.display = '';
                passwordEl.textContent = item.password;
            } else {
                passwordFieldEl.style.display = 'none';
            }
            resultEl.classList.add('visible');
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const accessCode = input.value.trim();
            if (!accessCode) {
                setStatus('\u8BF7\u8F93\u5165\u8BBF\u95EE\u7801\u3002', 'error');
                return;
            }

            button.disabled = true;
            resultEl.classList.remove('visible');
            setStatus('\u6B63\u5728\u9A8C\u8BC1...', '');

            try {
                const response = await fetch('/api/share/public/' + encodeURIComponent(shareToken) + '/access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accessCode }),
                    credentials: 'omit',
                });
                const body = await response.json().catch(() => null);
                if (!response.ok || !body || body.success !== true) {
                    setStatus('\u5206\u4EAB\u94FE\u63A5\u4E0D\u53EF\u7528\u6216\u8BBF\u95EE\u7801\u9519\u8BEF\u3002', 'error');
                    return;
                }
                showResult(body.data || {});
                setStatus('\u9A8C\u8BC1\u901A\u8FC7\u3002', 'success');
            } catch (error) {
                setStatus('\u65E0\u6CD5\u8BBF\u95EE\u5206\u4EAB\u670D\u52A1\u3002', 'error');
            } finally {
                button.disabled = false;
            }
        });
    </script>
</body>
</html>`, {
    status: 200,
    headers
  });
}

// ../src/features/health/healthRoutes.ts
import { Hono as Hono7 } from "hono";

// ../src/shared/utils/health.ts
var normalizeDomain = (domain) => {
  let d = domain.trim().toLowerCase().replace(/^https?:\/\//, "").split(":")[0].split("/")[0].replace(/\/+$/, "");
  if (d === "127.0.0.1" || d === "192.168.100.100") return "localhost";
  return d;
};
var validateLicense = async (license, currentHost) => {
  if (!license) return { success: false, message: "license_missing" };
  try {
    const clean = license.replace(/[^a-zA-Z0-9+/=]/g, "");
    const decoded = atob(clean);
    const parts = decoded.split("|");
    if (parts.length !== 3) return { success: false, message: "license_invalid_format" };
    const [domain, expiry, signatureBase64] = parts;
    if (normalizeDomain(domain) !== normalizeDomain(currentHost)) {
      return { success: false, message: "license_domain_mismatch" };
    }
    if (Date.now() > parseInt(expiry)) {
      return { success: false, message: "license_expired" };
    }
    const PUBLIC_KEY_HEX = "7c3dfb50523e20b2d7df136631f1a46d5b21cf4fde0824bd6dcdfbdd00ea0a8c";
    const publicKey = await crypto.subtle.importKey(
      "raw",
      new Uint8Array(PUBLIC_KEY_HEX.match(/.{1,2}/g).map((b) => parseInt(b, 16))),
      { name: "Ed25519", namedCurve: "Ed25519" },
      false,
      ["verify"]
    );
    const sigBytes = Uint8Array.from(atob(signatureBase64), (c) => c.charCodeAt(0));
    const dataBytes = new TextEncoder().encode(`${domain}|${expiry}`);
    const isValid = await crypto.subtle.verify("Ed25519", publicKey, sigBytes, dataBytes);
    return isValid ? { success: true } : { success: false, message: "license_invalid_signature" };
  } catch (e) {
    return { success: false, message: "license_invalid_format" };
  }
};
var runHealthCheck = async (env, requestUrl) => {
  const issues = [];
  const passedChecks = [];
  const license = env.NODEAUTH_LICENSE || "";
  let host = env.OAUTH_TELEGRAM_BOT_DOMAIN || "localhost";
  if (requestUrl) {
    try {
      host = new URL(requestUrl).hostname;
    } catch (e) {
    }
  }
  const licenseResult = await validateLicense(license, host);
  if (!licenseResult.success) {
    issues.push({
      field: "NODEAUTH_LICENSE",
      level: "critical",
      message: licenseResult.message,
      suggestion: "license_suggestion",
      deploy_by_worker: "suggestion_deploy_by_worker",
      deploy_by_gitaction: "suggestion_deploy_by_gitaction",
      deploy_by_docker: "suggestion_deploy_by_docker"
    });
  } else {
    passedChecks.push("license_passed");
  }
  const encKey = env.ENCRYPTION_KEY || "";
  if (!encKey || encKey.length < 32) {
    issues.push({
      field: "ENCRYPTION_KEY",
      level: "critical",
      message: "encryption_key_too_short",
      suggestion: "encryption_key_suggestion",
      deploy_by_worker: "suggestion_deploy_by_worker",
      deploy_by_gitaction: "suggestion_deploy_by_gitaction",
      deploy_by_docker: "suggestion_deploy_by_docker"
    });
  } else {
    passedChecks.push("encryption_key_passed");
  }
  const jwtSecret = env.JWT_SECRET || "";
  if (!jwtSecret || jwtSecret.length < 32) {
    issues.push({
      field: "JWT_SECRET",
      level: "critical",
      message: "jwt_secret_too_short",
      suggestion: "jwt_secret_suggestion",
      deploy_by_worker: "suggestion_deploy_by_worker",
      deploy_by_gitaction: "suggestion_deploy_by_gitaction",
      deploy_by_docker: "suggestion_deploy_by_docker"
    });
  } else {
    passedChecks.push("jwt_secret_passed");
  }
  if (String(env.OAUTH_ALLOW_ALL).toLowerCase() === "true" || env.OAUTH_ALLOW_ALL === "1") {
    issues.push({
      field: "OAUTH_ALLOW_ALL",
      level: "critical",
      message: "oauth_allow_all_enabled",
      suggestion: "oauth_allow_all_suggestion",
      deploy_by_worker: "suggestion_deploy_by_worker",
      deploy_by_gitaction: "suggestion_deploy_by_gitaction",
      deploy_by_docker: "suggestion_deploy_by_docker"
    });
  } else {
    passedChecks.push("oauth_allow_all_passed");
  }
  const allowedUsers = env.OAUTH_ALLOWED_USERS || "";
  if (!allowedUsers || allowedUsers.trim().length === 0) {
    issues.push({
      field: "OAUTH_ALLOWED_USERS",
      level: "error",
      message: "allowed_users_empty",
      suggestion: "allowed_users_suggestion",
      deploy_by_worker: "suggestion_deploy_by_worker",
      deploy_by_gitaction: "suggestion_deploy_by_gitaction",
      deploy_by_docker: "suggestion_deploy_by_docker"
    });
  } else {
    passedChecks.push("allowed_users_passed");
  }
  let hasAtLeastOneProvider = false;
  const providerStatus = {
    github: "none",
    telegram: "none",
    google: "none",
    nodeloc: "none",
    gitee: "none",
    cloudflare: "none"
  };
  if (env.OAUTH_GITHUB_CLIENT_ID || env.OAUTH_GITHUB_CLIENT_SECRET || env.OAUTH_GITHUB_REDIRECT_URI) {
    const missing = [];
    if (!env.OAUTH_GITHUB_CLIENT_ID) missing.push("OAUTH_GITHUB_CLIENT_ID");
    if (!env.OAUTH_GITHUB_CLIENT_SECRET) missing.push("OAUTH_GITHUB_CLIENT_SECRET");
    if (!env.OAUTH_GITHUB_REDIRECT_URI) missing.push("OAUTH_GITHUB_REDIRECT_URI");
    if (missing.length > 0) {
      providerStatus.github = "missing";
      issues.push({
        field: "OAUTH_GITHUB",
        level: "error",
        message: "github_config_incomplete",
        suggestion: "github_config_suggestion",
        deploy_by_worker: "suggestion_deploy_by_worker",
        deploy_by_gitaction: "suggestion_deploy_by_gitaction",
        deploy_by_docker: "suggestion_deploy_by_docker",
        missingFields: missing
      });
    } else {
      hasAtLeastOneProvider = true;
      providerStatus.github = "passed";
    }
  }
  if (env.OAUTH_TELEGRAM_BOT_NAME || env.OAUTH_TELEGRAM_BOT_TOKEN || env.OAUTH_TELEGRAM_WEBHOOK_SECRET) {
    const missing = [];
    if (!env.OAUTH_TELEGRAM_BOT_NAME) missing.push("OAUTH_TELEGRAM_BOT_NAME");
    if (!env.OAUTH_TELEGRAM_BOT_TOKEN) missing.push("OAUTH_TELEGRAM_BOT_TOKEN");
    if (!env.OAUTH_TELEGRAM_WEBHOOK_SECRET) missing.push("OAUTH_TELEGRAM_WEBHOOK_SECRET");
    if (missing.length > 0) {
      providerStatus.telegram = "missing";
      issues.push({
        field: "OAUTH_TELEGRAM",
        level: "error",
        message: "telegram_config_incomplete",
        suggestion: "telegram_config_suggestion",
        deploy_by_worker: "suggestion_deploy_by_worker",
        deploy_by_gitaction: "suggestion_deploy_by_gitaction",
        deploy_by_docker: "suggestion_deploy_by_docker",
        missingFields: missing
      });
    } else {
      hasAtLeastOneProvider = true;
      providerStatus.telegram = "passed";
    }
  }
  if (env.OAUTH_GOOGLE_CLIENT_ID || env.OAUTH_GOOGLE_CLIENT_SECRET || env.OAUTH_GOOGLE_REDIRECT_URI) {
    const missing = [];
    if (!env.OAUTH_GOOGLE_CLIENT_ID) missing.push("OAUTH_GOOGLE_CLIENT_ID");
    if (!env.OAUTH_GOOGLE_CLIENT_SECRET) missing.push("OAUTH_GOOGLE_CLIENT_SECRET");
    if (!env.OAUTH_GOOGLE_REDIRECT_URI) missing.push("OAUTH_GOOGLE_REDIRECT_URI");
    if (missing.length > 0) {
      providerStatus.google = "missing";
      issues.push({
        field: "OAUTH_GOOGLE",
        level: "error",
        message: "google_config_incomplete",
        suggestion: "google_config_suggestion",
        deploy_by_worker: "suggestion_deploy_by_worker",
        deploy_by_gitaction: "suggestion_deploy_by_gitaction",
        deploy_by_docker: "suggestion_deploy_by_docker",
        missingFields: missing
      });
    } else {
      hasAtLeastOneProvider = true;
      providerStatus.google = "passed";
    }
  }
  if (env.OAUTH_NODELOC_CLIENT_ID || env.OAUTH_NODELOC_CLIENT_SECRET || env.OAUTH_NODELOC_REDIRECT_URI) {
    const missing = [];
    if (!env.OAUTH_NODELOC_CLIENT_ID) missing.push("OAUTH_NODELOC_CLIENT_ID");
    if (!env.OAUTH_NODELOC_CLIENT_SECRET) missing.push("OAUTH_NODELOC_CLIENT_SECRET");
    if (!env.OAUTH_NODELOC_REDIRECT_URI) missing.push("OAUTH_NODELOC_REDIRECT_URI");
    if (missing.length > 0) {
      providerStatus.nodeloc = "missing";
      issues.push({
        field: "OAUTH_NODELOC",
        level: "error",
        message: "nodeloc_config_incomplete",
        suggestion: "nodeloc_config_suggestion",
        deploy_by_worker: "suggestion_deploy_by_worker",
        deploy_by_gitaction: "suggestion_deploy_by_gitaction",
        deploy_by_docker: "suggestion_deploy_by_docker",
        missingFields: missing
      });
    } else {
      hasAtLeastOneProvider = true;
      providerStatus.nodeloc = "passed";
    }
  }
  if (env.OAUTH_GITEE_CLIENT_ID || env.OAUTH_GITEE_CLIENT_SECRET || env.OAUTH_GITEE_REDIRECT_URI) {
    const missing = [];
    if (!env.OAUTH_GITEE_CLIENT_ID) missing.push("OAUTH_GITEE_CLIENT_ID");
    if (!env.OAUTH_GITEE_CLIENT_SECRET) missing.push("OAUTH_GITEE_CLIENT_SECRET");
    if (!env.OAUTH_GITEE_REDIRECT_URI) missing.push("OAUTH_GITEE_REDIRECT_URI");
    if (missing.length > 0) {
      providerStatus.gitee = "missing";
      issues.push({
        field: "OAUTH_GITEE",
        level: "error",
        message: "gitee_config_incomplete",
        suggestion: "gitee_config_suggestion",
        deploy_by_worker: "suggestion_deploy_by_worker",
        deploy_by_gitaction: "suggestion_deploy_by_gitaction",
        deploy_by_docker: "suggestion_deploy_by_docker",
        missingFields: missing
      });
    } else {
      hasAtLeastOneProvider = true;
      providerStatus.gitee = "passed";
    }
  }
  if (env.OAUTH_CLOUDFLARE_CLIENT_ID || env.OAUTH_CLOUDFLARE_CLIENT_SECRET || env.OAUTH_CLOUDFLARE_ORG_DOMAIN || env.OAUTH_CLOUDFLARE_REDIRECT_URI) {
    const missing = [];
    if (!env.OAUTH_CLOUDFLARE_CLIENT_ID) missing.push("OAUTH_CLOUDFLARE_CLIENT_ID");
    if (!env.OAUTH_CLOUDFLARE_CLIENT_SECRET) missing.push("OAUTH_CLOUDFLARE_CLIENT_SECRET");
    if (!env.OAUTH_CLOUDFLARE_ORG_DOMAIN) missing.push("OAUTH_CLOUDFLARE_ORG_DOMAIN");
    if (!env.OAUTH_CLOUDFLARE_REDIRECT_URI) missing.push("OAUTH_CLOUDFLARE_REDIRECT_URI");
    if (missing.length > 0) {
      providerStatus.cloudflare = "missing";
      issues.push({
        field: "OAUTH_CLOUDFLARE",
        level: "error",
        message: "cloudflare_config_incomplete",
        suggestion: "cloudflare_config_suggestion",
        deploy_by_worker: "suggestion_deploy_by_worker",
        deploy_by_gitaction: "suggestion_deploy_by_gitaction",
        deploy_by_docker: "suggestion_deploy_by_docker",
        missingFields: missing
      });
    } else {
      hasAtLeastOneProvider = true;
      providerStatus.cloudflare = "passed";
    }
  }
  if (!hasAtLeastOneProvider) {
    issues.push({
      field: "NO_OAUTH_PROVIDER",
      level: "error",
      message: "no_provider_configured",
      suggestion: "no_provider_suggestion",
      deploy_by_worker: "suggestion_deploy_by_worker",
      deploy_by_gitaction: "suggestion_deploy_by_gitaction",
      deploy_by_docker: "suggestion_deploy_by_docker"
    });
  } else {
    passedChecks.push("oauth_provider_configured");
  }
  return {
    passed: issues.length === 0,
    status: issues.length === 0 ? "pass" : "fail",
    issues,
    passedChecks
  };
};

// ../src/features/health/healthRoutes.ts
var health = new Hono7();
health.get("/health-check", async (c) => {
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
  const result = await runHealthCheck(c.env, c.req.url);
  return c.json({
    success: true,
    ...result
  });
});
var healthRoutes_default = health;

// ../src/features/emergency/emergencyRoutes.ts
init_config();
import { Hono as Hono8 } from "hono";
var emergency = new Hono8();
emergency.post("/confirm", authMiddleware, rateLimit({
  windowMs: SECURITY_CONFIG.LOCKOUT_TIME,
  max: SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS
}), async (c) => {
  const { lastFour } = await c.req.json();
  const encryptionKey = c.env.ENCRYPTION_KEY || "";
  if (!lastFour || encryptionKey.slice(-4) !== lastFour) {
    throw new AppError("invalid_emergency_verification", 400);
  }
  const repository = new EmergencyRepository(c.env.DB);
  await repository.confirmEmergency();
  const clientIp = c.req.header("CF-Connecting-IP") || "unknown";
  await resetRateLimit(c, `rl:${clientIp}:/api/emergency/confirm`);
  return c.json({
    success: true,
    message: "emergency_confirmed"
  });
});
var emergencyRoutes_default = emergency;

// ../src/features/auth/wcProxyRoutes.ts
init_config();
import { Hono as Hono9 } from "hono";
var wcProxy = new Hono9();
var proxyRequest = async (targetHost, targetPath, c) => {
  const url = new URL(c.req.url);
  url.hostname = targetHost;
  url.pathname = targetPath;
  url.port = "";
  url.protocol = "https:";
  const headers = new Headers(c.req.raw.headers);
  headers.set("Host", targetHost);
  headers.delete("cf-connecting-ip");
  headers.delete("x-forwarded-for");
  try {
    const res = await fetch(url.toString(), {
      method: c.req.method,
      headers,
      body: c.req.method !== "GET" && c.req.method !== "HEAD" ? await c.req.arrayBuffer() : void 0,
      // @ts-ignore
      redirect: "follow"
    });
    if (res.status === 101) {
      return new Response(null, {
        status: 101,
        statusText: "Switching Protocols",
        headers: res.headers,
        // @ts-ignore - Cloudflare Workers 特有属性
        webSocket: res.webSocket
      });
    }
    return new Response(res.body, res);
  } catch (err) {
    console.error(`[WC Proxy Error] ${targetHost}: ${err.message}`);
    throw new AppError("wc_proxy_connection_failed", 502);
  }
};
wcProxy.all("/relay", (c) => {
  if (c.env.OAUTH_WALLETCONNECT_SELF_PROXY !== "true") throw new AppError("wc_proxy_disabled", 403);
  return proxyRequest("relay.walletconnect.com", "/", c);
});
wcProxy.all("/rpc/*", (c) => {
  if (c.env.OAUTH_WALLETCONNECT_SELF_PROXY !== "true") throw new AppError("wc_proxy_disabled", 403);
  const path = c.req.path.substring(c.req.path.indexOf("/rpc"));
  const targetPath = path.replace("/rpc", "/v1");
  return proxyRequest("rpc.walletconnect.com", targetPath, c);
});
wcProxy.all("/verify/*", (c) => {
  const path = c.req.path.substring(c.req.path.indexOf("/verify"));
  return proxyRequest("verify.walletconnect.com", path.replace("/verify", ""), c);
});
wcProxy.all("/explorer/*", (c) => {
  const path = c.req.path.substring(c.req.path.indexOf("/explorer"));
  return proxyRequest("explorer-api.walletconnect.com", path.replace("/explorer", ""), c);
});
var wcProxyRoutes_default = wcProxy;

// ../src/features/share/sharePrimitives.ts
var SHARE_PRIMITIVES = {
  ShareService,
  createShareService,
  shareRateLimit
};

// ../src/app/index.ts
var app = new Hono10();
app.__sharePrimitives = SHARE_PRIMITIVES;
function redactSharePublicToken(value) {
  return value.replace(
    /\/api\/share\/public\/[^\s/?#]+\/access/g,
    "/api/share/public/[share-token]/access"
  );
}
function normalizeConfiguredOrigin(origin) {
  const trimmed = origin?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed.replace(/\/+$/, "")).origin;
  } catch {
    return null;
  }
}
function resolveApiCorsOrigin(origin, env) {
  if (!origin) {
    return null;
  }
  const trustedOrigin = normalizeConfiguredOrigin(env.NODEAUTH_PUBLIC_ORIGIN);
  if (!trustedOrigin) {
    return null;
  }
  let requestOrigin;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return null;
  }
  return requestOrigin === trustedOrigin ? requestOrigin : null;
}
app.use("*", async (c, next) => {
  if (c.env) {
    await initializeEnv(c.env);
  }
  await next();
});
app.use("*", hLogger((str) => logger.info(redactSharePublicToken(str))));
app.use("/api/*", cors({
  origin: (origin, c) => resolveApiCorsOrigin(origin, c.env),
  credentials: true,
  allowHeaders: ["Content-Type", "Authorization", "X-CSRF-Token"],
  allowMethods: ["POST", "GET", "OPTIONS", "PUT", "DELETE"],
  maxAge: 86400
}));
app.use("*", async (c, next) => {
  const csp = getEffectiveCSP(c.env);
  return secureHeaders({
    crossOriginOpenerPolicy: "same-origin-allow-popups",
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
    xXssProtection: "1; mode=block",
    referrerPolicy: c.req.path.startsWith("/share/") ? "no-referrer" : "strict-origin-when-cross-origin",
    contentSecurityPolicy: csp
  })(c, next);
});
app.get("/api", (c) => c.text("\u{1F510} 2FA Secure Manager API is running!"));
app.use("/api/*", async (c, next) => {
  const path = c.req.path;
  if (path.startsWith("/api/health") || path === "/api/oauth/logout") {
    await next();
    return;
  }
  const securityResult = await runHealthCheck(c.env, c.req.url);
  if (securityResult.status === "fail") {
    return c.json({
      code: 403,
      success: false,
      message: "health_check_failed",
      data: securityResult.issues
    }, 403);
  }
  await next();
});
app.route("/api/health", healthRoutes_default);
app.route("/api/emergency", emergencyRoutes_default);
app.route("/api/oauth", authRoutes_default);
app.route("/api/vault", vaultRoutes_default);
app.route("/api/backups", backupRoutes_default);
app.route("/api/telegram", telegramRoutes_default);
app.route("/api/tools", toolsRoutes_default);
app.route("/api/share", shareRoutes_default);
app.route("/api/oauth/wc-proxy", wcProxyRoutes_default);
app.all("/api/*", (c) => {
  return c.json({ success: false, error: "API Not Found" }, 404);
});
app.get("/share/:token", (c) => {
  return renderSharePublicPage(c.req.param("token"));
});
app.get("*", async (c) => {
  if (c.env && c.env.ASSETS) {
    const res = await c.env.ASSETS.fetch(c.req.raw);
    const path = c.req.path;
    const contentType = res.headers.get("content-type") || "";
    const isStaticAsset = path.startsWith("/assets/") || path === "/sw.js" || /\.(js|mjs|css|png|jpg|jpeg|gif|svg|ico|webmanifest|wasm|json|woff2?|ttf|map)$/i.test(path);
    if (isStaticAsset && contentType.includes("text/html")) {
      logger.warn(`[Static] Prevented SPA fallback for missing asset: ${path}`);
      return new Response("Asset Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-NodeAuth-Source": "Missing-Static-Asset"
        }
      });
    }
    return new Response(res.body, res);
  }
  return c.json({ success: false, error: "Not Found" }, 404);
});
app.onError((err, c) => {
  const statusCode = err.statusCode || err.status || 500;
  if (c.req.path.includes("/files") && (Number(statusCode) === 404 || err.message.includes("404"))) {
    return c.json({ success: true, backups: [] });
  }
  const isAppError = err.name === "AppError";
  let message = err.message || "Internal Server Error";
  if (!isAppError && statusCode >= 500) {
    logger.error(`[CRITICAL ERROR] ${err.stack || err.message}`);
    message = "internal_server_error";
  } else {
    logger.error(`[Server Error] ${err.message}`);
  }
  return c.json({
    code: statusCode,
    success: false,
    message,
    data: null
  }, statusCode);
});
var app_default = app;

// ../src/shared/db/migrator.ts
init_logger();

// ../src/shared/db/dialects.ts
function transformSqlForDialect(sql3, engine2) {
  if (engine2 === "sqlite" || engine2 === "d1") return sql3;
  let res = sql3;
  if (engine2 === "mysql") {
    res = res.replace(/\bINTEGER PRIMARY KEY AUTOINCREMENT\b/gi, "BIGINT AUTO_INCREMENT PRIMARY KEY");
    res = res.replace(/\bINTEGER\b/gi, "BIGINT");
    res = res.replace(/\bkey TEXT PRIMARY KEY\b/gi, "`key` VARCHAR(255) PRIMARY KEY");
    res = res.replace(/\bTEXT PRIMARY KEY\b/gi, "VARCHAR(255) PRIMARY KEY");
    res = res.replace(/\bTEXT\s+DEFAULT\b/gi, "VARCHAR(255) DEFAULT");
    res = res.replace(/\bBLOB\b/gi, "LONGBLOB");
    res = res.replace(/\bINSERT OR REPLACE INTO\b/gi, "REPLACE INTO");
    res = res.replace(/\bCREATE (UNIQUE )?INDEX IF NOT EXISTS\b/gi, "CREATE $1INDEX");
  }
  if (engine2 === "postgres") {
    res = res.replace(/`/g, '"');
    res = res.replace(/\bINTEGER PRIMARY KEY AUTOINCREMENT\b/gi, "BIGSERIAL PRIMARY KEY");
    res = res.replace(/\bINTEGER\b/gi, "BIGINT");
    res = res.replace(/\bTEXT PRIMARY KEY\b/gi, "VARCHAR(255) PRIMARY KEY");
    res = res.replace(/\bBLOB\b/gi, "BYTEA");
    res = res.replace(/\bDATETIME\b/gi, "TIMESTAMP");
    res = res.replace(/\bBOOLEAN DEFAULT (0|1)\b/gi, (match, val) => `BOOLEAN DEFAULT ${val === "1" ? "TRUE" : "FALSE"}`);
    res = res.replace(/\bINSERT OR REPLACE INTO\b/gi, "INSERT INTO");
    res = res.replace(/lower\(([^)]+)\)/gi, "($&)");
  }
  return res;
}

// ../src/shared/db/migrator.ts
var BASE_SCHEMA = [
  // 账号表：存储 2FA 凭据
  `CREATE TABLE IF NOT EXISTS vault (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL,
        account TEXT NOT NULL,
        category TEXT,
        secret TEXT NOT NULL,
        digits INTEGER DEFAULT 6,
        period INTEGER DEFAULT 30,
        type TEXT DEFAULT 'totp',
        algorithm TEXT DEFAULT 'SHA1',
        counter INTEGER DEFAULT 0,
        created_at INTEGER,
        created_by TEXT,
        updated_at INTEGER,
        updated_by TEXT,
        sort_order INTEGER DEFAULT 0,
        deleted_at INTEGER
    )`,
  // 云端备份源配置表
  `CREATE TABLE IF NOT EXISTS backup_providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        is_enabled BOOLEAN DEFAULT 1,
        config TEXT NOT NULL,
        auto_backup BOOLEAN DEFAULT 0,
        auto_backup_password TEXT,
        auto_backup_retain INTEGER DEFAULT 30,
        last_backup_at INTEGER,
        last_backup_status TEXT,
        created_at INTEGER,
        updated_at INTEGER
    )`,
  // Telegram 备份历史记录表
  `CREATE TABLE IF NOT EXISTS backup_telegram_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        file_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        size INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )`,
  // Email 备份历史记录表
  `CREATE TABLE IF NOT EXISTS backup_email_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        recipient TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )`,
  // Passkey 凭证表
  `CREATE TABLE IF NOT EXISTS auth_passkeys (
        credential_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        public_key BLOB NOT NULL,
        counter INTEGER DEFAULT 0,
        name TEXT,
        transports TEXT,
        created_at INTEGER NOT NULL,
        last_used_at INTEGER
    )`,
  // 速率限制表
  `CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        attempts INTEGER DEFAULT 0,
        last_attempt INTEGER,
        expires_at INTEGER
    )`,
  // Share link tables
  `CREATE TABLE IF NOT EXISTS share_links (
        id TEXT PRIMARY KEY,
        vault_item_id TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        access_code_hash TEXT NOT NULL,
        active_share_key TEXT,
        expires_at INTEGER NOT NULL,
        revoked_at INTEGER,
        created_at INTEGER NOT NULL,
        last_accessed_at INTEGER,
        access_count INTEGER DEFAULT 0
    )`,
  `CREATE TABLE IF NOT EXISTS share_audit_events (
        id TEXT PRIMARY KEY,
        share_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_type TEXT NOT NULL,
        event_at INTEGER NOT NULL,
        owner_id TEXT NOT NULL,
        ip_hash TEXT,
        user_agent_hash TEXT,
        metadata TEXT
    )`,
  `CREATE TABLE IF NOT EXISTS share_rate_limits (
        key TEXT PRIMARY KEY,
        share_id TEXT NOT NULL,
        attempts INTEGER DEFAULT 0,
        window_started_at INTEGER NOT NULL,
        last_attempt_at INTEGER NOT NULL,
        locked_until INTEGER
    )`,
  // 设备会话表
  `CREATE TABLE IF NOT EXISTS auth_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_id TEXT,
        provider TEXT,
        device_type TEXT NOT NULL,
        ip_address TEXT NOT NULL,
        last_active_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
    )`
];
var MYSQL_SHARE_BASE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS share_links (
        id VARCHAR(64) PRIMARY KEY,
        vault_item_id VARCHAR(64) NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        access_code_hash VARCHAR(255) NOT NULL,
        active_share_key VARCHAR(320),
        expires_at BIGINT NOT NULL,
        revoked_at BIGINT,
        created_at BIGINT NOT NULL,
        last_accessed_at BIGINT,
        access_count BIGINT DEFAULT 0
    )`,
  `CREATE TABLE IF NOT EXISTS share_audit_events (
        id VARCHAR(64) PRIMARY KEY,
        share_id VARCHAR(64) NOT NULL,
        event_type VARCHAR(50) NOT NULL,
        actor_type VARCHAR(50) NOT NULL,
        event_at BIGINT NOT NULL,
        owner_id VARCHAR(255) NOT NULL,
        ip_hash VARCHAR(255),
        user_agent_hash VARCHAR(255),
        metadata LONGTEXT
    )`,
  `CREATE TABLE IF NOT EXISTS share_rate_limits (
        \`key\` VARCHAR(255) PRIMARY KEY,
        share_id VARCHAR(255) NOT NULL,
        attempts BIGINT DEFAULT 0,
        window_started_at BIGINT NOT NULL,
        last_attempt_at BIGINT NOT NULL,
        locked_until BIGINT
    )`
];
var getBaseSchemaForEngine = (engine2) => {
  if (engine2 !== "mysql") {
    return BASE_SCHEMA;
  }
  const baseSchema = [];
  for (const rawSql of BASE_SCHEMA) {
    if (rawSql.includes("CREATE TABLE IF NOT EXISTS share_links") || rawSql.includes("CREATE TABLE IF NOT EXISTS share_audit_events") || rawSql.includes("CREATE TABLE IF NOT EXISTS share_rate_limits")) {
      continue;
    }
    baseSchema.push(rawSql);
  }
  return [...baseSchema, ...MYSQL_SHARE_BASE_SCHEMA];
};
function isMigrationStatementAlreadyApplied(error) {
  const msg = (error?.message || "").toLowerCase();
  return msg.includes("duplicate column") || msg.includes("already exists") || msg.includes("duplicate key") || msg.includes("duplicate name") || msg.includes("index") && msg.includes("exists");
}
var MIGRATIONS = [
  {
    version: 1,
    name: "add_sort_order_to_vault",
    sqlite: `ALTER TABLE vault ADD COLUMN sort_order INTEGER DEFAULT 0;`
  },
  {
    version: 2,
    name: "add_category_column_to_vault",
    sqlite: `ALTER TABLE vault ADD COLUMN category TEXT;`
  },
  {
    version: 3,
    name: "create_vault_category_sort_index",
    sqlite: `CREATE INDEX IF NOT EXISTS idx_vault_category_sort ON vault (category, sort_order);`,
    mysql: `CREATE INDEX idx_vault_category_sort ON vault (category(100), sort_order);`
  },
  {
    version: 4,
    name: "initialize_baseline_indexes",
    sqlite: `
            CREATE INDEX IF NOT EXISTS idx_vault_created_at ON vault(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_vault_service_created_at ON vault(service, created_at DESC);
            CREATE UNIQUE INDEX IF NOT EXISTS vault_service_account_uq ON vault(service, account);
            CREATE INDEX IF NOT EXISTS idx_backup_providers_type ON backup_providers(type);
            CREATE INDEX IF NOT EXISTS idx_backup_telegram_history_provider_id ON backup_telegram_history(provider_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_backup_email_history_provider_id ON backup_email_history(provider_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_passkeys_user_id ON auth_passkeys(user_id);
            CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);
        `,
    mysql: `
            CREATE INDEX idx_vault_created_at ON vault(created_at DESC);
            CREATE INDEX idx_vault_service_created_at ON vault(service(100), created_at DESC);
            CREATE UNIQUE INDEX vault_service_account_uq ON vault(service(100), account(100));
            CREATE INDEX idx_backup_providers_type ON backup_providers(type(50));
            CREATE INDEX idx_backup_telegram_history_provider_id ON backup_telegram_history(provider_id, created_at DESC);
            CREATE INDEX idx_backup_email_history_provider_id ON backup_email_history(provider_id, created_at DESC);
            CREATE INDEX idx_passkeys_user_id ON auth_passkeys(user_id(100));
            CREATE INDEX idx_rate_limits_expires ON rate_limits(expires_at);
        `
  },
  {
    version: 5,
    name: "add_auth_sessions_table",
    sqlite: `CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_type TEXT NOT NULL, ip_address TEXT NOT NULL, last_active_at INTEGER NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth_sessions(user_id); CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON auth_sessions(last_active_at DESC);`,
    mysql: `CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_type TEXT NOT NULL, ip_address TEXT NOT NULL, last_active_at INTEGER NOT NULL, created_at INTEGER NOT NULL); CREATE INDEX idx_sessions_user_id ON auth_sessions(user_id(100)); CREATE INDEX idx_sessions_last_active ON auth_sessions(last_active_at DESC);`
  },
  {
    version: 6,
    name: "add_transports_to_auth_passkeys",
    sqlite: `ALTER TABLE auth_passkeys ADD COLUMN transports TEXT;`
  },
  {
    version: 7,
    name: "add_device_id_to_sessions",
    sqlite: `ALTER TABLE auth_sessions ADD COLUMN device_id TEXT; CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON auth_sessions(user_id, device_id);`,
    mysql: `ALTER TABLE auth_sessions ADD COLUMN device_id TEXT; CREATE INDEX idx_sessions_device_id ON auth_sessions(user_id(100), device_id(100));`
  },
  {
    version: 8,
    name: "add_provider_to_sessions",
    sqlite: `ALTER TABLE auth_sessions ADD COLUMN provider TEXT;`
  },
  {
    version: 9,
    name: "convert_timestamps_to_bigint",
    sqlite: `SELECT 1;`,
    mysql: `
            ALTER TABLE vault MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE vault MODIFY updated_at BIGINT;
            ALTER TABLE vault MODIFY sort_order BIGINT DEFAULT 0;
            ALTER TABLE backup_providers MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE backup_providers MODIFY updated_at BIGINT NOT NULL;
            ALTER TABLE backup_providers MODIFY last_backup_at BIGINT;
            ALTER TABLE backup_telegram_history MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE backup_email_history MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE auth_passkeys MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE auth_passkeys MODIFY last_used_at BIGINT;
            ALTER TABLE auth_passkeys MODIFY counter BIGINT DEFAULT 0;
            ALTER TABLE auth_sessions MODIFY created_at BIGINT NOT NULL;
            ALTER TABLE auth_sessions MODIFY last_active_at BIGINT NOT NULL;
            ALTER TABLE rate_limits MODIFY last_attempt BIGINT;
            ALTER TABLE rate_limits MODIFY expires_at BIGINT;
            ALTER TABLE rate_limits MODIFY attempts BIGINT DEFAULT 0;
        `,
    postgres: `
            ALTER TABLE vault ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE vault ALTER COLUMN updated_at TYPE BIGINT;
            ALTER TABLE vault ALTER COLUMN sort_order TYPE BIGINT;
            ALTER TABLE backup_providers ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE backup_providers ALTER COLUMN updated_at TYPE BIGINT;
            ALTER TABLE backup_providers ALTER COLUMN last_backup_at TYPE BIGINT;
            ALTER TABLE backup_telegram_history ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE backup_email_history ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE auth_passkeys ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE auth_passkeys ALTER COLUMN last_used_at TYPE BIGINT;
            ALTER TABLE auth_passkeys ALTER COLUMN counter TYPE BIGINT;
            ALTER TABLE auth_sessions ALTER COLUMN created_at TYPE BIGINT;
            ALTER TABLE auth_sessions ALTER COLUMN last_active_at TYPE BIGINT;
            ALTER TABLE rate_limits ALTER COLUMN last_attempt TYPE BIGINT;
            ALTER TABLE rate_limits ALTER COLUMN expires_at TYPE BIGINT;
            ALTER TABLE rate_limits ALTER COLUMN attempts TYPE BIGINT;
        `
  },
  {
    version: 10,
    name: "add_deleted_at_to_vault",
    sqlite: `ALTER TABLE vault ADD COLUMN deleted_at INTEGER; CREATE INDEX IF NOT EXISTS idx_vault_deleted_at ON vault(deleted_at);`,
    mysql: `ALTER TABLE vault ADD COLUMN deleted_at BIGINT; CREATE INDEX idx_vault_deleted_at ON vault(deleted_at);`,
    postgres: `ALTER TABLE vault ADD COLUMN deleted_at BIGINT; CREATE INDEX IF NOT EXISTS idx_vault_deleted_at ON vault(deleted_at);`
  },
  {
    version: 11,
    name: "add_type_to_vault_and_normalize_algorithms",
    sqlite: `
            ALTER TABLE vault ADD COLUMN type TEXT DEFAULT 'totp';
            UPDATE vault SET type = 'steam', algorithm = 'SHA1' WHERE algorithm = 'STEAM';
            UPDATE vault SET algorithm = 'SHA1' WHERE algorithm = 'SHA-1';
        `,
    mysql: `
            ALTER TABLE vault ADD COLUMN type VARCHAR(20) DEFAULT 'totp';
            UPDATE vault SET type = 'steam', algorithm = 'SHA1' WHERE algorithm = 'STEAM';
            UPDATE vault SET algorithm = 'SHA1' WHERE algorithm = 'SHA-1';
        `,
    postgres: `
            ALTER TABLE vault ADD COLUMN type VARCHAR(20) DEFAULT 'totp';
            UPDATE vault SET type = 'steam', algorithm = 'SHA1' WHERE algorithm = 'STEAM';
            UPDATE vault SET algorithm = 'SHA1' WHERE algorithm = 'SHA-1';
        `
  },
  {
    version: 12,
    name: "add_counter_to_vault",
    sqlite: `ALTER TABLE vault ADD COLUMN counter INTEGER DEFAULT 0;`,
    mysql: `ALTER TABLE vault ADD COLUMN counter BIGINT DEFAULT 0;`,
    postgres: `ALTER TABLE vault ADD COLUMN counter BIGINT DEFAULT 0;`
  },
  {
    version: 13,
    name: "create_share_link_tables",
    sqlite: `
            CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                vault_item_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                access_code_hash TEXT NOT NULL,
                active_share_key TEXT,
                expires_at INTEGER NOT NULL,
                revoked_at INTEGER,
                created_at INTEGER NOT NULL,
                last_accessed_at INTEGER,
                access_count INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS share_audit_events (
                id TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                actor_type TEXT NOT NULL,
                event_at INTEGER NOT NULL,
                owner_id TEXT NOT NULL,
                ip_hash TEXT,
                user_agent_hash TEXT,
                metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS share_rate_limits (
                key TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                attempts INTEGER DEFAULT 0,
                window_started_at INTEGER NOT NULL,
                last_attempt_at INTEGER NOT NULL,
                locked_until INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_share_links_vault_item ON share_links(vault_item_id);
            CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(owner_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links(token_hash);
            CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON share_links(expires_at);
            CREATE INDEX IF NOT EXISTS idx_share_audit_share_time ON share_audit_events(share_id, event_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_rate_limits_locked_until ON share_rate_limits(locked_until);
        `,
    d1: `
            CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                vault_item_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                access_code_hash TEXT NOT NULL,
                active_share_key TEXT,
                expires_at INTEGER NOT NULL,
                revoked_at INTEGER,
                created_at INTEGER NOT NULL,
                last_accessed_at INTEGER,
                access_count INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS share_audit_events (
                id TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                actor_type TEXT NOT NULL,
                event_at INTEGER NOT NULL,
                owner_id TEXT NOT NULL,
                ip_hash TEXT,
                user_agent_hash TEXT,
                metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS share_rate_limits (
                key TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                attempts INTEGER DEFAULT 0,
                window_started_at INTEGER NOT NULL,
                last_attempt_at INTEGER NOT NULL,
                locked_until INTEGER
            );
            CREATE INDEX IF NOT EXISTS idx_share_links_vault_item ON share_links(vault_item_id);
            CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(owner_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links(token_hash);
            CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON share_links(expires_at);
            CREATE INDEX IF NOT EXISTS idx_share_audit_share_time ON share_audit_events(share_id, event_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_rate_limits_locked_until ON share_rate_limits(locked_until);
        `,
    mysql: `
            CREATE TABLE IF NOT EXISTS share_links (
                id VARCHAR(64) PRIMARY KEY,
                vault_item_id VARCHAR(64) NOT NULL,
                owner_id VARCHAR(255) NOT NULL,
                token_hash VARCHAR(255) NOT NULL,
                access_code_hash VARCHAR(255) NOT NULL,
                active_share_key VARCHAR(320),
                expires_at BIGINT NOT NULL,
                revoked_at BIGINT,
                created_at BIGINT NOT NULL,
                last_accessed_at BIGINT,
                access_count BIGINT DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS share_audit_events (
                id VARCHAR(64) PRIMARY KEY,
                share_id VARCHAR(64) NOT NULL,
                event_type VARCHAR(50) NOT NULL,
                actor_type VARCHAR(50) NOT NULL,
                event_at BIGINT NOT NULL,
                owner_id VARCHAR(255) NOT NULL,
                ip_hash VARCHAR(255),
                user_agent_hash VARCHAR(255),
                metadata LONGTEXT
            );
            CREATE TABLE IF NOT EXISTS share_rate_limits (
                \`key\` VARCHAR(255) PRIMARY KEY,
                share_id VARCHAR(255) NOT NULL,
                attempts BIGINT DEFAULT 0,
                window_started_at BIGINT NOT NULL,
                last_attempt_at BIGINT NOT NULL,
                locked_until BIGINT
            );
            CREATE INDEX idx_share_links_vault_item ON share_links(vault_item_id);
            CREATE INDEX idx_share_links_owner ON share_links(owner_id, created_at DESC);
            CREATE INDEX idx_share_links_token_hash ON share_links(token_hash);
            CREATE INDEX idx_share_links_expires_at ON share_links(expires_at);
            CREATE INDEX idx_share_audit_share_time ON share_audit_events(share_id, event_at DESC);
            CREATE INDEX idx_share_rate_limits_locked_until ON share_rate_limits(locked_until);
        `,
    postgres: `
            CREATE TABLE IF NOT EXISTS share_links (
                id TEXT PRIMARY KEY,
                vault_item_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                token_hash TEXT NOT NULL,
                access_code_hash TEXT NOT NULL,
                active_share_key TEXT,
                expires_at BIGINT NOT NULL,
                revoked_at BIGINT,
                created_at BIGINT NOT NULL,
                last_accessed_at BIGINT,
                access_count BIGINT DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS share_audit_events (
                id TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                actor_type TEXT NOT NULL,
                event_at BIGINT NOT NULL,
                owner_id TEXT NOT NULL,
                ip_hash TEXT,
                user_agent_hash TEXT,
                metadata TEXT
            );
            CREATE TABLE IF NOT EXISTS share_rate_limits (
                key TEXT PRIMARY KEY,
                share_id TEXT NOT NULL,
                attempts BIGINT DEFAULT 0,
                window_started_at BIGINT NOT NULL,
                last_attempt_at BIGINT NOT NULL,
                locked_until BIGINT
            );
            CREATE INDEX IF NOT EXISTS idx_share_links_vault_item ON share_links(vault_item_id);
            CREATE INDEX IF NOT EXISTS idx_share_links_owner ON share_links(owner_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_links_token_hash ON share_links(token_hash);
            CREATE INDEX IF NOT EXISTS idx_share_links_expires_at ON share_links(expires_at);
            CREATE INDEX IF NOT EXISTS idx_share_audit_share_time ON share_audit_events(share_id, event_at DESC);
            CREATE INDEX IF NOT EXISTS idx_share_rate_limits_locked_until ON share_rate_limits(locked_until);
        `
  },
  {
    version: 14,
    name: "add_active_share_uniqueness_guard",
    sqlite: `
            ALTER TABLE share_links ADD COLUMN active_share_key TEXT;
            UPDATE share_links
                SET active_share_key = NULL
                WHERE active_share_key IS NOT NULL;
            UPDATE share_links
                SET revoked_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
                WHERE revoked_at IS NULL
                    AND expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id
                            FROM share_links AS latest
                            WHERE latest.revoked_at IS NULL
                                AND latest.expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                                AND latest.id = (
                                    SELECT newest.id
                                    FROM share_links AS newest
                                    WHERE newest.owner_id = latest.owner_id
                                        AND newest.vault_item_id = latest.vault_item_id
                                        AND newest.revoked_at IS NULL
                                        AND newest.expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                                    ORDER BY newest.created_at DESC, newest.id DESC
                                    LIMIT 1
                                )
                        )
                    );
            UPDATE share_links
                SET active_share_key = owner_id || ':' || vault_item_id
                WHERE revoked_at IS NULL
                    AND expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_active_share_key ON share_links(active_share_key);
        `,
    d1: `
            ALTER TABLE share_links ADD COLUMN active_share_key TEXT;
            UPDATE share_links
                SET active_share_key = NULL
                WHERE active_share_key IS NOT NULL;
            UPDATE share_links
                SET revoked_at = CAST(strftime('%s', 'now') AS INTEGER) * 1000
                WHERE revoked_at IS NULL
                    AND expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id
                            FROM share_links AS latest
                            WHERE latest.revoked_at IS NULL
                                AND latest.expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                                AND latest.id = (
                                    SELECT newest.id
                                    FROM share_links AS newest
                                    WHERE newest.owner_id = latest.owner_id
                                        AND newest.vault_item_id = latest.vault_item_id
                                        AND newest.revoked_at IS NULL
                                        AND newest.expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000
                                    ORDER BY newest.created_at DESC, newest.id DESC
                                    LIMIT 1
                                )
                        )
                    );
            UPDATE share_links
                SET active_share_key = owner_id || ':' || vault_item_id
                WHERE revoked_at IS NULL
                    AND expires_at > CAST(strftime('%s', 'now') AS INTEGER) * 1000;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_active_share_key ON share_links(active_share_key);
        `,
    mysql: `
            ALTER TABLE share_links ADD COLUMN active_share_key VARCHAR(320);
            UPDATE share_links
                SET active_share_key = NULL
                WHERE active_share_key IS NOT NULL;
            UPDATE share_links
                SET revoked_at = UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                WHERE revoked_at IS NULL
                    AND expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id
                            FROM share_links AS latest
                            WHERE latest.revoked_at IS NULL
                                AND latest.expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                                AND latest.id = (
                                    SELECT newest.id
                                    FROM share_links AS newest
                                    WHERE newest.owner_id = latest.owner_id
                                        AND newest.vault_item_id = latest.vault_item_id
                                        AND newest.revoked_at IS NULL
                                        AND newest.expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000
                                    ORDER BY newest.created_at DESC, newest.id DESC
                                    LIMIT 1
                                )
                        ) AS retained_active_shares
                    );
            UPDATE share_links
                SET active_share_key = CONCAT(owner_id, ':', vault_item_id)
                WHERE revoked_at IS NULL
                    AND expires_at > UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3)) * 1000;
            CREATE UNIQUE INDEX idx_share_links_active_share_key ON share_links(active_share_key);
        `,
    postgres: `
            ALTER TABLE share_links ADD COLUMN active_share_key TEXT;
            UPDATE share_links
                SET active_share_key = NULL
                WHERE active_share_key IS NOT NULL;
            UPDATE share_links
                SET revoked_at = EXTRACT(EPOCH FROM NOW()) * 1000
                WHERE revoked_at IS NULL
                    AND expires_at > EXTRACT(EPOCH FROM NOW()) * 1000
                    AND id NOT IN (
                        SELECT id FROM (
                            SELECT id
                            FROM share_links AS latest
                            WHERE latest.revoked_at IS NULL
                                AND latest.expires_at > EXTRACT(EPOCH FROM NOW()) * 1000
                                AND latest.id = (
                                    SELECT newest.id
                                    FROM share_links AS newest
                                    WHERE newest.owner_id = latest.owner_id
                                        AND newest.vault_item_id = latest.vault_item_id
                                        AND newest.revoked_at IS NULL
                                        AND newest.expires_at > EXTRACT(EPOCH FROM NOW()) * 1000
                                    ORDER BY newest.created_at DESC, newest.id DESC
                                    LIMIT 1
                                )
                        ) AS retained_active_shares
                    );
            UPDATE share_links
                SET active_share_key = owner_id || ':' || vault_item_id
                WHERE revoked_at IS NULL
                    AND expires_at > EXTRACT(EPOCH FROM NOW()) * 1000;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_active_share_key ON share_links(active_share_key);
        `
  }
];
async function migrateDatabase(db) {
  const engine2 = db.engine;
  const createMetaTable = transformSqlForDialect(`CREATE TABLE IF NOT EXISTS _schema_metadata (\`key\` TEXT PRIMARY KEY, \`value\` TEXT)`, engine2);
  await db.exec(createMetaTable);
  for (const rawSql of getBaseSchemaForEngine(engine2)) {
    try {
      const sql3 = transformSqlForDialect(rawSql.trim(), engine2);
      await db.prepare(sql3).run();
    } catch (e) {
      const msg = e.message?.toLowerCase() || "";
      if (!msg.includes("already exists")) throw e;
    }
  }
  const queryMeta = transformSqlForDialect("SELECT `value` FROM _schema_metadata WHERE `key` = 'version'", engine2);
  const row = await db.prepare(queryMeta).get();
  const currentVersion = row ? parseInt(row.value, 10) : 0;
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion).sort((a, b) => a.version - b.version);
  if (pending.length === 0) return;
  logger.info(`[Database] Current engine: ${engine2}. version: ${currentVersion}. Migrating to v${pending[pending.length - 1].version}...`);
  for (const m of pending) {
    logger.info(`[Database] Applying v${m.version}: ${m.name}`);
    try {
      const engineSql = m[engine2] || m.sqlite;
      const statements = engineSql.split(";").map((s) => s.trim()).filter((s) => s.length > 0);
      for (const rawSql of statements) {
        const sql3 = transformSqlForDialect(rawSql, engine2);
        try {
          await db.exec(sql3);
        } catch (e) {
          if (isMigrationStatementAlreadyApplied(e)) {
            logger.info(`[Database] Skip existing statement in v${m.version}: ${rawSql.slice(0, 80)}`);
            continue;
          }
          throw e;
        }
      }
      const updateMetaRaw = engine2 === "postgres" ? `INSERT INTO _schema_metadata ("key", "value") VALUES ('version', ?) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED.value` : "REPLACE INTO _schema_metadata (`key`, `value`) VALUES ('version', ?)";
      const updateMeta = transformSqlForDialect(updateMetaRaw, engine2);
      await db.prepare(updateMeta).run(m.version.toString());
    } catch (e) {
      if (isMigrationStatementAlreadyApplied(e)) {
        logger.info(`[Database] Skip existing change in v${m.version}`);
        const updateMetaRaw = engine2 === "postgres" ? `INSERT INTO _schema_metadata ("key", "value") VALUES ('version', ?) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED.value` : "REPLACE INTO _schema_metadata (`key`, `value`) VALUES ('version', ?)";
        const updateMeta = transformSqlForDialect(updateMetaRaw, engine2);
        await db.prepare(updateMeta).run(m.version.toString());
        continue;
      }
      throw e;
    }
  }
}

// ../src/shared/db/d1Executor.ts
var D1Executor = class {
  constructor(d1) {
    this.d1 = d1;
  }
  engine = "d1";
  async exec(sql3) {
    await this.d1.prepare(sql3).run();
  }
  prepare(sql3) {
    return {
      get: async (...params) => {
        const stmt = this.d1.prepare(sql3).bind(...params);
        return await stmt.first();
      },
      run: async (...params) => {
        const stmt = this.d1.prepare(sql3).bind(...params);
        return await stmt.run();
      }
    };
  }
  async batch(sqls) {
    const statements = sqls.map((sql3) => this.d1.prepare(sql3));
    await this.d1.batch(statements);
  }
};

// ../src/app/worker.ts
var migrationPromises = /* @__PURE__ */ new WeakMap();
async function ensureDatabaseMigrated(d1) {
  const executor = new D1Executor(d1);
  if (!d1 || typeof d1 !== "object" && typeof d1 !== "function") {
    await migrateDatabase(executor);
    return;
  }
  let migration = migrationPromises.get(d1);
  if (!migration) {
    migration = migrateDatabase(executor).catch((error) => {
      migrationPromises.delete(d1);
      throw error;
    });
    migrationPromises.set(d1, migration);
  }
  await migration;
}
var worker_default = {
  async fetch(request, env, ctx) {
    const db = drizzle(env.DB, { schema: sqlite_exports });
    await ensureDatabaseMigrated(env.DB);
    const specializedEnv = {
      ...env,
      DB: db,
      // Replace D1 with Drizzle ORM instance
      ASSETS: env.ASSETS
      // Ensure ASSETS exists
    };
    return app_default.fetch(request, specializedEnv, ctx);
  },
  // Scheduled Backup trigger via Cloudflare Cron
  async scheduled(event, env, ctx) {
    const db = drizzle(env.DB, { schema: sqlite_exports });
    const specializedEnv = {
      ...env,
      DB: db
    };
    ctx.waitUntil(Promise.all([
      handleScheduledBackup(specializedEnv),
      createShareService(specializedEnv).cleanupShareState()
    ]));
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map