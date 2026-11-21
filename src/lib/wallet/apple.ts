import "server-only";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import forge from "node-forge";
import { formatDateRange } from "@/lib/dates";
import { eventWhere } from "@/lib/domain";
import { ticketUrl } from "@/lib/tickets";
import { zip } from "./zip";

/**
 * Apple Wallet passes (.pkpass). Needs an Apple Developer Pass Type ID certificate:
 *   APPLE_WALLET_PASS_TYPE_ID  e.g. pass.eu.speakerdesk.ticket
 *   APPLE_WALLET_TEAM_ID       the 10-character Apple team id
 *   APPLE_WALLET_CERT          the pass certificate, PEM
 *   APPLE_WALLET_KEY           its private key, PEM (optionally encrypted: APPLE_WALLET_KEY_PASSPHRASE)
 *   APPLE_WALLET_WWDR_CERT     Apple's WWDR intermediate certificate (G4), PEM
 * PEM values may use "\n" escapes, so they fit in a single environment variable or secret.
 */
const pem = (v: string | undefined) => (v ?? "").replace(/\\n/g, "\n").trim();

export const appleWalletConfigured = () =>
  Boolean(process.env.APPLE_WALLET_PASS_TYPE_ID && process.env.APPLE_WALLET_TEAM_ID && process.env.APPLE_WALLET_CERT && process.env.APPLE_WALLET_KEY && process.env.APPLE_WALLET_WWDR_CERT);

type PassEvent = {
  id: string; name: string; slug: string; startDate: Date | null; endDate: Date | null; venue: string; address: string; location: string;
  format: "IN_PERSON" | "ONLINE" | "HYBRID"; onlinePlatform: string; latitude: number | null; longitude: number | null; coverImage: string;
};
type PassRegistration = { code: string; name: string; status: "ACTIVE" | "CANCELLED"; ticketType: { name: string } | null };

const ASSETS = ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png", "logo@3x.png"];

/** The pass.json content: an event ticket with the same QR code as the email and ticket page. */
export function passJson(event: PassEvent, r: PassRegistration) {
  const where = event.format === "ONLINE" ? "Online" : [event.venue, event.address || eventWhere(event)].filter(Boolean).join(", ");
  return {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_WALLET_PASS_TYPE_ID,
    teamIdentifier: process.env.APPLE_WALLET_TEAM_ID,
    serialNumber: r.code,
    organizationName: "SpeakerDesk",
    description: `Ticket for ${event.name}`,
    logoText: event.name,
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(255, 160, 120)",
    backgroundColor: "rgb(24, 24, 27)",
    ...(event.startDate ? { relevantDate: event.startDate.toISOString() } : {}),
    ...(event.latitude !== null && event.longitude !== null ? { locations: [{ latitude: event.latitude, longitude: event.longitude, relevantText: `Your ticket for ${event.name}` }] } : {}),
    barcodes: [{ format: "PKBarcodeFormatQR", message: ticketUrl(r.code), messageEncoding: "iso-8859-1", altText: r.name }],
    ...(r.status === "CANCELLED" ? { voided: true } : {}),
    eventTicket: {
      primaryFields: [{ key: "event", label: "EVENT", value: event.name }],
      secondaryFields: [{ key: "attendee", label: "ATTENDEE", value: r.name }],
      auxiliaryFields: [
        { key: "date", label: "DATE", value: formatDateRange(event.startDate, event.endDate) },
        { key: "ticket", label: "TICKET", value: r.ticketType?.name ?? "General admission" },
      ],
      backFields: [
        ...(where ? [{ key: "where", label: "Where", value: where }] : []),
        { key: "link", label: "Your ticket", value: ticketUrl(r.code) },
        { key: "cancel", label: "Can't come?", value: `Cancel your ticket at ${ticketUrl(r.code)}/cancel so someone else can have your place.` },
      ],
    },
  };
}

/** Builds and signs the .pkpass (a zip with a manifest of SHA-1 hashes and a PKCS#7 signature). */
export function buildPkpass(event: PassEvent, r: PassRegistration): Buffer {
  const files: { name: string; data: Buffer }[] = [{ name: "pass.json", data: Buffer.from(JSON.stringify(passJson(event, r))) }];
  const dir = path.join(process.cwd(), "public", "wallet");
  for (const f of ASSETS) files.push({ name: f, data: readFileSync(path.join(dir, f)) });
  const manifest = Buffer.from(JSON.stringify(Object.fromEntries(files.map((f) => [f.name, createHash("sha1").update(f.data).digest("hex")]))));

  const cert = forge.pki.certificateFromPem(pem(process.env.APPLE_WALLET_CERT));
  const wwdr = forge.pki.certificateFromPem(pem(process.env.APPLE_WALLET_WWDR_CERT));
  const passphrase = process.env.APPLE_WALLET_KEY_PASSPHRASE;
  const key = passphrase ? forge.pki.decryptRsaPrivateKey(pem(process.env.APPLE_WALLET_KEY), passphrase) : forge.pki.privateKeyFromPem(pem(process.env.APPLE_WALLET_KEY));
  if (!key) throw new Error("APPLE_WALLET_KEY could not be read (wrong passphrase?)");

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(manifest.toString("binary"));
  p7.addCertificate(cert);
  p7.addCertificate(wwdr);
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  });
  p7.sign({ detached: true });
  const signature = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), "binary");

  return zip([...files, { name: "manifest.json", data: manifest }, { name: "signature", data: signature }]);
}
