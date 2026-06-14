# 部署到国内服务器（六度搭桥）

本项目是 **Next.js + better-sqlite3**：数据存在服务器本地文件（`data/*.db`）。
因此**必须部署在有持久磁盘的云服务器/轻量服务器上，不能用 Serverless / 函数计算**（那类磁盘是临时的，数据会丢）。

推荐架构：**腾讯云轻量 / 阿里云轻量服务器（Ubuntu）+ Node 20 + pm2 + nginx + 已备案域名 + HTTPS**。
腾讯云与阿里云在下面这些步骤上基本一致。

---

## 0. 先决条件：ICP 备案（最耗时，先做）

在国内服务器上**用域名对外提供网页服务是强制要备案的**，没备案服务商会封掉 80/443 端口。

1. 先买好云服务器和域名（见第 1 步），用同一个云账号；
2. 在云厂商控制台「备案」入口提交：主体信息（个人/企业）、域名、服务器、人脸核验；
3. 周期通常 **1–20 个工作日**，期间网站无法用域名对外访问；
4. 备案下来会有「备案号」，需在网站底部展示（备案要求）。

> 备案是你本人/你公司的实名事项，只能你自己做。备案没通过之前，下面的部署可以先做好、用服务器 IP 临时自测，但**不能用域名对外、微信里也打不开**。

---

## 1. 买服务器与域名

- **服务器**：腾讯云轻量应用服务器 或 阿里云轻量应用服务器，**Ubuntu 22.04/24.04**，规格 **2核2G** 起步够用。
- **域名**：在同一云厂商注册，方便备案与解析。
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

**HTTPS 证书**两种方式任选：

- **云厂商免费证书**（推荐，省事）：在腾讯云/阿里云「SSL 证书」申请免费 DV 证书 → 下载 nginx 版本 → 上传到服务器 `/etc/nginx/ssl/` → 路径填进配置。
- **certbot 自动签发**（需域名已解析到本机、80 端口可达，即备案后）：
  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d your-domain.com
  ```

配置好后：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

把域名 DNS **A 记录**解析到服务器公网 IP（备案通过后生效）。

---

## 8. 验证上线

- 浏览器访问 `https://你的域名/` → 首页正常；
- `https://你的域名/admin` → 输入 ADMIN_KEY 能进后台；
- 微信里把首页/求助链接发给自己 → **备案通过的域名**链接可点击打开（未备案会被微信拦成警告页）。

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

- **微信内可点击链接**：链接能否在微信里直接点开，取决于**域名是否备案**（备案后即可）。若以后要公众号自定义分享卡片，再做「JS 接口安全域名 / 业务域名」校验。当前 H5 已有「文案+二维码海报」兜底，二维码长按可识别。
- **不要把 `data/` 和 `.env.local` 提交进 git**（已在 `.gitignore` 忽略）。生产数据库放 `/var/lib/helpme`。
- **小程序**：若以后迁小程序，是另一套技术栈（需用 Taro/uni-app 重写前端），但本套后端可复用。
- **Serverless 不适用**：因为用了本地 SQLite。若将来要上 Serverless，需先把数据层换成云数据库（RDS MySQL/PostgreSQL）。
