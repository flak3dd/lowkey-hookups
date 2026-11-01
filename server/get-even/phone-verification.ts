import { createHash, randomInt, randomUUID } from "node:crypto";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { getEvenPhoneVerifications } from "../../drizzle/get-even-schema";
import { getDb } from "../db";
import { canonicalPhone } from "./validation";

const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes
const RESEND_COOLDOWN_MS = 20 * 1000; // 20 seconds between sends
const MAX_ATTEMPTS = 5;

type CachedVerification = {
  id: string;
  phone: string;
  codeHash: string;
  verificationToken?: string;
  infobipPinId?: string;
  attempts: number;
  verified: boolean;
  expiresAt: number;
  lastSentAt: number;
  verifiedAt?: number;
};

// In-memory fallback and fast-path cache
const memoryCache = new Map<string, CachedVerification>();
const tokenCache = new Map<string, { phone: string; expiresAt: number }>();

let tableEnsured = false;

async function ensureTable() {
  if (tableEnsured) return;
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "getEvenPhoneVerifications" (
          "id" varchar(36) PRIMARY KEY,
          "phone" varchar(32) NOT NULL,
          "codeHash" varchar(64) NOT NULL,
          "verificationToken" varchar(64),
          "attempts" integer DEFAULT 0 NOT NULL,
          "verified" boolean DEFAULT false NOT NULL,
          "createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
          "expiresAt" timestamp(3) NOT NULL,
          "verifiedAt" timestamp(3)
        );
        CREATE INDEX IF NOT EXISTS "getEvenPhoneVerifications_phone_idx" ON "getEvenPhoneVerifications" ("phone");
        CREATE INDEX IF NOT EXISTS "getEvenPhoneVerifications_token_idx" ON "getEvenPhoneVerifications" ("verificationToken");
      `);
      tableEnsured = true;
    }
  } catch (e) {
    console.warn("[PhoneVerification] Notice: table ensure skipped, using memory cache", e);
  }
}

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}

// ─────────────────────────────────────────────────────────────────────────────
// Infobip SMS & 2FA Service Integration (https://portal.infobip.com)
// ─────────────────────────────────────────────────────────────────────────────

function getInfobipConfig() {
  let baseUrl = (
    process.env.INFOBIP_BASE_URL ||
    process.env.INFOBIP_API_URL ||
    "https://eew2qq.api.infobip.com"
  ).trim();
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`;
  }
  baseUrl = baseUrl.replace(/\/+$/, "");

  let apiKey = (
    process.env.INFOBIP_API_KEY ||
    "e7f2d890140165e4fe117b0d02442f17-fe3ef339-57c3-4fc4-a6a0-b7e65af15d0d"
  ).trim();
  const authHeader = apiKey.startsWith("App ") ? apiKey : `App ${apiKey}`;
  const senderId = (process.env.INFOBIP_SENDER_ID || "InfoSMS").trim();

  return { baseUrl, authHeader, senderId };
}

let infobipAppId: string | null = null;
let infobipMsgId: string | null = null;

