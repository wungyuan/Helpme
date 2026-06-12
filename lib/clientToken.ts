// 浏览器侧匿名身份：localStorage 持久化的随机 token，不收集任何个人信息
const KEY = 'helpme_token';

export function getClientToken(): string {
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
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
