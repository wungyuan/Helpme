// 生成可在微信里直接转发的文案：鼓励语 + 扼要须知 + 可点击链接

interface ShareOptions {
  title: string;
  description?: string;
  url: string;
  rewardType: 'paid' | 'friendship';
  // true=发起人首发分享；false=接力者向下游转发
  asOriginator: boolean;
}

export function buildShareText({ title, description, url, rewardType, asOriginator }: ShareOptions): string {
  const rewardLine = rewardType === 'paid' ? '（这是一次有偿请求，详情见卡片）' : '（纯属友情帮忙，举手之劳）';
  const lead = asOriginator
    ? '🙏 想麻烦你搭把手——'
    : '🤝 接力一下，这事可能就成了——';
  const ask = asOriginator
    ? '如果你认识可能合适的人，把它转给 TA 就好，30 秒，就是一座桥。'
    : '你不一定要认识当事人，只要想到“谁可能认识”，转给 TA 接着传就行。';
  return [
    lead,
    `【${title}】`,
    description?.trim() ? description.trim() : null,
    rewardLine,
    ask,
    '👇 点开看看，顺手接一棒：',
    url,
  ]
    .filter(Boolean)
    .join('\n');
}

// 分享“整个程序”的宣传文案：海报与文字链接共用，保持口径一致
export const APP_PITCH =
  '六度搭桥 · 你想找的那个人，其实只隔几个朋友，发一张求助卡片，朋友托朋友，帮你找到能帮上忙的人：找资源、找专家、找供应商、找失联的人都行。';

export function buildAppShareText(url: string): string {
  return [APP_PITCH, '👇 点开看看，也可以发起你自己的求助：', url].join('\n');
}
