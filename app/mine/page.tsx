'use client';

// 我的记录：凭浏览器匿名 token 列出我发起的求助、我参与接力的链路，可点进去看进展
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { getClientToken } from '@/lib/clientToken';

interface Created {
  id: string;
  title: string;
  rootNodeId: string;
  visibility: 'private' | 'public';
  status: 'open' | 'closed';
  createdAt: number;
}
interface Relayed {
  nodeId: string;
  requestId: string;
  title: string;
  createdAt: number;
}

export default function MinePage() {
  const [data, setData] = useState<{ created: Created[]; relayed: Relayed[] } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/me?token=${getClientToken()}`);
    setData(await res.json());
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!data) return <main className='page'>加载中…</main>;

  const empty = data.created.length === 0 && data.relayed.length === 0;

  return (
    <main className='page'>
      <h1>我的记录</h1>
      <p className='hint'>这些记录绑定在你当前这台设备/浏览器上，换设备或清除浏览器数据后会看不到。</p>

      <h2>我发起的求助（{data.created.length}）</h2>
      {data.created.length === 0 && <p className='hint'>还没有发起过求助。</p>}
      {data.created.map((r) => (
        <Link key={r.id} href={`/my/${r.id}?root=${r.rootNodeId}`} className='record-card'>
          <span className='record-title'>{r.title}</span>
          <span className='meta'>
            {r.visibility === 'private' ? '🔒 私密' : '👀 公开'} · {r.status === 'open' ? '进行中' : '已结束'} · 查看进展 →
          </span>
        </Link>
      ))}

      <h2>我参与的接力（{data.relayed.length}）</h2>
      {data.relayed.length === 0 && <p className='hint'>还没有接力过。</p>}
      {data.relayed.map((n) => (
        <Link key={n.nodeId} href={`/me/${n.nodeId}`} className='record-card'>
          <span className='record-title'>{n.title}</span>
          <span className='meta'>查看我这一棒的进展 →</span>
        </Link>
      ))}

      {empty && (
        <p className='hint center' style={{ marginTop: '16px' }}>
          <Link href='/new'>发起我的第一个求助 →</Link>
        </p>
      )}

      <p className='hint center' style={{ marginTop: '20px' }}>
        <Link href='/'>← 回首页</Link>
      </p>
    </main>
  );
}
