/** @type {import('next').NextConfig} */
const nextConfig = {
  // Playwright와 chromium은 서버리스 함수에서만 쓰이므로 번들링 제외
  experimental: {
    serverComponentsExternalPackages: ['@sparticuz/chromium', 'playwright-core'],
  },
  // Vercel 서버리스 함수의 타임아웃·메모리 설정은 vercel.json에서
};

module.exports = nextConfig;
