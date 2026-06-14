# 部署指南（六度搭桥）—— 大陆备案 / 香港免备案

本项目是 **Next.js + better-sqlite3**：数据存在服务器本地文件（`data/*.db`）。
因此**必须部署在有持久磁盘的云服务器/轻量服务器上，不能用 Serverless / 函数计算**（那类磁盘是临时的，数据会丢）。

本项目有两条上线路线，**第 2 步起的部署完全相同**，区别只在域名/备案：

- **A. 大陆服务器（需备案）**：访问最快最稳，但要 ICP 备案，1–20 个工作日。见「0-A」。
- **B. 香港服务器（免备案，推荐快速上线）**：买完当天可用，省掉备案等待；大陆能访问，速度略逊于大陆本地，选对大陆优化的线路即可。见「0-B」。

推荐架构：**轻量服务器（Ubuntu）+ Node 20 + pm2 + nginx + 域名 + HTTPS**。

---

## 0-A. 路线 A 先决条件：ICP 备案（大陆服务器才需要）

在**大陆**服务器上用域名对外服务是强制要备案的，没备案服务商会封掉 80/443 端口。

1. 先买好大陆云服务器和域名，用同一个云账号；
2. 在云厂商控制台「备案」入口提交：主体信息、域名、服务器、人脸核验；
3. 周期通常 **1–20 个工作日**，期间网站无法用域名对外访问；
4. 备案下来会有「备案号」，需在网站底部展示。

> 备案是你本人/公司的实名事项，只能你自己做。

## 0-B. 路线 B：香港服务器（免备案）

- **不需要备案**：备案是大陆法规，香港/海外服务器不受管辖，买完即可用域名对外。
- **大陆可访问**：香港不在大陆封锁范围内，大陆用户可正常访问；但跨境速度/稳定性不如大陆本地服务器。
- **务必选对大陆优化的线路**：腾讯云香港轻量 / 阿里云香港轻量（人民币结算、线路对大陆友好），或带 **CN2 GIA** 线路的服务商。**别买线路差的廉价国外 VPS**，大陆访问会很卡。
- **域名无需备案**：任意注册商注册一个域名，DNS 直接解析到香港 IP 即可。
- **微信链接拦截**：能否在微信里点开，与备案/服务器位置关系不大；但「转发给朋友」的接力玩法可能触发微信「诱导分享」检测被拦——本程序的**二维码海报**就是兜底（长按识别二维码可绕开）。

走路线 B 时，跳过 0-A，直接看第 1 步（买香港服务器）和后续步骤即可。

---

## 1. 买服务器与域名

- **服务器**：
  - 路线 A：腾讯云/阿里云**大陆**轻量服务器；
  - 路线 B：腾讯云/阿里云**香港**轻量服务器（或 CN2 GIA 线路）。
  - 系统 **Ubuntu 22.04/24.04**，规格 **2核2G** 起步够用。
- **域名**：路线 A 需在大陆云厂商注册并备案；路线 B 任意注册商，**无需备案**。
- **安全组/防火墙**：放行 **22（SSH）、80、443** 端口。

---

## 2. 服务器装环境

SSH 登录后（Ubuntu）：

```bash
# 更新 + 基础工具（better-sqlite3 原生模块在没有预编译包时需要 build 工具）
sudo apt update && sudo apt install -y git nginx build-essential python3 curl

# 安装 Node 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # 应为 v20.x

# 启用 pnpm（项目用 pnpm）
sudo corepack enable
corepack prepare pnpm@latest --activate

# pm2 守护进程
sudo npm i -g pm2
```

---

## 3. 上传代码

仓库在 GitHub，国内服务器直连 GitHub 可能慢/不稳，三选一：

- **A. 直接 clone**（网络好时）：
  ```bash
  sudo mkdir -p /var/www && cd /var/www
  git clone https://github.com/wungyuan/Helpme.git helpme
  ```
- **B. Gitee 镜像**：把仓库导入 Gitee，再从 Gitee clone（国内最稳）。
- **C. 本地打包上传**：本地 `git archive` 或直接 `scp` 项目（不含 node_modules）到服务器。

