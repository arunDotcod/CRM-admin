// Dotcod Admin (Slice BO, BO16). Browser calls go to same-origin /api/v1/admin/*, which Next
// rewrites to the Nest API, so the staff refresh cookie (`dotcod_admin_rt`, Path
// /api/v1/admin/auth, SameSite=Strict) stays first-party. The browser's Origin header is passed
// through, and the API refuses admin routes whose Origin is not ADMIN_PORTAL_ORIGIN.
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4100';

// Staff screens must never be framed, cached by shared caches, or indexed.
const ADMIN_SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
];

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: ADMIN_SECURITY_HEADERS }];
  },
  async rewrites() {
    return {
      beforeFiles: [
        {
          // Only the admin API is proxied: this app never talks to customer routes.
          source: '/api/v1/admin/:path*',
          destination: `${API_PROXY_TARGET.replace(/\/$/, '')}/api/v1/admin/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
