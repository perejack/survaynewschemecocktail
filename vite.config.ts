import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "payhero-dev-api",
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const isInitiate =
              (req.url?.startsWith("/api/payhero/initiate") ||
                req.url?.startsWith("/api/hashback/initiate")) &&
              req.method === "POST";

            if (isInitiate) {
              let body = "";
              req.on("data", (chunk) => (body += chunk));
              req.on("end", async () => {
                try {
                  const parsed = JSON.parse(body || "{}");
                  const rawPhone = String(
                    parsed.phone || parsed.phoneNumber || parsed.phone_number || parsed.msisdn || ""
                  );
                  const cleaned = rawPhone.replace(/\D/g, "");
                  const normalizedPhone = cleaned.startsWith("0")
                    ? "254" + cleaned.slice(1)
                    : cleaned.startsWith("254")
                    ? cleaned
                    : "254" + cleaned;

                  const amount = Math.max(1, Math.round(Number(parsed.amount) || 50));
                  const ref =
                    parsed.reference ||
                    `SURVEYPAY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

                  const authHeader =
                    process.env.PAYHERO_AUTH_HEADER ||
                    "Basic aEttTWluZFhYbzBDWE9CTzJZd2c6d0VBUWFrd1NxWklWYjAyRFdJaHI1R095eFc4Tlg4Slk1OUk3bmFvMg==";
                  const channelId = Number(process.env.PAYHERO_CHANNEL_ID) || 15193;

                  const payheroRes = await fetch("https://backend.payhero.co.ke/api/v2/payments", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: authHeader.startsWith("Basic ")
                        ? authHeader
                        : `Basic ${authHeader}`,
                    },
                    body: JSON.stringify({
                      amount,
                      phone_number: normalizedPhone,
                      channel_id: channelId,
                      provider: "m-pesa",
                      external_reference: ref,
                      customer_name: parsed.customer_name || undefined,
                      description: parsed.description || "Survey Pay verification",
                    }),
                  });

                  const data = await payheroRes.json().catch(() => ({}));

                  const checkoutId =
                    data.reference ||
                    data.Reference ||
                    data.checkoutId ||
                    data.checkoutRequestId ||
                    data.CheckoutRequestID ||
                    data.data?.reference ||
                    data.data?.checkoutId;

                  const success =
                    payheroRes.ok &&
                    (data.success === true ||
                      String(data.status ?? "").toLowerCase() === "success" ||
                      Boolean(checkoutId));

                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      success,
                      checkoutId,
                      checkoutRequestId: checkoutId,
                      reference: ref,
                      normalizedPhone,
                      message: data.message || (success ? "STK push initiated" : "Payment initiation failed"),
                      raw: data,
                    })
                  );
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ success: false, message: e.message }));
                }
              });
              return;
            }

            const isStatus =
              (req.url?.startsWith("/api/payhero/status") ||
                req.url?.startsWith("/api/hashback/status")) &&
              req.method === "POST";

            if (isStatus) {
              let body = "";
              req.on("data", (chunk) => (body += chunk));
              req.on("end", async () => {
                try {
                  const parsed = JSON.parse(body || "{}");
                  const reference =
                    parsed.checkoutId ||
                    parsed.checkoutid ||
                    parsed.checkoutRequestId ||
                    parsed.reference;

                  const authHeader =
                    process.env.PAYHERO_AUTH_HEADER ||
                    "Basic aEttTWluZFhYbzBDWE9CTzJZd2c6d0VBUWFrd1NxWklWYjAyRFdJaHI1R095eFc4Tlg4Slk1OUk3bmFvMg==";

                  const payheroRes = await fetch(
                    `https://backend.payhero.co.ke/api/v2/transaction-status?reference=${encodeURIComponent(
                      reference
                    )}`,
                    {
                      method: "GET",
                      headers: {
                        Authorization: authHeader.startsWith("Basic ")
                          ? authHeader
                          : `Basic ${authHeader}`,
                      },
                    }
                  );

                  const data = await payheroRes.json().catch(() => ({}));
                  const rawStatus = String(data.status ?? data.Status ?? "").toUpperCase();
                  const resultDesc = String(
                    data.message ?? data.resultDesc ?? rawStatus
                  ).toLowerCase();

                  let status = "pending";
                  if (
                    rawStatus === "SUCCESS" ||
                    rawStatus === "COMPLETED" ||
                    rawStatus === "PAID" ||
                    data.success === true ||
                    resultDesc.includes("success") ||
                    resultDesc.includes("processed successfully")
                  ) {
                    status = "paid";
                  } else if (
                    rawStatus === "FAILED" ||
                    rawStatus === "CANCELLED" ||
                    rawStatus === "CANCELED" ||
                    resultDesc.includes("cancelled") ||
                    resultDesc.includes("canceled") ||
                    resultDesc.includes("insufficient") ||
                    resultDesc.includes("wrong pin") ||
                    resultDesc.includes("invalid pin")
                  ) {
                    status = "failed";
                  }

                  const receiptNumber =
                    data.provider_reference ||
                    data.third_party_reference ||
                    data.payment_reference ||
                    data.receiptNumber ||
                    data.TransactionReceipt;

                  res.setHeader("Content-Type", "application/json");
                  res.end(
                    JSON.stringify({
                      success: status === "paid",
                      status,
                      state: status === "paid" ? "success" : status,
                      rawStatus,
                      resultDesc: data.message || data.resultDesc || rawStatus,
                      receiptNumber,
                      raw: data,
                    })
                  );
                } catch (e: any) {
                  res.statusCode = 500;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ status: "error", message: e.message }));
                }
              });
              return;
            }

            next();
          });
        },
      },
    ],
  },
});
