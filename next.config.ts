import type { NextConfig } from "next";

// Initialize graceful-fs to handle EMFILE errors

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: false,
  webpack: (config, { dev }) => {
    if (dev) {
      // Use polling with longer intervals
      config.watchOptions = {
        poll: 5000,
        aggregateTimeout: 2000,
        ignored: [
          "**/node_modules/**",
          "/node_modules",
          "/.next",
          "**/.next/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          "**/.DS_Store",
          "**/Thumbs.db",
          "**/coverage/**",
          "**/*.log",
          "**/tmp/**",
          "**/temp/**",
        ],
      };
      // Disable caching and snapshots completely
      config.cache = false;
      config.snapshot = {
        managedPaths: [],
        immutablePaths: [],
        buildDependencies: { hash: false },
        module: { hash: false },
        resolve: { hash: false },
        resolveBuildDependencies: { hash: false },
      };
      // Reduce parallelism
      config.parallelism = 1;
    }
    return config;
  },
};

export default nextConfig;
