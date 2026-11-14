import crypto from "crypto";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Payhero-Signature",
};

function parseBody(req: any): { raw: string; json: Record<string, unknown> } {
  if (typeof req.body === "string") {
    try {
      return { raw: req.body, json: JSON.parse(req.body) };
    } catch {
      return { raw: req.body, json: {} };
    }
  }
  if (req.body && typeof req.body === "object") {
    return { raw: JSON.stringify(req.body), json: req.body };
  }
  return { raw: "", json: {} };
}

export default async function handler(req: any, res: any) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const webhookSecret = process.env.PAYHERO_WEBHOOK_SECRET;
  const { raw, json } = parseBody(req);

  // If secret is set, verify HMAC-SHA256 signature
  if (webhookSecret && webhookSecret.trim()) {
    const signatureHeader =
      (req.headers["x-payhero-signature"] as string) ||
      (req.headers["X-Payhero-Signature"] as string) ||
      "";

    if (!signatureHeader) {
      return res.status(401).json({ message: "Missing X-Payhero-Signature header" });
    }

    const expectedSignature =
      "sha256=" + crypto.createHmac("sha256", webhookSecret).update(raw).digest("hex");

    try {
      const valid = crypto.timingSafeEqual(
        Buffer.from(signatureHeader),
        Buffer.from(expectedSignature)
      );
      if (!valid) {
        return res.status(401).json({ message: "Invalid signature" });
      }
    } catch {
      return res.status(401).json({ message: "Signature verification failed" });
    }
  }

  // PayHero status mapping
  const rawStatus = String(json.status ?? json.Status ?? "").toUpperCase();
  const isSuccess =
    rawStatus === "SUCCESS" ||
    rawStatus === "COMPLETED" ||
    rawStatus === "PAID" ||
    json.success === true;

  const checkoutRequestId =
    (typeof json.reference === "string" ? json.reference : null) ??
    (typeof json.checkoutId === "string" ? json.checkoutId : null) ??
    (typeof json.CheckoutRequestID === "string" ? json.CheckoutRequestID : null);

  const transactionReceipt =
    (typeof json.provider_reference === "string" ? json.provider_reference : null) ??
    (typeof json.third_party_reference === "string" ? json.third_party_reference : null) ??
    (typeof json.payment_reference === "string" ? json.payment_reference : null);

  const reference =
    (typeof json.external_reference === "string" ? json.external_reference : null) ??
    (typeof json.reference === "string" ? json.reference : null);

  // Supabase connection
  const DEFAULT_SUPABASE_URL = "https://ugfoapreveoacgdorctw.supabase.co";
  const DEFAULT_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVnZm9hcHJldmVvYWNnZG9yY3R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MTI4MDQsImV4cCI6MjEwODI4ODgwNH0.evTgPf6DdJVDYMzUP9BYiOyuj18NMtBkP5Qz91cPc94";

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY;

  if (isSuccess && (checkoutRequestId || reference)) {
    try {
      const matchField = checkoutRequestId ? "checkout_request_id" : "id";
      const matchVal = checkoutRequestId || reference;

      // Update withdrawals table
      await fetch(
        `${supabaseUrl}/rest/v1/withdrawals?${matchField}=eq.${encodeURIComponent(String(matchVal))}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            status: "completed",
            mpesa_receipt: transactionReceipt,
          }),
        }
      ).catch(() => {});

      // Update unlock_purchases table
      await fetch(
        `${supabaseUrl}/rest/v1/unlock_purchases?${matchField}=eq.${encodeURIComponent(String(matchVal))}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            status: "completed",
          }),
        }
      ).catch(() => {});

      // Update upgrade_purchases table
      await fetch(
        `${supabaseUrl}/rest/v1/upgrade_purchases?${matchField}=eq.${encodeURIComponent(String(matchVal))}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            status: "completed",
          }),
        }
      ).catch(() => {});
    } catch (dbErr) {
      console.error("Failed to update Supabase in webhook:", dbErr);
    }
  }

  return res.status(200).json({
    received: true,
    success: isSuccess,
    checkoutRequestId,
    receipt: transactionReceipt,
    reference,
  });
}
