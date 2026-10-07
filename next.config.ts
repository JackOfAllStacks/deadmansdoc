import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/*.yaml is read from disk at runtime, which file tracing can't see.
  // Without this, serverless functions on Netlify deploy without the content.
  outputFileTracingIncludes: {
    "/*": ["./data/**/*.yaml"],
  },
  // pdfkit loads the metrics for the standard PDF fonts from its own package
  // at runtime. Bundled, those files aren't there and every PDF fails.
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
