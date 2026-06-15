'use client';

// 可选配图上传：客户端先压缩（避免大图），再上传，返回可访问 URL
import { useRef, useState } from 'react';

// 把图片压到最长边 <= maxSide，输出 jpeg dataURL
async function compress(file: File, maxSide = 1280, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = rej;
    fr.readAsDataURL(file);
  });
  const img = new Image();
  img.src = dataUrl;
  await new Promise((res, rej) => {
    img.onload = res;
    img.onerror = rej;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export default function ImageUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onPick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const dataUrl = await compress(file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? '上传失败');
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className='image-upload'>
      <input
        ref={inputRef}
        type='file'
        accept='image/png,image/jpeg,image/webp'
        style={{ display: 'none' }}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {value ? (
        <div className='image-preview'>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt='求助配图' />
          <button type='button' className='chip' onClick={() => onChange('')}>
            移除图片
          </button>
        </div>
      ) : (
        <button type='button' className='chip' disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? '上传中…' : '＋ 添加一张照片（可选）'}
        </button>
      )}
      {error && <p className='error'>{error}</p>}
    </div>
  );
}
