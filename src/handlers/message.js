'use strict';

const { sendMarkdown, sendError } = require('../bot/sender');
const { handleInfo, handleCpu, handleMem, handleDisk } = require('./system');
const { handlePs, handleKill, handleKillConfirm, cancelPendingKill, hasPendingKill } = require('./process');
const { handleNet, handlePing } = require('./network');
const { handleTermStart, handleTermInput, handleTermExit, handleExec } = require('./terminal');
const sessionManager = require('../utils/session');

// 允许的用户白名单（为空则不限制）
const ALLOWED_USER_IDS = process.env.ALLOWED_USER_IDS
  ? process.env.ALLOWED_USER_IDS.split(',').map((s) => s.trim()).filter(Boolean)
  : [];

const HELP_TEXT = `**🖥️ 主机监控 Agent - 帮助**

**系统信息**
- \`/info\` — 系统总览（CPU / 内存 / 磁盘）
- \`/cpu\` — CPU 实时使用率
- \`/mem\` — 内存使用详情
- \`/disk\` — 磁盘使用详情

**网络**
- \`/net\` — 网络接口 + 外网 IP
- \`/ping <host>\` — Ping 检测

**进程管理**
- \`/ps [关键词]\` — 进程列表（按 CPU 排序）
- \`/kill <PID>\` — 终止进程（需要确认）

**终端**
- \`/exec <命令>\` — 一次性执行命令
- \`/term\` — 启动交互式终端会话
- \`exit\` — 退出当前终端会话

---
> 💡 在交互式终端会话中，直接发送任意文本即为终端输入`;

/**
 * 主消息处理器
 * DingTalk Stream 机器人消息 data 结构：
 * {
 *   msgId, msgtype,
 *   text: { content: "@Bot 命令内容" },
 *   senderStaffId,       // 企业内部用户 staffId
 *   senderId,            // 用户 openId
 *   senderNick,          // 用户昵称
 *   sessionWebhook,      // 回复消息用的 webhook URL（有效期 ~30min）
 *   sessionWebhookExpiredTime,
 *   conversationType,    // "1"=单聊, "2"=群聊
 *   robotCode,
 * }
 */
async function handleMessage(data) {
  const webhook = data.sessionWebhook;
  // 优先使用 staffId（企业内部唯一标识），回退到 senderId/openId
  const senderId = data.senderStaffId || data.senderId || 'unknown';
  const senderName = data.senderNick || '用户';

  // 提取消息文本，去除 @机器人 的部分
  let rawContent = '';
  if (data.text && data.text.content) {
    rawContent = data.text.content;
  } else if (typeof data.content === 'string') {
    rawContent = data.content;
  }
  // 去掉 @机器人名称（钉钉格式为 "@名称 命令"）
  const content = rawContent.replace(/@\S+/g, '').trim();

  console.log(`[${new Date().toISOString()}] [${senderName}(${senderId})] ${content}`);

  if (!webhook) {
    console.error('[Bot] 消息中缺少 sessionWebhook，raw data:', JSON.stringify(data));
    return;
  }

  // 鉴权：白名单校验
  if (ALLOWED_USER_IDS.length > 0 && !ALLOWED_USER_IDS.includes(senderId)) {
    await sendMarkdown(webhook, '拒绝访问', `> ❌ 用户 **${senderName}** (${senderId}) 无权限操作`);
    return;
  }

  // 优先级1：如果用户有活跃 PTY 会话，将消息作为终端输入
  if (sessionManager.hasSession(senderId)) {
    await handleTermInput(webhook, senderId, content);
    return;
  }

  // 优先级2：如果用户有待确认的 kill 操作
  if (hasPendingKill(senderId)) {
    const normalized = content.toLowerCase().trim();
    if (normalized === 'confirm' || normalized === '确认' || normalized === 'yes') {
      await handleKillConfirm(webhook, senderId);
    } else {
      cancelPendingKill(senderId);
      await sendMarkdown(webhook, '操作取消', '> ✅ 已取消终止进程操作');
    }
    return;
  }

  // 解析命令
  const parts = content.split(/\s+/);
  const cmd = (parts[0] || '').toLowerCase();
  const args = parts.slice(1).join(' ');

  try {
    switch (cmd) {
      case '/help':
      case 'help':
        await sendMarkdown(webhook, '帮助', HELP_TEXT);
        break;

      case '/info':
      case '/sysinfo':
        await handleInfo(webhook);
        break;

      case '/cpu':
        await handleCpu(webhook);
        break;

      case '/mem':
      case '/memory':
        await handleMem(webhook);
        break;

      case '/disk':
        await handleDisk(webhook);
        break;

      case '/net':
      case '/network':
        await handleNet(webhook);
        break;

      case '/ping':
        await handlePing(webhook, args);
        break;

      case '/ps':
      case '/proc':
      case '/processes':
        await handlePs(webhook, senderId, args);
        break;

      case '/kill':
        await handleKill(webhook, senderId, args);
        break;

      case '/exec':
      case '/run':
        await handleExec(webhook, args);
        break;

      case '/term':
      case '/terminal':
        await handleTermStart(webhook, senderId);
        break;

      case '/exit':
      case 'exit':
        await handleTermExit(webhook, senderId);
        break;

      default:
        if (content) {
          await sendMarkdown(
            webhook,
            '未知命令',
            `> ❓ 未知命令: \`${content}\`\n\n发送 \`/help\` 查看可用命令`
          );
        }
        break;
    }
  } catch (err) {
    console.error('[Bot] 命令执行错误:', err);
    await sendError(webhook, `命令执行失败: ${err.message}`);
  }
}

module.exports = { handleMessage };
