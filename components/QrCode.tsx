'use client';

// 把分享链接渲染成二维码，接收者在微信里长按可“识别图中二维码”打开
// ——绕开未备案域名文字链接被拦截的折中方案
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function QrCode({ text, size = 160 }: { text: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(text, { width: size, margin: 1 })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [text, size]);

  if (!dataUrl) return <div className='qr-placeholder' style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className='qr' src={dataUrl} alt='扫码或长按识别打开' width={size} height={size} />;
}
