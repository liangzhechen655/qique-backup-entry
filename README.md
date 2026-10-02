# 七雀牌备用入口

原网址继续保留：https://qique-friends-20261001.zheliang655.chatgpt.site

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

需要先连接用户自己的 Render 账号，并允许它读取这份备用入口的代码仓库，再创建免费 Web Service。发布成功后使用平台实际返回的 `onrender.com` 地址。

免费服务闲置 15 分钟会休眠，首次重新打开大约需要一分钟。免费时长、流量及构建用量有额度；无需为了这项测试添加付款方式。官方限制：https://render.com/docs/free

## 国内访问验证

部署成功并不等于已验证中国大陆直连。需在国内手机关闭 VPN 后检查：能加载页面和手牌、能加入四人房间、能连续摸牌出牌、能播放语音。分别使用手机移动网络与 Wi-Fi 测试，才能确认这条备用入口是否适用。

当前准备阶段不改变原站的访问权限和部署。备用入口依赖原站正常运行；如果免费备用服务器暂时休眠或不可达，仍可使用原网址。

## 临时互联网测试入口

`start-temporary.ps1` 用 Cloudflare Quick Tunnel 给本地备用程序创建临时 HTTPS 网址。先将 Cloudflare 官方 Windows 64 位 `cloudflared.exe` 下载到 `.runtime`，再运行此脚本。它在后台启动程序，不添加开机启动项，不改变 VPN、DNS 或防火墙设置。运行 `stop-temporary.ps1` 可停止本次入口。

这不是长期云服务器：本机需要保持开机、联网，并能访问原站。关闭本机或停止隧道后链接失效，每次重新启动隧道的网址可能不同。国内直连仍需实际测试。

官方说明：https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/