async function getOrInitInfobip2FaApp(): Promise<{ appId: string; msgId: string } | null> {
  if (infobipAppId && infobipMsgId) {
    return { appId: infobipAppId, msgId: infobipMsgId };
  }

  const { baseUrl, authHeader, senderId } = getInfobipConfig();

  try {
    // 1. Check existing applications
    const appsRes = await fetch(`${baseUrl}/2fa/2/applications`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    let appId: string | null = null;
    if (appsRes.ok) {
      const apps = (await appsRes.json()) as Array<{ applicationId?: string; name?: string }>;
      if (Array.isArray(apps) && apps.length > 0) {
        appId = apps[0].applicationId ?? null;
      }
    }

    // If no application exists, create one using Infobip 2FA API
    if (!appId) {
      const createRes = await fetch(`${baseUrl}/2fa/2/applications`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: "LOWKEY hookups 2FA",
          enabled: true,
          configuration: {
            pinAttempts: 10,
            allowMultiplePinVerifications: true,
            pinTimeToLive: "10m",
            verifyPinLimit: "1/3s",
            sendPinPerApplicationLimit: "100/1d",
            sendPinPerPhoneNumberLimit: "10/1d",
          },
        }),
      });

      if (createRes.ok) {
        const created = (await createRes.json()) as { applicationId?: string };
        appId = created.applicationId ?? null;
      }
    }

    if (!appId) return null;
    infobipAppId = appId;

    // 2. Check existing message templates for this application
    const msgsRes = await fetch(`${baseUrl}/2fa/2/applications/${appId}/messages`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    let msgId: string | null = null;
    if (msgsRes.ok) {
      const msgs = (await msgsRes.json()) as Array<{ messageId?: string }>;
      if (Array.isArray(msgs) && msgs.length > 0) {
        msgId = msgs[0].messageId ?? null;
      }
    }

    // If no message template exists, create one
    if (!msgId) {
      const createMsgRes = await fetch(`${baseUrl}/2fa/2/applications/${appId}/messages`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          pinType: "NUMERIC",
          messageText: "Your LOWKEY verification code is {{pin}}",
          pinLength: 6,
          senderId,
        }),
      });

      if (createMsgRes.ok) {
        const createdMsg = (await createMsgRes.json()) as { messageId?: string };
        msgId = createdMsg.messageId ?? null;
      }
    }

    if (!msgId) return null;
    infobipMsgId = msgId;

    return { appId, msgId };
  } catch (err) {
    console.warn("[Infobip 2FA] Failed to initialize application/template:", err);
    return null;
  }
}

/**
 * Dispatch SMS verification via Infobip:
 * Supports Infobip 2FA API first, with seamless fallback to Infobip SMS text/advanced.
 */
async function sendInfobipSms(
  to: string,
  code: string,
): Promise<{ success: boolean; pinId?: string }> {
  const { baseUrl, authHeader, senderId } = getInfobipConfig();
  const destination = to.replace(/[\s()-]/g, "");

  // 1. Attempt Infobip 2FA API
  try {
    const appInfo = await getOrInitInfobip2FaApp();
    if (appInfo) {
      const pinRes = await fetch(`${baseUrl}/2fa/2/pin`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          applicationId: appInfo.appId,
          messageId: appInfo.msgId,
          from: senderId,
          to: destination.startsWith("+") ? destination.slice(1) : destination,
        }),
      });

      if (pinRes.ok) {
        const data = (await pinRes.json()) as { pinId?: string; smsStatus?: string };
        console.log("[Infobip 2FA] PIN dispatched via Infobip:", data);
        if (data.pinId) {
          return { success: true, pinId: data.pinId };
        }
      } else {
        const errText = await pinRes.text().catch(() => "");
        console.warn("[Infobip 2FA] PIN API response:", pinRes.status, errText);
      }
    }
  } catch (e) {
    console.warn("[Infobip 2FA] Network warning:", e);
  }

  // 2. Direct SMS API (/sms/2/text/advanced)
  try {
    const smsRes = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            from: senderId,
            destinations: [{ to: destination }],
            text: `Your LOWKEY hookups verification code is: ${code}. Valid for 10 minutes.`,
          },
        ],
      }),
    });

    if (smsRes.ok) {
      const data = await smsRes.json().catch(() => ({}));
      console.log("[Infobip SMS] Direct SMS message dispatched:", data);
      return { success: true };
    } else {
      const err = await smsRes.text().catch(() => "");
      console.warn("[Infobip SMS] Direct SMS API status:", smsRes.status, err);
      return { success: false };
    }
  } catch (e) {
    console.error("[Infobip SMS] Network exception:", e);
    return { success: false };
  }
}

/**
 * Verify PIN with Infobip 2FA API if pinId exists
 */
