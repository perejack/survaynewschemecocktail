import { toast } from "sonner";

// PayHero M-Pesa Integration Service
const PAYHERO_BASE_URL = "https://backend.payhero.co.ke";
const PAYHERO_AUTH_HEADER =
  "Basic aEttTWluZFhYbzBDWE9CTzJZd2c6d0VBUWFrd1NxWklWYjAyRFdJaHI1R095eFc4Tlg4Slk1OUk3bmFvMg==";
const PAYHERO_CHANNEL_ID = 15193;

export class MpesaService {
  static formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "254" + cleaned.substring(1);
    if (cleaned.startsWith("+")) cleaned = cleaned.substring(1);
    if (!cleaned.startsWith("254")) cleaned = "254" + cleaned;
    return cleaned;
  }

  static async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    reference?: string,
    _userId?: string,
    _description?: string,
  ): Promise<{ success: boolean; checkoutRequestId?: string; error?: string }> {
    const formattedPhone = this.formatPhone(phoneNumber);
    const roundedAmount = Math.max(1, Math.round(Number(amount)));
    const externalReference = reference || `SURVEYPAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // 1. First attempt: call local / Vercel API endpoint
    try {
      const response = await fetch("/api/payhero/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formattedPhone,
          phoneNumber: formattedPhone,
          amount: roundedAmount,
          description: _description || "Survey Pay verification",
          reference: externalReference,
          referencePrefix: "SURVEYPAY",
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

        if (response.ok && data && data.success !== false) {
          const checkoutId =
            (typeof data.checkoutId === "string" ? data.checkoutId : null) ??
            (typeof data.checkoutRequestId === "string" ? data.checkoutRequestId : null);

          if (checkoutId) {
            toast.success("STK Push sent! Check your phone and enter PIN.");
            return {
              success: true,
              checkoutRequestId: checkoutId,
            };
          }
        } else if (data && data.success === false && typeof data.message === "string") {
          // Explicit failure message from API
          return {
            success: false,
            error: data.message,
          };
        }
      }
    } catch {
      // Backend route unreachable or pure client mode — proceed to direct PayHero API fallback
    }

    // 2. Direct PayHero gateway call fallback
    try {
      const payload = {
        amount: roundedAmount,
        phone_number: formattedPhone,
        channel_id: PAYHERO_CHANNEL_ID,
        provider: "m-pesa",
        external_reference: externalReference,
        description: _description || "Survey Pay verification",
      };

      const directResponse = await fetch(`${PAYHERO_BASE_URL}/api/v2/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: PAYHERO_AUTH_HEADER,
        },
        body: JSON.stringify(payload),
      });

      const directData = (await directResponse.json().catch(() => null)) as Record<string, unknown> | null;

      if (!directData) {
        return { success: false, error: "Failed to connect to PayHero gateway" };
      }

      const checkoutId =
        (typeof directData.reference === "string" ? directData.reference : null) ??
        (typeof directData.checkoutId === "string" ? directData.checkoutId : null) ??
        (typeof directData.CheckoutRequestID === "string" ? directData.CheckoutRequestID : null);

      const isSuccess =
        directResponse.ok &&
        (directData.success === true ||
          String(directData.status ?? "").toLowerCase() === "success" ||
          Boolean(checkoutId));

      if (isSuccess && checkoutId) {
        toast.success("STK Push sent! Check your phone and enter PIN.");
        return { success: true, checkoutRequestId: checkoutId };
      }

      const errMsg =
        (typeof directData.error_message === "string" ? directData.error_message : null) ??
        (typeof directData.message === "string" ? directData.message : null) ??
        (typeof directData.error === "string" ? directData.error : null) ??
        "Payment initiation failed";

      return { success: false, error: errMsg };
    } catch (err) {
      console.error("PayHero STK Push Error:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to initiate payment",
      };
    }
  }

  static async getPaymentStatus(
    checkoutRequestId: string,
  ): Promise<"completed" | "failed" | "pending"> {
    // 1. First attempt: call local / Vercel API endpoint
    try {
      const response = await fetch("/api/payhero/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId: checkoutRequestId }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

        if (response.ok && data) {
          if (data.status === "error") {
            return "pending";
          }

          const status = String(data.status ?? data.state ?? "").toLowerCase();
          const rawStatus = String(data.rawStatus ?? "").toLowerCase();
          const resultDesc = String(data.resultDesc ?? "").toLowerCase();

          if (
            status === "paid" ||
            status === "success" ||
            status === "completed" ||
            rawStatus === "completed" ||
            rawStatus === "success" ||
            rawStatus === "paid" ||
            resultDesc.includes("success") ||
            resultDesc.includes("processed successfully")
          ) {
            return "completed";
          }

          if (
            status === "failed" ||
            status === "cancelled" ||
            status === "canceled" ||
            rawStatus === "cancelled" ||
            rawStatus === "canceled" ||
            resultDesc.includes("cancelled by user") ||
            resultDesc.includes("canceled by user") ||
            resultDesc.includes("request cancelled") ||
            resultDesc.includes("insufficient") ||
            resultDesc.includes("wrong pin") ||
            resultDesc.includes("invalid pin")
          ) {
            return "failed";
          }

          return "pending";
        }
      }
    } catch {
      // API route unreachable — proceed to direct PayHero status check
    }

    // 2. Direct PayHero status check fallback
    try {
      const directResponse = await fetch(
        `${PAYHERO_BASE_URL}/api/v2/transaction-status?reference=${encodeURIComponent(checkoutRequestId)}`,
        {
          method: "GET",
          headers: {
            Authorization: PAYHERO_AUTH_HEADER,
          },
        },
      );

      const directData = (await directResponse.json().catch(() => null)) as Record<string, unknown> | null;
      if (!directData) return "pending";

      const rawStatus = String(directData.status ?? directData.Status ?? "").toUpperCase();
      const message = String(directData.message ?? directData.resultDesc ?? "").toLowerCase();

      if (
        rawStatus === "SUCCESS" ||
        rawStatus === "COMPLETED" ||
        rawStatus === "PAID" ||
        directData.success === true ||
        message.includes("success") ||
        message.includes("processed successfully")
      ) {
        return "completed";
      }

      if (
        rawStatus === "FAILED" ||
        rawStatus === "CANCELLED" ||
        rawStatus === "CANCELED" ||
        message.includes("cancelled by user") ||
        message.includes("canceled by user") ||
        message.includes("request cancelled") ||
        message.includes("insufficient") ||
        message.includes("wrong pin") ||
        message.includes("invalid pin")
      ) {
        return "failed";
      }

      return "pending";
    } catch {
      return "pending";
    }
  }
}

