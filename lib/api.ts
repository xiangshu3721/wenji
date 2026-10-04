/**
 * 对话接口地址。
 * - 本地开发：同源 /api/ask（Next 自带路由）
 * - GitHub Pages：构建时用 NEXT_PUBLIC_API_URL 指向云端接口（这里只有网址，没有任何密钥）
 */
export const ASK_URL = process.env.NEXT_PUBLIC_API_URL || "/api/ask";
