'use client';

// 我的记录：列出我发起的求助（含是否已匹配成功）、我参与接力的链路
// 我发起的：本设备 token 或 手机号命中（换设备时用手机号找回）
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getClientToken, getSavedPhone, savePhone } from '@/lib/clientToken';
import SiteFooter from '@/components/SiteFooter';

interface Created {
  id: string;
  title: string;
  rootNodeId: string;
  visibility: 'private' | 'public';
  status: 'open' | 'closed';
  matchedCount: number;
  createdAt: number;
}
interface Relayed {
  nodeId: string;
  requestId: string;
  title: string;
  achieved: boolean;
  createdAt: number;
}

export default function MinePage() {
  const [data, setData] = useState<{ created: Created[]; relayed: Relayed[] } | null>(null);
  const [phone, setPhone] = useState('');

  const load = useCallback(async (ph: string) => {
    const res = await fetch(`/api/me?token=${getClientToken()}&phone=${encodeURIComponent(ph)}`);
    setData(await res.json());
  }, []);

  useEffect(() => {
    const saved = getSavedPhone();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhone(saved);
    load(saved);
  }, [load]);

  function findByPhone() {
    savePhone(phone);
    load(phone);
  }

  if (!data) return <main className='page'>加载中…</main>;

  return (
    <main className='page'>
      <h1>我的记录</h1>

      <div className='panel'>
        <p className='hint'>换了手机或电脑？输入你发起求助时填的手机号，把自己发起的求助找回来。</p>
        <div className='strength-group'>
          <input
            type='tel'
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder='手机号'
            style={{ flex: 1 }}
          />
          <button className='chip' onClick={findByPhone}>
            找回
          </button>
        </div>
      </div>

      <h2>我发起的求助（{data.created.length}）</h2>
      {data.created.length === 0 && <p className='hint'>还没有发起过求助。</p>}
      {data.created.map((r) => (
        <Link key={r.id} href={`/my/${r.id}?root=${r.rootNodeId}`} className='record-card'>
          <span className='record-title'>{r.title}</span>
          <span className='meta'>
            {r.matchedCount > 0 ? (
              <strong className='ok-text'>🎉 已有 {r.matchedCount} 人能帮上忙</strong>
            ) : r.status === 'closed' ? (
              '已结束'
            ) : (
              '进行中，等待接力'
            )}
            {' · '}
            {r.visibility === 'private' ? '🔒 私密' : '👀 公开'} · 查看详情 →
          </span>
        </Link>
      ))}

      <h2>我参与的接力（{data.relayed.length}）</h2>
      {data.relayed.length === 0 && <p className='hint'>还没有接力过。</p>}
      {data.relayed.map((n) => (
        <Link key={n.nodeId} href={`/me/${n.nodeId}`} className='record-card'>
          <span className='record-title'>{n.title}</span>
          <span className='meta'>
            {n.achieved ? <strong className='ok-text'>🎉 你这一支已达成</strong> : '传递中'} · 查看进展 →
          </span>
        </Link>
      ))}

      <SiteFooter />
    </main>
  );
}
