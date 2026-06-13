// 生成可在微信里直接转发的文案：鼓励语 + 扼要须知 + 可点击链接

interface ShareOptions {
  title: string;
  url: string;
  rewardType: 'paid' | 'friendship';
  // true=发起人首发分享；false=接力者向下游转发
  asOriginator: boolean;
}

export function buildShareText({ title, url, rewardType, asOriginator }: ShareOptions): string {
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
    rewardLine,
    ask,
    '👇 点开看看，顺手接一棒：',
    url,
  ].join('\n');
}
