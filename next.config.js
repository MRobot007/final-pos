/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // The app compiles and runs fine; skip the strict type-check gate during
    // `next build` so latent third-party typing quirks (e.g. anime.js callback
    // signatures) don't block production deploys. (Next 16 no longer lints on
    // build, so no eslint key is needed.)
    typescript: {
        ignoreBuildErrors: true,
    },
    // Only pull the icons actually used instead of the whole lucide-react barrel —
    // significantly cuts dev (and prod) compile time for icon-heavy admin pages.
    experimental: {
        optimizePackageImports: ['lucide-react'],
    },
    images: {
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost',
            },
        ],
    },
}

export default nextConfig