---

## 4. 配置环境变量与数据目录

数据库放在**仓库目录之外**的持久路径，这样以后 `git pull` 更新代码不会动到数据：

```bash
sudo mkdir -p /var/lib/helpme
sudo chown -R $USER:$USER /var/lib/helpme
```

在项目根目录创建 `.env.local`（**不进 git**，Next.js 启动时自动读取）：

```bash
cd /var/www/helpme
cat > .env.local <<'EOF'
# 数据库持久路径（仓库目录之外，更新代码不丢数据）
DB_PATH=/var/lib/helpme/helpme.db
# 开发者后台 /admin 的口令，换成只有你知道的复杂值
ADMIN_KEY=换成你的复杂口令
EOF
```

---

## 5. 安装依赖并构建

```bash
cd /var/www/helpme
pnpm install            # 安装含 dev 依赖（构建需要）
pnpm build              # 生产构建
```

> 若 better-sqlite3 在此步报编译错误，确认第 2 步的 `build-essential python3` 已装，再 `pnpm rebuild better-sqlite3`。

---

## 6. 用 pm2 启动并设开机自启

项目已带 `ecosystem.config.js`（监听 3000 端口）：

```bash
cd /var/www/helpme
pm2 start ecosystem.config.js
pm2 save
pm2 startup            # 按提示复制执行它输出的那条 sudo 命令，实现开机自启
pm2 logs helpme        # 看日志，确认无报错
```

此时本机自测：`curl -I http://127.0.0.1:3000` 应返回 200。

---

## 7. nginx 反代 + HTTPS

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/helpme
sudo nano /etc/nginx/sites-available/helpme    # 把 your-domain.com 换成你已备案的域名
sudo ln -s /etc/nginx/sites-available/helpme /etc/nginx/sites-enabled/
```

先把域名 DNS **A 记录**解析到服务器公网 IP（路线 A 需备案通过后才生效；路线 B 香港即时生效）。

**HTTPS 证书**两种方式任选：

- **certbot 自动签发**（推荐，香港免备案也可用；需域名已解析到本机、80 端口可达）：
  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d your-domain.com
  ```
- **云厂商免费证书**：在腾讯云/阿里云「SSL 证书」申请免费 DV 证书 → 下载 nginx 版本 → 上传到 `/etc/nginx/ssl/` → 路径填进配置。

配置好后：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. 验证上线

- 浏览器访问 `https://你的域名/` → 首页正常；
- `https://你的域名/admin` → 输入 ADMIN_KEY 能进后台；
- 微信里把首页/求助链接发给自己 → 一般可点击打开；若被微信拦截（「诱导分享」检测，与备案/服务器位置无关），用程序里的**二维码海报**长按识别打开。

---

## 9. 以后更新部署

```bash
cd /var/www/helpme
git pull                 # 或重新上传代码
pnpm install
pnpm build
pm2 reload helpme        # 平滑重启，数据库在 /var/lib/helpme 不受影响
```

---

## 10. 数据备份（重要）

SQLite 就是一个文件，定时备份即可：

```bash
# 简单做法：每天 cron 拷一份
0 3 * * * cp /var/lib/helpme/helpme.db /var/lib/helpme/backup-$(date +\%F).db
```

---

## 注意事项

- **微信内可点击链接**：普通域名（含香港免备案）一般可在微信内打开；被拦多因「诱导分享」检测，与备案/服务器位置关系不大。当前 H5 已有「文案+二维码海报」兜底，长按识别二维码可绕开。若以后要公众号自定义分享卡片，需备案域名 + 「JS 接口安全域名 / 业务域名」校验。
- **不要把 `data/` 和 `.env.local` 提交进 git**（已在 `.gitignore` 忽略）。生产数据库放 `/var/lib/helpme`。
- **小程序**：若以后迁小程序，是另一套技术栈（需用 Taro/uni-app 重写前端），但本套后端可复用。
- **Serverless 不适用**：因为用了本地 SQLite。若将来要上 Serverless，需先把数据层换成云数据库（RDS MySQL/PostgreSQL）。
