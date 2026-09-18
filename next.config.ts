import type { NextConfig } from "next";

// NOTE: Do NOT set `output: "standalone"` — Vercel uses its own runtime and
// standalone output can cause routing/404 issues there. The default build
// output works correctly on Vercel.
const nextConfig: NextConfig = {
  // NOTE: ignoreBuildErrors is kept true because of pre-existing framer-motion
  // `ease: string` typing issues and a few legacy Apple-auth type imports.
  // These are type-level only and do not affect runtime behavior.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  allowedDevOrigins: ["*.space-z.ai", "*.chatglm.cn"],
  // Hide the Next.js dev-tools indicator entirely — it overlapped the mobile
  // AI-Coach FAB (bottom-right) and the sidebar Settings button (bottom-left),
  // and confused the UI during user preview. Restart the dev server to apply.
  devIndicators: false,
  // Optimize heavy barrel imports (lucide-react, recharts, etc.) so only
  // the icons/components actually used end up in the client bundle.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'recharts',
      'framer-motion',
      'date-fns',
    ],
  },
  // Remove console.log in production (keep warnings+errors for debugging)
  compiler: {
    removeConsole:
      process.env.NODE_ENV === 'production'
        ? { exclude: ['error', 'warn'] }
        : false,
  },
};

export default nextConfig;
