/** @type {import('next').NextConfig} */

// アプリ機能を壊さない範囲のセキュリティヘッダ(CSPは誤設定で壊れやすいので別途要検証)
const securityHeaders = [
  // 常にHTTPSを強制(2年・サブドメイン含む)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // MIMEタイプ詐称によるXSSを防ぐ
  { key: "X-Content-Type-Options", value: "nosniff" },
  // 他サイトへ送るRefererを最小化
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // 使わない端末機能を全部無効化
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // クリックジャッキング対策。本番URLをiframe埋め込み(ポートフォリオ等)してないなら有効化推奨:
  // { key: "X-Frame-Options", value: "SAMEORIGIN" },
];

const nextConfig = {
  // 個人用ローカルツール。型チェックは有効、ESLint はビルドを止めない。
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
