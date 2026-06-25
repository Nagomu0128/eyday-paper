/**
 * Object storage port (implemented by R2). Keys are tenant-scoped by the caller
 * (e.g. `pdf/{userId}/{paperId}.pdf`); see infrastructure key builders.
 */
export interface StoredObject {
  body: ArrayBuffer;
  contentType: string | null;
}

export interface ObjectStorage {
  put(key: string, body: ArrayBuffer | string, contentType?: string): Promise<void>;
  get(key: string): Promise<StoredObject | null>;
  getText(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}
