'use client';

// 把鼓励文案 + 二维码合成为一张图片（海报），用户保存这一张直接转发到微信，
// 朋友长按「识别图中二维码」即可打开——解决“复制文字带不走二维码”的问题
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  title: string;
  shareUrl: string;
  // 求助详细描述（求助海报会展示在标题下方）
  description?: string;
  // 求助海报：传 rewardType/asOriginator 自动组文案
  rewardType?: 'paid' | 'friendship';
  asOriginator?: boolean;
  // 通用海报（如程序宣传）：直接传文案，传了则覆盖上面的自动文案，且不显示求助性质行
  lead?: string;
  body?: string;
  caption?: string;
}

// 按字符折行（中文无空格，不能按词断）
function wrapByChar(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const ch of text) {
    if (ch === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  lines.push(line);
  return lines;
}

export default function SharePoster({
  title,
  shareUrl,
  description,
  rewardType,
  asOriginator,
  lead,
  body,
  caption,
}: Props) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let alive = true;

    async function draw() {
      const qrUrl = await QRCode.toDataURL(shareUrl, { width: 320, margin: 1 });
      const qrImg = new Image();
      qrImg.src = qrUrl;
      await new Promise((res) => {
        qrImg.onload = res;
      });

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = 600;
      const pad = 44;
      const contentW = W - pad * 2;
      const qrSize = 300;

      const measure = document.createElement('canvas').getContext('2d')!;
      const leadText = lead ?? (asOriginator ? '🙏 想麻烦你搭把手' : '🤝 接力一下，这事可能就成了');
      // 仅求助海报显示“求助性质”行；通用海报（传了 body）不显示
      const showReward = !!rewardType && !body;
      const rewardLine = rewardType === 'paid' ? '有偿请求 · 详情见卡片' : '友情帮忙 · 举手之劳';
      const askText =
        body ??
        (asOriginator
          ? '如果你认识可能合适的人，把它转给 TA 就好，30 秒，就是一座桥。'
          : '你不一定要认识当事人，只要想到“谁可能认识”，转给 TA 接着传就行。');
      const captionText = caption ?? '长按二维码「识别图中二维码」，帮我接一棒';
      // 求助海报展示详细描述（过长则截断），通用海报不展示
      const descRaw = !body && description?.trim() ? description.trim() : '';
      const descText = descRaw.length > 90 ? descRaw.slice(0, 90) + '…' : descRaw;

      measure.font = '600 28px -apple-system, "PingFang SC", sans-serif';
      const titleLines = wrapByChar(measure, `【${title}】`, contentW);
      measure.font = '15px -apple-system, "PingFang SC", sans-serif';
      const descLines = descText ? wrapByChar(measure, descText, contentW) : [];
      measure.font = '17px -apple-system, "PingFang SC", sans-serif';
      const askLines = wrapByChar(measure, askText, contentW);

      // 估算总高度
      let h = pad;
      h += 30; // lead
      h += titleLines.length * 38 + 8;
      if (descLines.length) h += descLines.length * 22 + 8;
      if (showReward) h += 26;
      h += askLines.length * 26 + 18;
      h += qrSize + 16;
      h += 24; // caption
      h += pad;

      const canvas = document.createElement('canvas');
      canvas.width = W * dpr;
      canvas.height = h * dpr;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(dpr, dpr);

      // 背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, h);
      ctx.fillStyle = '#07c160';
      ctx.fillRect(0, 0, W, 8);

      let y = pad + 6;
      ctx.textBaseline = 'top';

      ctx.fillStyle = '#07c160';
      ctx.font = '600 20px -apple-system, "PingFang SC", sans-serif';
      ctx.fillText(leadText, pad, y);
      y += 36;

      ctx.fillStyle = '#1f2329';
      ctx.font = '600 28px -apple-system, "PingFang SC", sans-serif';
      for (const l of titleLines) {
        ctx.fillText(l, pad, y);
        y += 38;
      }
      y += 6;

      if (descLines.length) {
        ctx.fillStyle = '#5a6270';
        ctx.font = '15px -apple-system, "PingFang SC", sans-serif';
        for (const l of descLines) {
          ctx.fillText(l, pad, y);
          y += 22;
        }
        y += 8;
      }

      if (showReward) {
        ctx.fillStyle = rewardType === 'paid' ? '#b26a00' : '#c2185b';
        ctx.font = '15px -apple-system, "PingFang SC", sans-serif';
        ctx.fillText(rewardLine, pad, y);
        y += 28;
      }

      ctx.fillStyle = '#5a6270';
      ctx.font = '17px -apple-system, "PingFang SC", sans-serif';
      for (const l of askLines) {
        ctx.fillText(l, pad, y);
        y += 26;
      }
      y += 18;

      // 二维码居中
      const qx = (W - qrSize) / 2;
      ctx.drawImage(qrImg, qx, y, qrSize, qrSize);
      y += qrSize + 10;

      ctx.fillStyle = '#8a919c';
      ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(captionText, W / 2, y);

      if (alive) setDataUrl(canvas.toDataURL('image/png'));
    }

    draw().catch(() => {});
    return () => {
      alive = false;
    };
  }, [title, shareUrl, description, rewardType, asOriginator, lead, body, caption]);

  if (!dataUrl) return <div className='poster-placeholder' />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className='poster' src={dataUrl} alt='分享海报：长按保存或转发' />;
}
