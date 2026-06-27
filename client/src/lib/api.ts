import type {
  Answer,
  Explanation,
  ExtractedDoc,
  Folder,
  Me,
  Note,
  OutputLang,
  Paper,
  PaperStatus,
  Profile,
  QaMessage,
  QaSession,
  Suggestion,
  Summary,
  Tag,
} from "../types";

export interface ProfilePatch {
  interests?: string[];
  domains?: string[];
  organizations?: string[];
  avoid?: string[];
  goal?: string | null;
  level?: string | null;
  readability?: string | null;
  outputLang?: OutputLang;
}

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
  async me(): Promise<Me | null> {
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

  async listFolders(): Promise<Folder[]> {
    const data = await asJson<{ folders: Folder[] }>(await fetch("/api/folders"));
    return data.folders;
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

  async uploadPdf(file: File): Promise<{ paperId: string; deduped: boolean }> {
    const form = new FormData();
    form.append("file", file);
    // No content-type header — the browser sets the multipart boundary.
    const res = await fetch("/api/papers/upload", { method: "POST", body: form });
    if (!res.ok) throw new ApiError(res.status);
    return res.json() as Promise<{ paperId: string; deduped: boolean }>;
  },

  async getPaper(
    id: string,
  ): Promise<{ paper: Paper; tags: Tag[]; folder: Folder | null; indexed: boolean }> {
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

  async askQuestion(
    id: string,
    question: string,
    lang: OutputLang,
    sessionId?: string,
  ): Promise<Answer> {
    return asJson(
      await fetch(`/api/papers/${id}/qa`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question, lang, sessionId }),
      }),
    );
  },

  /** Conversation threads (Q&A sessions) for a paper, most-recent first. */
  async listQaSessions(id: string): Promise<QaSession[]> {
    return (await asJson<{ sessions: QaSession[] }>(await fetch(`/api/papers/${id}/qa/sessions`)))
      .sessions;
  },

  async getSessionMessages(sessionId: string): Promise<QaMessage[]> {
    return (
      await asJson<{ messages: QaMessage[] }>(await fetch(`/api/qa/sessions/${sessionId}/messages`))
    ).messages;
  },

  async deleteQaSession(sessionId: string): Promise<void> {
    await fetch(`/api/qa/sessions/${sessionId}`, { method: "DELETE" });
  },

  async getSummary(id: string, lang: OutputLang): Promise<Summary> {
    return asJson(await fetch(`/api/papers/${id}/summary?lang=${lang}`));
  },

  async getSuggestions(): Promise<{ classic: Suggestion[]; recent: Suggestion[] }> {
    return asJson(await fetch("/api/suggestions"));
  },

  /** Generate + cache suggestions synchronously; returns how many were produced. */
  async refreshSuggestions(): Promise<{ count: number }> {
    return asJson(await fetch("/api/suggestions/refresh", { method: "POST" }));
  },

  async dismissSuggestion(id: string): Promise<void> {
    await fetch(`/api/suggestions/${id}/dismiss`, { method: "POST" });
  },

  /** Server-side ingest from the suggestion's best identifier, then mark imported. */
  async importSuggestion(id: string): Promise<{ paperId: string; deduped: boolean }> {
    return asJson(await fetch(`/api/suggestions/${id}/import`, { method: "POST" }));
  },

  async getProfile(): Promise<Profile | null> {
    const d = await asJson<{ profile: Profile | null }>(await fetch("/api/profile"));
    return d.profile;
  },

  async updateProfile(patch: ProfilePatch): Promise<Profile> {
    const d = await asJson<{ profile: Profile }>(
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      }),
    );
    return d.profile;
  },

  async setStatus(id: string, status: PaperStatus): Promise<void> {
    await fetch(`/api/papers/${id}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
  },

  /** Re-run extract → chunk → embed → index; returns what landed (for diagnostics). */
  async reprocess(
    id: string,
  ): Promise<{ ok: boolean; error: string | null; chunks: number; textStored: boolean }> {
    return asJson(await fetch(`/api/papers/${id}/reprocess`, { method: "POST" }));
  },

  /** User-triggered AI re-classification of a paper's home folder. */
  async reclassify(id: string): Promise<{ folderId: string; folderName: string }> {
    return asJson(await fetch(`/api/papers/${id}/reclassify`, { method: "POST" }));
  },

  async getNotes(id: string): Promise<Note[]> {
    return (await asJson<{ notes: Note[] }>(await fetch(`/api/papers/${id}/notes`))).notes;
  },

  async addNote(id: string, body: string): Promise<Note> {
    return (
      await asJson<{ note: Note }>(
        await fetch(`/api/papers/${id}/notes`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "note", body }),
        }),
      )
    ).note;
  },

  async updateNote(noteId: string, body: string): Promise<void> {
    await fetch(`/api/notes/${noteId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    });
  },

  async deleteNote(noteId: string): Promise<void> {
    await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
  },
};
