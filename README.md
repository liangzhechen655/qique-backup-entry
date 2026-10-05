# 七雀牌备用入口

原网址继续保留：https://qique-friends-20261001.zheliang655.chatgpt.site

已上线免费云入口：https://qique-backup-entry.onrender.com （Render 新加坡，free 套餐）。云入口独立于本机运行，包含新版人机对战和模拟金额结算。

这份程序提供第二个游戏入口。手机只连接备用网址，游戏页面、静态资源、36 个语音片段和联机 API 都由服务器转发到固定的原站。两个入口共用房间、积分和金额账本，不需要重新迁移数据库。它不接受任意转发目标，也不会记录座位凭证或操作内容。

## 本地验证

Node.js 22 或以上，无第三方依赖。

```sh
node --test test/gateway.test.mjs
node server.mjs
```

默认端口为 8080。云平台通过 `PORT` 环境变量指定端口。健康检查路径为 `/healthz`。

## 免费发布到 Render

`render.yaml` 明确指定新加坡地区、`free` 计算套餐，不创建付费数据库、不设置定时任务、不启用付费保活。构建命令为 `node --check server.mjs`，启动命令为 `node server.mjs`。

代码库已获用户授权设为公开，只包含入口程序和验证脚本；玩家、账单、密钥和本机运行日志不在代码库中。云服务已创建，自动部署关闭，后续代码修改需手动发布。游戏更新通过原站实时生效，无需重新发布入口。

免费服务闲置 15 分钟会休眠，首次重新打开大约需要一分钟。免费时长、流量及构建用量有额度；无需为了这项测试添加付款方式。官方限制：https://render.com/docs/free

## 国内访问验证

部署成功并不等于已验证中国大陆直连。需在国内手机关闭 VPN 后检查：能加载页面和手牌、能加入四人房间、能连续摸牌出牌、能播放语音。分别使用手机移动网络与 Wi-Fi 测试，才能确认这条备用入口是否适用。

备用入口共用原站的房间和账本，依赖原站正常运行。原站的网址与公开访问权限保留。

## 临时互联网测试入口

`start-temporary.ps1` 用 Cloudflare Quick Tunnel 给本地备用程序创建临时 HTTPS 网址。先将 Cloudflare 官方 Windows 64 位 `cloudflared.exe` 下载到 `.runtime`，再运行此脚本。它在后台启动程序，不添加开机启动项，不改变 VPN、DNS 或防火墙设置。运行 `stop-temporary.ps1` 可停止本次入口。

临时入口本身需要本机保持开机和联网；Render 云入口不需要本机开机。关闭本机或停止隧道后临时链接失效，每次重新启动隧道的网址可能不同。

临时脚本默认通过已上线的 Render 入口转接，避免本机直连原站时受到 Cloudflare 拦截。`start-temporary.ps1 -Upstream original` 可改为直连原站。切换时只替换由本脚本拥有的入口进程，保留已有隧道和网址。`QIQUE_UPSTREAM` 只接受 `original` 或 `render`，转发目标固定为本人的两个入口；云服务默认使用 `original`，不要在云服务上设为 `render` 造成自循环。

官方说明：https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
