import "server-only";
import { createSign } from "node:crypto";
import { appUrl } from "@/lib/app-url";
import { eventWhere } from "@/lib/domain";
import { ticketUrl } from "@/lib/tickets";

/**
 * "Save to Google Wallet" links. The event (class) and the ticket (object) travel inside a JWT
 * signed with a Google Cloud service account that is authorised in the Google Wallet Business
 * Console, so no API calls are needed.
 *   GOOGLE_WALLET_ISSUER_ID             the issuer id from the Business Console
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL the service account's email
 *   GOOGLE_WALLET_PRIVATE_KEY           its private key, PEM ("\n" escapes allowed)
 */
export const googleWalletConfigured = () =>
  Boolean(process.env.GOOGLE_WALLET_ISSUER_ID && process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_WALLET_PRIVATE_KEY);

type WalletEvent = {
  id: string; name: string; startDate: Date | null; endDate: Date | null; venue: string; address: string; location: string;
  format: "IN_PERSON" | "ONLINE" | "HYBRID"; onlinePlatform: string; coverImage: string;
};
type WalletRegistration = { id: string; code: string; name: string; ticketType: { name: string } | null };

const text = (value: string) => ({ defaultValue: { language: "en-US", value } });
const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");
/** Google Wallet ids: issuer id, a dot, then letters, digits, "." "_" or "-". */
const walletId = (suffix: string) => `${process.env.GOOGLE_WALLET_ISSUER_ID}.${suffix.replace(/[^\w.-]/g, "_")}`;
const absolute = (src: string) => (src.startsWith("/") ? `${appUrl()}${src}` : src);

export function googleWalletClaims(event: WalletEvent, r: WalletRegistration) {
  const venueName = event.format === "ONLINE" ? "Online" : event.venue || eventWhere(event);
  const cover = absolute(event.coverImage);
  const eventClass = {
    id: walletId(`event-${event.id}`),
    issuerName: "SpeakerDesk",
    reviewStatus: "UNDER_REVIEW",
    eventName: text(event.name),
    logo: { sourceUri: { uri: `${appUrl()}/wallet/logo@3x.png` }, contentDescription: text("SpeakerDesk") },
    ...(cover.startsWith("https://") ? { heroImage: { sourceUri: { uri: cover }, contentDescription: text(event.name) } } : {}),
    ...(venueName ? { venue: { name: text(venueName), address: text(event.address || eventWhere(event) || venueName) } } : {}),
    ...(event.startDate ? { dateTime: { start: event.startDate.toISOString(), ...(event.endDate ? { end: new Date(event.endDate.getTime() + 86_399_000).toISOString() } : {}) } } : {}),
    hexBackgroundColor: "#18181b",
  };
  const ticket = {
    id: walletId(`ticket-${r.id}`),
    classId: eventClass.id,
    state: "ACTIVE",
    ticketHolderName: r.name,
    ticketType: text(r.ticketType?.name ?? "General admission"),
    barcode: { type: "QR_CODE", value: ticketUrl(r.code), alternateText: r.name },
    linksModuleData: { uris: [{ uri: ticketUrl(r.code), description: "Your ticket" }, { uri: `${ticketUrl(r.code)}/cancel`, description: "Can't come? Cancel your ticket" }] },
  };
  return {
    iss: process.env.GOOGLE_WALLET_SERVICE_ACCOUNT_EMAIL,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: [appUrl()],
    payload: { eventTicketClasses: [eventClass], eventTicketObjects: [ticket] },
  };
}

/** The https://pay.google.com/gp/v/save/… link for one ticket. */
export function googleWalletSaveUrl(event: WalletEvent, r: WalletRegistration) {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(googleWalletClaims(event, r)));
  const key = (process.env.GOOGLE_WALLET_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const signature = createSign("RSA-SHA256").update(`${header}.${body}`).sign(key).toString("base64url");
  return `https://pay.google.com/gp/v/save/${header}.${body}.${signature}`;
}
