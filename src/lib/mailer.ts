import "server-only";
import { EmailClient } from "@azure/communication-email";
import { prisma } from "@/lib/db";

type Mail = { to: string; subject: string; text: string; html?: string; kind: string; sensitive?: boolean };

let client: EmailClient | null = null;
function emailClient() {
  const conn = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  if (!conn || !process.env.EMAIL_FROM) return null;
  client ??= new EmailClient(conn);
  return client;
}

/**
 * Sends through Azure Communication Services when configured and always records the
 * message in the outbox (Admin → Email outbox). Codes and reset links in delivered mail
 * are redacted from the outbox; undelivered ones stay readable so admins can help.
 */
export async function sendMail({ to, subject, text, html, kind, sensitive }: Mail) {
  const acs = emailClient();
  let status: "LOGGED" | "SENT" | "FAILED" = "LOGGED";
  let error: string | null = null;
  if (acs) {
    try {
      const poller = await acs.beginSend({
        senderAddress: process.env.EMAIL_FROM!,
        content: { subject, plainText: text, ...(html ? { html } : {}) },
        recipients: { to: [{ address: to }] },
      });
      await poller.pollUntilDone();
      status = "SENT";
    } catch (err) {
      status = "FAILED";
      error = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
      console.error("email delivery failed", error);
    }
  } else if (process.env.NODE_ENV !== "production") {
    console.info(`[mail:${kind}] → ${to}: ${subject}\n${text}`);
  }
  await prisma.outboundEmail.create({
    data: { to, subject, kind, status, error, text: status === "SENT" && sensitive ? "[redacted after delivery]" : text },
  });
}

export const mailConfigured = () => Boolean(process.env.AZURE_COMMUNICATION_CONNECTION_STRING && process.env.EMAIL_FROM);
