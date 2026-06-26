import { type FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import {
  IconChevronDown,
  IconChevronRight,
  IconDoc,
  IconFolder,
  IconFolderOpen,
  IconLibrary,
  IconPlus,
  IconSearch,
  IconSpinner,
} from "../lib/icons";
import type { Folder, Paper, PaperStatus } from "../types";
import { Button, EmptyState, StatusBadge } from "./ui";

type StatusFilter = "all" | PaperStatus;
type Sort = "added-desc" | "added-asc" | "title" | "year-desc";

const SORTS: { value: Sort; label: string }[] = [
  { value: "added-desc", label: "新しい順" },
  { value: "added-asc", label: "古い順" },
  { value: "title", label: "タイトル" },
  { value: "year-desc", label: "発行年" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "unread", label: "未読" },
  { value: "reading", label: "読書中" },
  { value: "read", label: "読了" },
];

interface FolderNode {
  folder: Folder;
  children: FolderNode[];
  papers: Paper[];
}

const sortPapers = (papers: Paper[], sort: Sort): Paper[] =>
  [...papers].sort((a, b) => {
    switch (sort) {
      case "title":
        return a.title.localeCompare(b.title);
      case "year-desc":
        return (b.year ?? 0) - (a.year ?? 0);
      case "added-asc":
        return (a.addedAt ?? "").localeCompare(b.addedAt ?? "");
      default:
        return (b.addedAt ?? "").localeCompare(a.addedAt ?? "");
    }
  });

const subtreeCount = (n: FolderNode): number =>
  n.papers.length + n.children.reduce((s, c) => s + subtreeCount(c), 0);

export function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("added-desc");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = () => {
    api
      .listPapers()
      .then(setPapers)
      .catch(() => setError("一覧の取得に失敗しました"));
    api
      .listFolders()
      .then(setFolders)
      .catch(() => setFolders([]));
  };
  useEffect(load, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = input.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await api.ingest(value);
      setInput("");
      load();
    } catch {
      setError("取り込みに失敗しました。arXiv ID / DOI / URL を確認してください。");
    } finally {
      setBusy(false);
    }
  };

  const all = papers ?? [];
  const counts = {
    all: all.length,
    unread: all.filter((p) => p.status === "unread").length,
    reading: all.filter((p) => p.status === "reading").length,
    read: all.filter((p) => p.status === "read").length,
  };

  const q = query.trim().toLowerCase();
  const filtering = q.length > 0 || status !== "all";

  const { roots, uncategorized } = useMemo(() => {
    const visible = all.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (!q) return true;
      const hay =
        `${p.title} ${p.authors.join(" ")} ${p.venue ?? ""} ${p.arxivId ?? ""}`.toLowerCase();
      return hay.includes(q);
    });

    const byFolder = new Map<string | null, Paper[]>();
    for (const p of visible) {
      const key = p.primaryFolderId;
      const list = byFolder.get(key) ?? [];
      list.push(p);
      byFolder.set(key, list);
    }

    const nodes = new Map<string, FolderNode>();
    for (const f of folders) {
      nodes.set(f.id, { folder: f, children: [], papers: byFolder.get(f.id) ?? [] });
    }
    const rootNodes: FolderNode[] = [];
    for (const f of folders) {
      const node = nodes.get(f.id);
      if (!node) continue;
      const parent = f.parentId ? nodes.get(f.parentId) : undefined;
      if (parent) parent.children.push(node);
      else rootNodes.push(node);
    }

    const known = new Set(folders.map((f) => f.id));
    const uncat: Paper[] = [];
    for (const [fid, list] of byFolder) {
      if (fid === null || !known.has(fid)) uncat.push(...list);
    }

    return { roots: rootNodes, uncategorized: uncat };
  }, [all, folders, q, status]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const isOpen = (id: string) => filtering || !collapsed.has(id);

  const renderFolder = (node: FolderNode, depth: number): React.ReactNode => {
    const count = subtreeCount(node);
    if (count === 0) return null;
    const open = isOpen(node.folder.id);
    return (
      <div key={node.folder.id}>
        <button
          type="button"
          onClick={() => toggle(node.folder.id)}
          style={{ paddingLeft: 12 + depth * 18 }}
          className="flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-[0.9rem] font-medium text-ink transition-colors hover:bg-surface-muted"
        >
          <span className="text-ink-faint">
            {open ? <IconChevronDown /> : <IconChevronRight />}
          </span>
          <span className="text-[1.1rem] text-primary">
            {open ? <IconFolderOpen /> : <IconFolder />}
          </span>
          <span className="flex-1 truncate">{node.folder.name}</span>
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[0.7rem] font-medium text-ink-muted">
            {count}
          </span>
        </button>
        {open && (
          <div>
            {node.children.map((c) => renderFolder(c, depth + 1))}
            {sortPapers(node.papers, sort).map((p) => (
              <PaperRow key={p.id} paper={p} depth={depth + 1} onOpen={onOpen} />
            ))}
          </div>
        )}
      </div>
    );
  };

  const nothing =
    papers !== null && roots.every((r) => subtreeCount(r) === 0) && uncategorized.length === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl px-5 py-7 sm:px-8">
        <div className="mb-7">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Library</h1>
          <p className="mt-1 text-sm text-ink-muted">
            リンクや PDF を投げ込むと、自動で整理・蓄積します。
          </p>
        </div>

        {/* Ingest */}
        <form
          onSubmit={submit}
          className="rounded-2xl border border-line bg-surface p-2 shadow-card"
        >
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-1 items-center gap-2.5 rounded-xl px-3">
              <IconPlus className="text-[1.2rem] text-primary" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="arXiv ID / DOI / URL を貼り付け（例: 1706.03762）"
                className="h-11 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-ink-faint"
              />
            </div>
            <Button type="submit" variant="primary" size="lg" disabled={busy} className="sm:w-auto">
              {busy ? <IconSpinner /> : <IconPlus />}
              {busy ? "取り込み中…" : "取り込む"}
            </Button>
          </div>
        </form>
        {error && <p className="mt-2.5 px-1 text-sm text-danger">{error}</p>}

        {/* Toolbar */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <div className="flex h-10 min-w-[12rem] flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
            <IconSearch className="text-[1.1rem] text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="タイトル・著者で検索"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-ink-faint"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none"
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
                {s.value !== "all" ? ` (${counts[s.value]})` : ""}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="mt-3 flex items-center gap-1.5 text-[0.75rem] text-ink-muted">
          <IconLibrary className="text-[1rem]" />
          <span>
            全 <span className="font-semibold text-ink">{counts.all}</span> 件
          </span>
          <span className="text-ink-faint">·</span>
          <span>未読 {counts.unread}</span>
          <span>読書中 {counts.reading}</span>
          <span>読了 {counts.read}</span>
        </div>

        {/* Tree */}
        <div className="mt-4 rounded-2xl border border-line bg-surface p-2 shadow-card">
          {papers === null ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink-faint">
              <IconSpinner className="text-[1.2rem]" /> 読み込み中…
            </div>
          ) : nothing ? (
            filtering ? (
              <EmptyState
                icon={<IconSearch />}
                title="該当する論文がありません"
                description="検索条件や絞り込みを変えてみてください。"
              />
            ) : (
              <EmptyState
                icon={<IconLibrary />}
                title="まだ論文がありません"
                description="上のバーに arXiv ID・DOI・URL を貼り付けて取り込みましょう。"
              />
            )
          ) : (
            <div className="py-1">
              {roots.map((r) => renderFolder(r, 0))}
              {uncategorized.length > 0 && (
                <div>
                  {roots.some((r) => subtreeCount(r) > 0) && (
                    <div className="mx-3 my-2 border-t border-line" />
                  )}
                  <p className="px-3 py-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-faint">
                    未分類
                  </p>
                  {sortPapers(uncategorized, sort).map((p) => (
                    <PaperRow key={p.id} paper={p} depth={0} onOpen={onOpen} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaperRow({
  paper,
  depth,
  onOpen,
}: {
  paper: Paper;
  depth: number;
  onOpen: (id: string) => void;
}) {
  const meta = [
    paper.authors.join(", ") || "—",
    paper.year ? String(paper.year) : null,
    paper.venue,
    paper.arxivId ? `arXiv:${paper.arxivId}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <button
      type="button"
      onClick={() => onOpen(paper.id)}
      style={{ paddingLeft: 12 + depth * 18 }}
      className="group flex w-full items-center gap-3 rounded-lg py-2.5 pr-3 text-left transition-colors hover:bg-primary-softer"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-[1.15rem] text-ink-muted ring-1 ring-line transition-colors group-hover:bg-primary-soft group-hover:text-primary">
        <IconDoc />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.92rem] font-medium text-ink group-hover:text-primary-ink">
          {paper.title}
        </span>
        <span className="block truncate text-[0.78rem] text-ink-muted">{meta}</span>
      </span>
      <StatusBadge status={paper.status} className="hidden shrink-0 sm:inline-flex" />
    </button>
  );
}
