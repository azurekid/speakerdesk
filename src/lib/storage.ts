import "server-only";
import { BlobServiceClient } from "@azure/storage-blob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Stores public assets (headshots). Uses Azure Blob Storage when
 * AZURE_STORAGE_CONNECTION_STRING is set; otherwise writes to ./public/uploads
 * (development only — files written there after build are not served in production).
 *
 * The container must allow anonymous *blob* read access, or be fronted by
 * Azure Front Door / CDN configured via AZURE_STORAGE_PUBLIC_BASE_URL.
 */
export async function putPublicFile(key: string, body: Buffer, contentType: string): Promise<string> {
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (conn) {
    const containerName = process.env.AZURE_STORAGE_CONTAINER || "headshots";
    const container = BlobServiceClient.fromConnectionString(conn).getContainerClient(containerName);
    const blob = container.getBlockBlobClient(key);
    await blob.uploadData(body, {
      blobHTTPHeaders: { blobContentType: contentType, blobCacheControl: "public, max-age=31536000, immutable" },
    });
    const base = process.env.AZURE_STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, "");
    return base ? `${base}/${key}` : blob.url;
  }

  if (process.env.NODE_ENV === "production") throw new Error("Blob storage is not configured");
  const target = path.join(process.cwd(), "public", "uploads", key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  const base = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "") ?? "http://localhost:3000";
  return `${base}/uploads/${key}`;
}

/** Detects the image type from magic bytes (never trust the client-sent MIME type). */
export function sniffImage(buf: Buffer): { ext: string; mime: string } | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: "png", mime: "image/png" };
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return { ext: "webp", mime: "image/webp" };
  return null;
}
