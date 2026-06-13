'use client';

// 带即时反馈的复制按钮：点击后短暂显示“已复制 ✓”，2 秒后复位
import { useState, type ReactNode } from 'react';

interface Props {
  text: string;
  className?: string;
  idleLabel?: string;
  children?: ReactNode;
}

export default function CopyButton({ text, className, idleLabel = '复制', children }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 兜底：部分微信内置浏览器不支持 clipboard API，退回选区复制
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button type='button' className={`${className ?? ''}${copied ? ' copied' : ''}`} onClick={copy}>
      {copied ? '已复制 ✓' : (children ?? idleLabel)}
    </button>
  );
}
