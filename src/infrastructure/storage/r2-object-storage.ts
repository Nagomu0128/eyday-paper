import type { ObjectStorage, StoredObject } from "../../domain/storage/object-storage";

/** R2-backed object storage. Egress-free reads for repeatedly-opened PDFs. */
export class R2ObjectStorage implements ObjectStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(key: string, body: ArrayBuffer | string, contentType?: string): Promise<void> {
    await this.bucket.put(key, body, contentType ? { httpMetadata: { contentType } } : undefined);
  }

  async get(key: string): Promise<StoredObject | null> {
    const obj = await this.bucket.get(key);
    if (!obj) return null;
    return { body: await obj.arrayBuffer(), contentType: obj.httpMetadata?.contentType ?? null };
  }

  async getText(key: string): Promise<string | null> {
    const obj = await this.bucket.get(key);
    return obj ? obj.text() : null;
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
