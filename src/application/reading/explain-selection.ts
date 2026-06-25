import type { OutputLang } from "../../domain/identity/profile";
import type { PaperRepository } from "../../domain/library/types";
import type { Explainer, Explanation } from "../../domain/reading/ports";
import { AppError } from "../../shared/errors";

export interface ExplainSelectionRequest {
  userId: string;
  paperId: string;
  selectedText: string;
  context: string | null;
  section: string | null;
  page: number | null;
  lang: OutputLang;
}

export interface ExplainSelectionDeps {
  papers: PaperRepository;
  explainer: Explainer;
}

/**
 * Explain-on-selection/tap. Verifies the paper belongs to the requester, then
 * asks the explainer using the selection + surrounding context. The answer
 * carries a source span (section/page) so the user can verify against the original.
 */
export class ExplainSelection {
  constructor(private readonly deps: ExplainSelectionDeps) {}

  async execute(req: ExplainSelectionRequest): Promise<Explanation> {
    const paper = await this.deps.papers.findById(req.userId, req.paperId);
    if (!paper) throw new AppError("not_found", "paper not found");
    if (req.selectedText.trim().length === 0) {
      throw new AppError("validation", "selectedText is required");
    }

    return this.deps.explainer.explain({
      title: paper.title,
      selectedText: req.selectedText,
      context: req.context,
      section: req.section,
      page: req.page,
      lang: req.lang,
    });
  }
}
