/**
 * DDD dependency rule enforcement (CLAUDE.md §3): dependencies point inward.
 *   interface -> application -> domain ;  infrastructure -> domain ;  shared <- (everyone)
 * domain knows nothing about frameworks/IO. Only runtime deps are checked
 * (tsPreCompilationDeps:false) so type-only imports across layers are allowed.
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Circular dependencies make the graph impossible to reason about.",
      from: {},
      to: { circular: true },
    },
    {
      name: "domain-points-inward-only",
      severity: "error",
      comment: "domain must not depend on application/infrastructure/interface.",
      from: { path: "^src/domain" },
      to: { path: "^src/(application|infrastructure|interface)" },
    },
    {
      name: "domain-is-pure",
      severity: "error",
      comment: "domain must be pure TS: no framework/IO npm packages at runtime.",
      from: { path: "^src/domain" },
      to: { dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "core"] },
    },
    {
      name: "application-no-infra-or-interface",
      severity: "error",
      comment: "application orchestrates domain via ports; never imports infra/interface.",
      from: { path: "^src/application" },
      to: { path: "^src/(infrastructure|interface)" },
    },
    {
      name: "infrastructure-no-interface-or-application",
      severity: "error",
      comment: "infrastructure implements domain ports; never depends on interface/application.",
      from: { path: "^src/infrastructure" },
      to: { path: "^src/(interface|application)" },
    },
    {
      name: "shared-depends-on-nothing-internal",
      severity: "error",
      comment: "shared is cross-cutting and must not depend on any other layer.",
      from: { path: "^src/shared" },
      to: { path: "^src/(domain|application|infrastructure|interface)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: false,
    tsConfig: { fileName: "tsconfig.worker.json" },
    enhancedResolveOptions: {
      conditionNames: ["import", "require", "node", "default", "workerd"],
      mainFields: ["module", "main", "types"],
    },
  },
};