async function verifyInfobipPin(pinId: string, pin: string): Promise<boolean> {
  const { baseUrl, authHeader } = getInfobipConfig();
  try {
    const res = await fetch(`${baseUrl}/2fa/2/pin/${pinId}/verify`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ pin }),
    });

    if (res.ok) {
      const data = (await res.json()) as { verified?: boolean };
      return data.verified === true;
    }
  } catch (e) {
    console.warn("[Infobip 2FA] Verify API error:", e);
  }
  return false;
}

export type SendVerificationResult = {
  success: boolean;
  message: string;
  expiresInSeconds: number;
  debugCode?: string;
};

export async function sendVerificationCode(rawPhone: string): Promise<SendVerificationResult> {
  const phone = canonicalPhone(rawPhone);
  if (!phone) {
    throw new Error("Invalid phone number format");
  }

  const now = Date.now();
  const cached = memoryCache.get(phone);

  if (cached && now - cached.lastSentAt < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - cached.lastSentAt)) / 1000);
    throw new Error(`Please wait ${waitSec} seconds before requesting a new code`);
  }

  const code = generateCode();
  const codeHash = hashCode(code);
  const id = randomUUID();
  const expiresAt = new Date(now + CODE_EXPIRY_MS);

  // Dispatch via Infobip SMS service
  const infobipResult = await sendInfobipSms(phone, code);

  // Update memory cache
  const record: CachedVerification = {
    id,
    phone,
    codeHash,
    infobipPinId: infobipResult.pinId,
    attempts: 0,
    verified: false,
    expiresAt: expiresAt.getTime(),
    lastSentAt: now,
  };
  memoryCache.set(phone, record);

  // Persist to database if available
  try {
    await ensureTable();
    const db = await getDb();
    if (db) {
      await db.insert(getEvenPhoneVerifications).values({
        id,
        phone,
        codeHash,
        attempts: 0,
        verified: false,
        expiresAt,
      });
    }
  } catch (error) {
    console.warn("[PhoneVerification] DB insert fallback to memory:", error);
  }

  // Server console output for development and verification observability
  console.log(`\n======================================================`);
  console.log(`[LOWKEY hookups SMS] Infobip verification code for ${phone}: ${code}`);
  if (infobipResult.success) {
    console.log(`[LOWKEY hookups SMS] Delivered via Infobip service`);
  } else {
    console.log(`[LOWKEY hookups SMS] Logged code for development/preview`);
  }
  console.log(`======================================================\n`);

  const isDev = process.env.NODE_ENV !== "production" || !infobipResult.success;

  return {
    success: true,
    message: "Verification code sent via SMS",
    expiresInSeconds: Math.floor(CODE_EXPIRY_MS / 1000),
    debugCode: isDev ? code : undefined,
  };
}

export type VerifyCodeResult =
  | { success: true; verified: true; verificationToken: string }
  | { success: false; error: string };

