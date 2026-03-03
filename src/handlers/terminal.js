'use strict';

const pty = require('node-pty');
const { sendMarkdown, sendTerminalOutput, sendError } = require('../bot/sender');
const sessionManager = require('../utils/session');
const { mdHeader } = require('../utils/format');

/**
 * /term - 启动交互式 PTY 终端会话
 */
async function handleTermStart(webhook, userId) {
  if (sessionManager.hasSession(userId)) {
    await sendMarkdown(
      webhook,
      '终端会话',
      '> ⚠️ 你已有一个活跃的终端会话。发送 `exit` 关闭当前会话后再重新打开。'
    );
    return;
  }

  // 创建 PTY 进程（bash shell）
  const ptyProcess = pty.spawn('bash', ['--login'], {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: process.env.HOME || '/',
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
  });

  // 创建发送函数，绑定当前 webhook
  // 注意：webhook 有 30 分钟有效期，对于长会话需要用户重新发消息触发更新
  const sendFn = (output) => {
    sendTerminalOutput(webhook, output).catch((err) => {
      console.error('[Terminal] 发送输出失败:', err.message);
    });
  };

  // 注册到会话管理器
  const state = sessionManager.createSession(userId, ptyProcess, sendFn);

  // 监听 PTY 输出
  ptyProcess.onData((data) => {
    sessionManager.appendOutput(userId, data);
  });

  // 监听 PTY 退出
  ptyProcess.onExit(({ exitCode }) => {
    const currentState = sessionManager.getSession(userId);
    if (currentState) {
      // 发送最后的缓冲内容
      sessionManager.flushOutput(userId);
      // 通知用户（使用当前最新 webhook 对应的 sendFn）
      currentState.sendFn(`\n⚪ 终端进程已退出 (code: ${exitCode})`);
      sessionManager.destroySession(userId);
    }
  });

  let text = mdHeader('终端会话已启动', '💻');
  text += '- Shell: `bash`\n';
  text += '- 工作目录: `' + (process.env.HOME || '/') + '`\n\n';
  text += '**使用方式：**\n';
  text += '- 直接发送命令即可执行（如 `ls -la`）\n';
  text += '- 发送 `exit` 或 `Ctrl+D` 关闭终端\n';
  text += '- 会话将在 **30 分钟** 无操作后自动关闭\n\n';
  text += '> ⚠️ 注意：交互式程序（如 `vim`、`top`）的界面通过文本方式呈现，';
  text += '效果有限。建议使用 `htop -C` 等更友好的输出模式。';

  await sendMarkdown(webhook, '终端会话已启动', text);
}

/**
 * 向活跃的 PTY 会话发送输入
 * 同时更新 webhook（因为每条消息的 webhook 可能会刷新有效期）
 */
async function handleTermInput(webhook, userId, input) {
  // 更新 sendFn 以使用最新的 webhook
  const state = sessionManager.getSession(userId);
  if (!state) return false;

  state.sendFn = (output) => {
    sendTerminalOutput(webhook, output).catch((err) => {
      console.error('[Terminal] 发送输出失败:', err.message);
    });
  };

  // 检查是否是退出命令
  const trimmed = input.trim().toLowerCase();
  if (trimmed === 'exit' || trimmed === 'quit') {
    state.pty.write('exit\r');
    return true;
  }

  // 发送输入到 PTY
  sessionManager.writeToSession(userId, input);
  return true;
}

/**
 * 关闭用户的 PTY 会话
 */
async function handleTermExit(webhook, userId) {
  if (!sessionManager.hasSession(userId)) {
    await sendMarkdown(webhook, '终端', '> 没有活跃的终端会话');
    return;
  }

  sessionManager.destroySession(userId);
  await sendMarkdown(webhook, '终端', '> ✅ 终端会话已关闭');
}

/**
 * /exec <command> - 一次性执行命令（非交互式）
 */
async function handleExec(webhook, args) {
  const cmd = args.trim();
  if (!cmd) {
    await sendError(webhook, '请提供要执行的命令，例如: `/exec uptime`');
    return;
  }

  await sendMarkdown(webhook, '执行命令', `> ⏳ 执行: \`${cmd}\``);

  const { execSync } = require('child_process');
  try {
    const output = execSync(cmd, {
      timeout: 30000,
      encoding: 'utf8',
      cwd: process.env.HOME || '/',
    });

    const text = '```\n$ ' + cmd + '\n' + output.trim() + '\n```';
    await sendMarkdown(webhook, '执行命令', text);
  } catch (err) {
    const output = err.stdout || err.stderr || err.message;
    const text = '```\n$ ' + cmd + '\n' + (output || '(无输出)').trim() + '\n```\n> ❌ 退出码: ' + (err.status || '未知');
    await sendMarkdown(webhook, '执行命令', text);
  }
}

module.exports = {
  handleTermStart,
  handleTermInput,
  handleTermExit,
  handleExec,
};