// Global polling manager matching reference project (24 attempts x 5s = 2 minutes)
export async function pollPaymentStatus(
  checkoutId: string,
  onSuccess: (receipt?: string) => void,
  onFailed: (msg: string) => void,
  maxAttempts = 24,
): Promise<void> {
  let attempts = 0;
  const checkStatus = async () => {
    if (attempts >= maxAttempts) {
      onFailed(
        "Confirmation is taking longer than expected. If you received the M-Pesa deduction, please wait 2 minutes — your account will be updated automatically.",
      );
      return;
    }
    attempts++;
    try {
      const status = await MpesaService.getPaymentStatus(checkoutId);
      if (status === "completed") {
        onSuccess();
        return;
      }
      if (status === "failed") {
        onFailed("Payment was not completed. Please try again.");
        return;
      }
      // still pending — keep polling every 5 seconds
      setTimeout(checkStatus, 5000);
    } catch {
      setTimeout(checkStatus, 5000);
    }
  };
  // Initial check after 5 seconds
  setTimeout(checkStatus, 5000);
}

// Convenience wrapper functions
export async function initiateSTK(
  phone: string,
  amount: number,
  reference?: string,
): Promise<{ success: boolean; checkoutId?: string | undefined; message: string }> {
  const res = await MpesaService.initiateSTKPush(phone, amount, reference);
  if (res.success && res.checkoutRequestId) {
    return {
      success: true,
      checkoutId: res.checkoutRequestId,
      message: "STK Push sent to your phone. Enter your PIN.",
    };
  }
  return {
    success: false,
    message: res.error || "Payment failed",
  };
}

export const pollSTKStatus = pollPaymentStatus;