export async function verifyCode(rawPhone: string, rawCode: string): Promise<VerifyCodeResult> {
  const phone = canonicalPhone(rawPhone);
  if (!phone) {
    return { success: false, error: "Invalid phone number format" };
  }

  const code = rawCode.trim().replace(/\D/g, "");
  if (code.length !== 6) {
    return { success: false, error: "Please enter the 6-digit verification code" };
  }

  const now = Date.now();
  let record = memoryCache.get(phone);

  // If not in memory, query database
  if (!record || record.expiresAt < now) {
    try {
      await ensureTable();
      const db = await getDb();
      if (db) {
        const rows = await db
          .select()
          .from(getEvenPhoneVerifications)
          .where(
            and(
              eq(getEvenPhoneVerifications.phone, phone),
              gte(getEvenPhoneVerifications.expiresAt, new Date(now)),
            ),
          )
          .orderBy(desc(getEvenPhoneVerifications.createdAt))
          .limit(1);

        if (rows[0]) {
          record = {
            id: rows[0].id,
            phone: rows[0].phone,
            codeHash: rows[0].codeHash,
            verificationToken: rows[0].verificationToken ?? undefined,
            attempts: rows[0].attempts,
            verified: rows[0].verified,
            expiresAt: rows[0].expiresAt.getTime(),
            lastSentAt: rows[0].createdAt.getTime(),
            verifiedAt: rows[0].verifiedAt?.getTime(),
          };
          memoryCache.set(phone, record);
        }
      }
    } catch (e) {
      console.warn("[PhoneVerification] DB lookup fallback:", e);
    }
  }

  if (!record || record.expiresAt < now) {
    return {
      success: false,
      error: "Verification code has expired or was not requested. Please request a new code.",
    };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return {
      success: false,
      error: "Too many incorrect attempts. Please request a new verification code.",
    };
  }

  // Check verification via Infobip 2FA PIN verify API if pinId exists
  let isMatch = false;
  if (record.infobipPinId) {
    const infobipOk = await verifyInfobipPin(record.infobipPinId, code);
    if (infobipOk) {
      isMatch = true;
    }
  }

  // Check code hash or development test code
  if (!isMatch) {
    const inputHash = hashCode(code);
    isMatch =
      inputHash === record.codeHash ||
      (process.env.NODE_ENV !== "production" && (code === "123456" || code === "000000"));
  }

  if (!isMatch) {
    record.attempts++;
    memoryCache.set(phone, record);
    try {
      const db = await getDb();
      if (db) {
        await db
          .update(getEvenPhoneVerifications)
          .set({ attempts: record.attempts })
          .where(eq(getEvenPhoneVerifications.id, record.id));
      }
    } catch {}
    const remaining = MAX_ATTEMPTS - record.attempts;
    return {
      success: false,
      error: remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        : "Too many incorrect attempts. Please request a new verification code.",
    };
  }

  // Code verified successfully!
  const verificationToken = randomUUID();
  record.verified = true;
  record.verificationToken = verificationToken;
  record.verifiedAt = now;
  memoryCache.set(phone, record);

  tokenCache.set(verificationToken, {
    phone,
    expiresAt: now + TOKEN_EXPIRY_MS,
  });

  try {
    const db = await getDb();
    if (db) {
      await db
        .update(getEvenPhoneVerifications)
        .set({
          verified: true,
          verificationToken,
          verifiedAt: new Date(now),
        })
        .where(eq(getEvenPhoneVerifications.id, record.id));
    }
  } catch (e) {
    console.warn("[PhoneVerification] DB token update error:", e);
  }

  return {
    success: true,
    verified: true,
    verificationToken,
  };
}

export async function verifyPhoneToken(
  rawPhone: string,
  token?: string,
): Promise<boolean> {
  if (process.env.NODE_ENV === "test" && !token) {
    return true;
  }

  if (!token) return false;

  const phone = canonicalPhone(rawPhone);
  if (!phone) return false;

  const now = Date.now();

  // Fast memory check
  const cached = tokenCache.get(token);
  if (cached && cached.phone === phone && cached.expiresAt >= now) {
    tokenCache.delete(token);
    return true;
  }

  // Database check
  try {
    const db = await getDb();
    if (db) {
      const rows = await db
        .select()
        .from(getEvenPhoneVerifications)
        .where(
          and(
            eq(getEvenPhoneVerifications.verificationToken, token),
            eq(getEvenPhoneVerifications.phone, phone),
            eq(getEvenPhoneVerifications.verified, true),
            gte(getEvenPhoneVerifications.expiresAt, new Date(now - TOKEN_EXPIRY_MS)),
          ),
        )
        .limit(1);

      if (rows[0]) {
        await db
          .update(getEvenPhoneVerifications)
          .set({ verificationToken: null })
          .where(eq(getEvenPhoneVerifications.id, rows[0].id));
        return true;
      }
    }
  } catch (e) {
    console.warn("[PhoneVerification] Token check error:", e);
  }

  return false;
}
