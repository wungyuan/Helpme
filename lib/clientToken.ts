// 浏览器侧匿名身份：localStorage 持久化的随机 token，不收集任何个人信息
const KEY = 'helpme_token';

// 生成随机 token，兼容非安全上下文（http、部分微信内置浏览器没有 crypto.randomUUID）
function generateToken(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // 忽略，走下面的兜底
  }
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // 忽略，走下面的兜底
  }
  return `tk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

export function getClientToken(): string {
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = generateToken();
    localStorage.setItem(KEY, token);
  }
  return token;
}

const NICK_KEY = 'helpme_nickname';

export function getSavedNickname(): string {
  return localStorage.getItem(NICK_KEY) ?? '';
}

export function saveNickname(nickname: string) {
  localStorage.setItem(NICK_KEY, nickname);
}
