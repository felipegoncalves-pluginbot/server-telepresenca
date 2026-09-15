/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "Circular dependencies break the layered layout.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "server-not-to-public",
      comment: "Node server must not import browser code.",
      severity: "error",
      from: { path: "^src" },
      to: { path: "^public" },
    },
    {
      name: "protocol-is-leaf",
      comment: "public/js/protocol is a leaf (contracts only).",
      severity: "error",
      from: { path: "^public/js/protocol" },
      to: { path: "^public/js", pathNot: "^public/js/protocol" },
    },
    {
      name: "features-not-to-webrtc",
      comment: "Feature widgets must not create or touch PeerConnection.",
      severity: "error",
      from: { path: "^public/js/features" },
      to: { path: "^public/js/webrtc" },
    },
    {
      name: "no-orphans",
      severity: "warn",
      from: { orphan: true, pathNot: "(\\.d\\.ts$|eslint\\.config\\.js$)" },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: false,
    combinedDependencies: true,
  },
};
