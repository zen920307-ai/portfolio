# 作品集管理后台

`design.zenslab.top` 目前由 **GitHub Pages** 返回内容（Cloudflare 负责域名/DNS），不是 Cloudflare Pages/Worker。因此后台发布以 GitHub Pages 的真实链路为准：保存后将内容 JSON 提交到仓库的 `gh-pages` 分支，等待 Pages/CDN 同步，并轮询域名确认新版本。

访问 `/admin` 后，在顶部填入 GitHub fine-grained personal access token：仓库选择 `zen920307-ai/portfolio`，权限仅需 **Contents: Read and write**。令牌只存放在当前浏览器会话中。点击“保存并发布”后，后台会显示「本地草稿 → GitHub 提交 → Pages 同步 → 域名验证」；只有域名读到本次版本号才显示成功。

首次启用前，需要先把含本机制的站点代码部署到 `gh-pages` 一次；之后的内容增删改查不需要重新构建整站。
