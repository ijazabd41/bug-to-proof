export default [
  {
    resolve: { extensions: [".tsx", ".ts", ".jsx", ".js", ".json"] },
    test: {
      name: "minishop",
      environment: "jsdom",
      globals: true,
      setupFiles: ["./apps/minishop/src/setupTests.ts"],
      include: ["apps/minishop/src/**/*.test.tsx", "apps/minishop/src/**/*.test.ts"],
      fileParallelism: false,
    },
  },
  {
    resolve: { extensions: [".tsx", ".ts", ".jsx", ".js", ".json"] },
    test: {
      name: "dashboard",
      environment: "jsdom",
      globals: true,
      setupFiles: ["./apps/dashboard/src/setupTests.ts"],
      include: ["apps/dashboard/src/**/*.test.tsx", "apps/dashboard/src/**/*.test.ts"],
      fileParallelism: false,
    },
  },
  {
    test: {
      name: "api",
      environment: "node",
      include: ["services/api/src/**/*.test.ts", "scripts/**/*.test.ts"],
      fileParallelism: false,
    },
  },
];

