import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
} from "node:crypto";

const PAYLOAD_AAD = Buffer.from("get-even/payload/v1", "utf8");
const KEY_SALT = Buffer.from("get-even/server-key-derivation/v1", "utf8");

type Envelope = { v: 1; i: string; c: string; t: string };

/**
 * All records are protected with keys derived from MANUS_JWT_SECRET. This is
 * server-managed encryption, not end-to-end encryption. Secret rotation must
 * retain the prior key until all HMAC indexes and ciphertexts are re-encrypted.
 */
function masterSecret(): Buffer {
  const value = process.env.MANUS_JWT_SECRET;
  if (!value || value.length < 16) {
    throw new Error("Get Even security configuration unavailable");
  }
  return Buffer.from(value, "utf8");
}

function deriveKey(domain: string): Buffer {
  return Buffer.from(hkdfSync("sha256", masterSecret(), KEY_SALT, Buffer.from(domain, "utf8"), 32));
}

function base64url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

function fromBase64url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function phoneHmac(phone: string): string {
  return createHmac("sha256", deriveKey("get-even/phone-index/v1")).update(phone, "utf8").digest("hex");
}

export function encryptPayload(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("get-even/payload-encryption/v1"), iv);
  cipher.setAAD(PAYLOAD_AAD);
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const envelope: Envelope = {
    v: 1,
    i: base64url(iv),
    c: base64url(ciphertext),
    t: base64url(cipher.getAuthTag()),
  };
  return base64url(Buffer.from(JSON.stringify(envelope), "utf8"));
}

export function decryptPayload<T>(serialized: string): T {
  try {
    const envelope = JSON.parse(fromBase64url(serialized).toString("utf8")) as Envelope;
    if (
      envelope.v !== 1 ||
      typeof envelope.i !== "string" ||
      typeof envelope.c !== "string" ||
      typeof envelope.t !== "string"
    ) {
      throw new Error("bad envelope");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey("get-even/payload-encryption/v1"),
      fromBase64url(envelope.i),
    );
    decipher.setAAD(PAYLOAD_AAD);
    decipher.setAuthTag(fromBase64url(envelope.t));
    const plaintext = Buffer.concat([decipher.update(fromBase64url(envelope.c)), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as T;
  } catch {
    throw new Error("Get Even encrypted data unavailable");
  }
}
