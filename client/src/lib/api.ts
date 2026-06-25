import type { Explanation, ExtractedDoc, Folder, OutputLang, Paper, Tag } from "../types";

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`API error ${status}`);
  }
}

const asJson = async <T>(res: Response): Promise<T> => {
  if (!res.ok) throw new ApiError(res.status);
  return res.json() as Promise<T>;
};

export const api = {
  async me(): Promise<{ userId: string } | null> {
    const res = await fetch("/api/me");
    if (res.status === 401) return null;
    return asJson(res);
  },

  async signInGoogle(): Promise<void> {
    const res = await fetch("/api/auth/sign-in/social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "google", callbackURL: window.location.origin }),
    });
    const data = (await res.json().catch(() => null)) as { url?: string } | null;
    if (data?.url) window.location.href = data.url;
  },

  async signOut(): Promise<void> {
    await fetch("/api/auth/sign-out", { method: "POST" });
    window.location.reload();
  },

  async listPapers(): Promise<Paper[]> {
    const data = await asJson<{ papers: Paper[] }>(await fetch("/api/papers"));
    return data.papers;
  },

  async ingest(input: string): Promise<{ paperId: string; deduped: boolean }> {
    return asJson(
      await fetch("/api/papers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      }),
    );
  },

  async getPaper(id: string): Promise<{ paper: Paper; tags: Tag[]; folder: Folder | null }> {
    return asJson(await fetch(`/api/papers/${id}`));
  },

  async getText(id: string): Promise<ExtractedDoc | null> {
    const res = await fetch(`/api/papers/${id}/text`);
    if (res.status === 409 || res.status === 404) return null;
    return asJson(res);
  },

  pdfUrl: (id: string): string => `/api/papers/${id}/pdf`,

  async explain(
    id: string,
    body: { selectedText: string; context?: string; section?: string; lang: OutputLang },
  ): Promise<Explanation> {
    return asJson(
      await fetch(`/api/papers/${id}/explain`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  },
};
