'use client';

// 创建求助卡片
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClientToken, getSavedNickname, saveNickname } from '@/lib/clientToken';

export default function NewRequestPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'direct' | 'resource'>('resource');
  const [targetDesc, setTargetDesc] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 从 localStorage 恢复昵称只能在客户端 effect 中做，否则 SSR 水合不一致
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNickname(getSavedNickname());
  }, []);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorToken: getClientToken(),
          nickname,
          title,
          description,
          type,
          targetDesc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? '创建失败');
      saveNickname(nickname);
      router.push(`/my/${data.requestId}?root=${data.rootNodeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
      setBusy(false);
    }
  }

  return (
    <main className='page'>
      <h1>发起求助</h1>
      <div className='form'>
        <label>
          你的昵称
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder='链条上的人会看到' />
        </label>
        <label>
          求助类型
          <div className='strength-group'>
            <button
              type='button'
              className={type === 'resource' ? 'chip active' : 'chip'}
              onClick={() => setType('resource')}
            >
              找某类资源/能力
            </button>
            <button
              type='button'
              className={type === 'direct' ? 'chip active' : 'chip'}
              onClick={() => setType('direct')}
            >
              定向找具体某人
            </button>
          </div>
        </label>
        <label>
          标题
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='一句话说清你要找谁' />
        </label>
        <label>
          详细描述
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder='背景、为什么找、希望对方帮什么忙'
          />
        </label>
        <label>
          目标画像（可选）
          <input
            value={targetDesc}
            onChange={(e) => setTargetDesc(e.target.value)}
            placeholder={type === 'direct' ? '目标人物的公开身份，如：某公司某岗位' : '如：三甲医院儿科医生'}
          />
        </label>
        {error && <p className='error'>{error}</p>}
        <button className='primary' disabled={busy} onClick={submit}>
          {busy ? '创建中…' : '创建并获取分享链接'}
        </button>
      </div>
    </main>
  );
}
