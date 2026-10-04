// 构建 GitHub Pages 静态版：临时移走 app/api（静态导出不支持服务端路由），构建后还原。
import { existsSync, renameSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

const apiDir = "app/api";
const backup = ".api.bak";
if (existsSync(backup)) throw new Error(".api.bak 已存在，先处理它");
if (existsSync(apiDir)) renameSync(apiDir, backup);

rmSync(".next", { recursive: true, force: true });
const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  env: { ...process.env, GITHUB_PAGES: "true" },
});

if (existsSync(backup)) renameSync(backup, apiDir);

if (result.status === 0 && existsSync("out/index.html")) {
  writeFileSync("out/.nojekyll", "");
  copyFileSync("out/index.html", "out/404.html");
}
process.exit(result.status ?? 1);
