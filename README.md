# 钉钉主机监控 Agent

通过钉钉机器人远程监控和操作 macOS 主机，支持系统信息查询、进程管理、网络诊断和**交互式终端会话**。

## 特性

- **无需公网 IP** — 使用钉钉 Stream 模式（WebSocket 长连接）
- **AK/SK 鉴权** — 通过钉钉开放平台 AppKey/AppSecret 认证
- **系统监控** — CPU、内存、磁盘实时信息
- **进程管理** — 查看进程列表、终止进程（带二次确认）
- **网络诊断** — 网络接口信息、外网 IP、Ping 检测
- **一次性命令** — `/exec` 执行任意 shell 命令
- **交互式终端** — `/term` 启动 PTY 会话，输出实时回显到钉钉

## 快速开始

### 1. 创建钉钉机器人

1. 登录 [钉钉开放平台](https://open.dingtalk.com/)
2. 创建**企业内部应用**
3. 进入应用 → **应用能力** → 添加**机器人**能力
4. 消息接收模式选择 **Stream 模式**
5. 记录 AppKey（ClientID）和 AppSecret（ClientSecret）

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`：

```env
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
ALLOWED_USER_IDS=staffId1,staffId2   # 可选，留空不限制
```

### 3. 安装依赖并启动

```bash
npm install
npm start
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/info` | 系统总览（CPU/内存/磁盘） |
| `/cpu` | CPU 实时使用率（各核心） |
| `/mem` | 内存使用详情 |
| `/disk` | 磁盘使用详情 |
| `/net` | 网络接口 + 外网 IP |
| `/ping <host>` | Ping 检测 |
| `/ps [关键词]` | 进程列表（按 CPU 排序） |
| `/kill <PID>` | 终止进程（需要发送 `confirm` 确认） |
| `/exec <命令>` | 一次性执行 shell 命令 |
| `/term` | 启动交互式终端会话 |
| `exit` | 退出当前终端会话 |

## 交互式终端

```
你: /term
Bot: 💻 终端会话已启动 - Shell: bash ...

你: ls -la
Bot: ```
total 48
drwxr-xr-x  8 user  staff   256 ...
```

你: top -l 1 | head -20
Bot: ```
Processes: 412 total ...
```

你: exit
Bot: ✅ 终端会话已关闭
```

## 安全说明

- 配置 `ALLOWED_USER_IDS` 限制可操作用户（强烈建议）
- `/kill` 命令需要二次确认，10 秒超时自动取消
- PTY 会话 30 分钟无活动自动关闭
- 所有命令以当前用户权限运行（无 sudo）
