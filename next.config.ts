import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/*.yaml is read from disk at runtime, which file tracing can't see.
  // Without this, serverless functions on Netlify deploy without the content.
  outputFileTracingIncludes: {
    "/*": ["./data/**/*.yaml"],
  },
};

export default nextConfig;
