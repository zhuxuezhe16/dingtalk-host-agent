'use strict';

const si = require('systeminformation');
const { execSync } = require('child_process');
const { sendMarkdown, sendError } = require('../bot/sender');
const { mdHeader, mdKV, mdDivider } = require('../utils/format');

// 等待确认 kill 的暂存 Map：{ userId -> { pid, name } }
const pendingKill = new Map();

/**
 * /ps [关键词] - 列出进程（按 CPU 排序，最多显示 15 条）
 */
async function handlePs(webhook, userId, args) {
  const keyword = args.trim().toLowerCase();
  const procs = await si.processes();

  let list = procs.list
    .filter((p) => p.cpu !== undefined)
    .sort((a, b) => b.cpu - a.cpu);

  if (keyword) {
    list = list.filter((p) => p.name.toLowerCase().includes(keyword));
  }

  const top = list.slice(0, 15);

  if (top.length === 0) {
    await sendMarkdown(webhook, '进程列表', `> 没有找到关键词为 **${keyword}** 的进程`);
    return;
  }

  let text = mdHeader(`进程列表${keyword ? ' (过滤: ' + keyword + ')' : ''}`, '📋');
  text += '| PID | 进程名 | CPU% | 内存% |\n';
  text += '|-----|--------|------|-------|\n';

  for (const p of top) {
    const name = p.name.length > 20 ? p.name.slice(0, 19) + '…' : p.name;
    text += `| ${p.pid} | ${name} | ${p.cpu.toFixed(1)}% | ${p.mem.toFixed(1)}% |\n`;
  }

  text += `\n> 共 ${procs.list.length} 个进程，按 CPU 降序排列，显示前 ${top.length} 条\n`;
  text += `\n💡 发送 \`/kill <PID>\` 终止进程`;

  await sendMarkdown(webhook, '进程列表', text);
}

/**
 * /kill <pid> - 终止进程（需要二次确认）
 */
async function handleKill(webhook, userId, args) {
  const pid = parseInt(args.trim(), 10);

  if (isNaN(pid) || pid <= 0) {
    await sendError(webhook, '请提供有效的 PID，例如: `/kill 1234`');
    return;
  }

  // 查找进程名称
  let procName = `PID ${pid}`;
  try {
    const procs = await si.processes();
    const proc = procs.list.find((p) => p.pid === pid);
    if (proc) procName = `${proc.name} (PID: ${pid})`;
  } catch (_) {}

  // 存储待确认
  pendingKill.set(userId, { pid, name: procName });

  // 10 秒后自动取消
  setTimeout(() => {
    if (pendingKill.get(userId)?.pid === pid) {
      pendingKill.delete(userId);
    }
  }, 10000);

  const text =
    mdHeader('确认终止进程', '⚠️') +
    mdKV('目标进程', procName) +
    '\n> 请在 **10 秒内** 发送 `confirm` 确认，或发送其他任何消息取消操作。';

  await sendMarkdown(webhook, '确认终止进程', text);
}

/**
 * 处理 kill 确认消息
 * @returns {boolean} 是否处理了确认消息
 */
async function handleKillConfirm(webhook, userId) {
  const pending = pendingKill.get(userId);
  if (!pending) return false;

  pendingKill.delete(userId);
  const { pid, name } = pending;

  try {
    process.kill(pid, 'SIGTERM');

    let text = mdHeader('进程已终止', '✅');
    text += mdKV('进程', name);
    text += mdKV('信号', 'SIGTERM');
    await sendMarkdown(webhook, '进程已终止', text);
  } catch (err) {
    await sendError(webhook, `终止进程失败: ${err.message}`);
  }

  return true;
}

/**
 * 取消待确认的 kill 操作
 */
function cancelPendingKill(userId) {
  return pendingKill.delete(userId);
}

/**
 * 检查是否有待确认的 kill 操作
 */
function hasPendingKill(userId) {
  return pendingKill.has(userId);
}

module.exports = {
  handlePs,
  handleKill,
  handleKillConfirm,
  cancelPendingKill,
  hasPendingKill,
};
