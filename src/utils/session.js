'use strict';

/**
 * PTY 会话状态管理
 * 每个用户（userId）只能有一个活跃的 PTY 会话
 *
 * SessionState 结构：
 * {
 *   pty,              // node-pty 实例
 *   outputBuffer,     // 待发送的输出缓冲字符串
 *   flushTimer,       // 防抖定时器
 *   inactivityTimer,  // 不活动超时定时器
 *   lastActivity,     // 最后活动时间戳
 *   sendFn,           // 发送消息的回调函数 (text) => void
 * }
 */

const sessions = new Map();

const TIMEOUT_MS = parseInt(process.env.TERMINAL_TIMEOUT_MIN || '30', 10) * 60 * 1000;
const BUFFER_MS = parseInt(process.env.OUTPUT_BUFFER_MS || '300', 10);

/**
 * 判断用户是否有活跃的 PTY 会话
 */
function hasSession(userId) {
  return sessions.has(userId);
}

/**
 * 获取用户的会话状态
 */
function getSession(userId) {
  return sessions.get(userId);
}

/**
 * 创建新会话（由 terminal.js 调用）
 */
function createSession(userId, ptyInstance, sendFn) {
  // 先关闭旧会话（如果存在）
  destroySession(userId);

  const state = {
    pty: ptyInstance,
    outputBuffer: '',
    flushTimer: null,
    inactivityTimer: null,
    lastActivity: Date.now(),
    sendFn,
  };

  sessions.set(userId, state);
  resetInactivityTimer(userId);
  return state;
}

/**
 * 向 PTY 写入用户输入
 */
function writeToSession(userId, text) {
  const state = sessions.get(userId);
  if (!state) return false;

  state.lastActivity = Date.now();
  resetInactivityTimer(userId);

  // 将用户消息作为命令发送给 PTY（追加换行符）
  state.pty.write(text + '\r');
  return true;
}

/**
 * 向 PTY 输出缓冲区追加数据，并触发防抖发送
 */
function appendOutput(userId, data) {
  const state = sessions.get(userId);
  if (!state) return;

  state.outputBuffer += data;

  // 如果缓冲区过大，立即发送
  if (state.outputBuffer.length > 2500) {
    flushOutput(userId);
    return;
  }

  // 防抖：等待 BUFFER_MS 后发送
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
  }
  state.flushTimer = setTimeout(() => flushOutput(userId), BUFFER_MS);
}

/**
 * 立即发送缓冲区内容
 */
function flushOutput(userId) {
  const state = sessions.get(userId);
  if (!state || !state.outputBuffer) return;

  const text = state.outputBuffer;
  state.outputBuffer = '';
  state.flushTimer = null;

  state.sendFn(text);
}

/**
 * 重置不活动超时定时器
 */
function resetInactivityTimer(userId) {
  const state = sessions.get(userId);
  if (!state) return;

  if (state.inactivityTimer) {
    clearTimeout(state.inactivityTimer);
  }

  state.inactivityTimer = setTimeout(() => {
    state.sendFn('⏰ 终端会话因长时间无操作已自动关闭');
    destroySession(userId);
  }, TIMEOUT_MS);
}

/**
 * 销毁用户的 PTY 会话
 */
function destroySession(userId) {
  const state = sessions.get(userId);
  if (!state) return;

  // 清理定时器
  if (state.flushTimer) clearTimeout(state.flushTimer);
  if (state.inactivityTimer) clearTimeout(state.inactivityTimer);

  // 发送剩余缓冲内容
  if (state.outputBuffer) {
    state.sendFn(state.outputBuffer);
  }

  // 终止 PTY 进程
  try {
    state.pty.kill();
  } catch (_) {}

  sessions.delete(userId);
}

/**
 * 获取当前所有活跃会话数量（用于调试）
 */
function getActiveSessions() {
  return sessions.size;
}

module.exports = {
  hasSession,
  getSession,
  createSession,
  writeToSession,
  appendOutput,
  flushOutput,
  destroySession,
  getActiveSessions,
};
