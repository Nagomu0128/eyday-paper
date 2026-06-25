/** Tenant-scoped R2 key layout (design doc §6 / CLAUDE.md §10). Pure, no I/O. */
export const r2Keys = {
  pdf: (userId: string, paperId: string) => `pdf/${userId}/${paperId}.pdf`,
  text: (userId: string, paperId: string) => `text/${userId}/${paperId}.json`,
  figure: (userId: string, paperId: string, n: number) => `fig/${userId}/${paperId}/${n}.png`,
} as const;
