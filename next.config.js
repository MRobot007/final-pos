/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
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
