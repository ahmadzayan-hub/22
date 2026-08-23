// Static export for GitHub Pages only (see ../../.github/workflows/nextjs.yml,
// the only place that sets NEXT_BASE_PATH). Everywhere else — local dev,
// docker-compose, a real host like Vercel — this must stay a normal server
// build: apps/web/Dockerfile runs `next build && next start`, which needs
// the server output, not a static export.
/** @type {import('next').NextConfig} */
const nextConfig = process.env.NEXT_BASE_PATH
  ? { output: "export", basePath: process.env.NEXT_BASE_PATH, images: { unoptimized: true } }
  : {};

export default nextConfig;
