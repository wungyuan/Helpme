'use client';

// 发起人详情页：分享入口 + 全部达成链条（最短/最强对比）
import { use, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ChainView, { type ChainViewNode } from '@/components/ChainView';
import { getClientToken } from '@/lib/clientToken';

interface ChainDto {
  claim: {
    id: string;
    claimType: 'is_target' | 'can_help';
    contact: string;
    message: string | null;
  };
  hops: number;
  minStrength: number;
  avgStrength: number;
  nodes: ChainViewNode[];
}

interface RequestDto {
  request: { id: string; title: string; description: string; status: string };
  chains: ChainDto[];
  shortestClaimId: string | null;
  strongestClaimId: string | null;
}

export default function MyRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const rootNodeId = useSearchParams().get('root');
  const [data, setData] = useState<RequestDto | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/requests/${requestId}?token=${getClientToken()}`);
    const body = await res.json();
    if (!res.ok) {
      setError(body.message ?? '加载失败');
      return;
    }
    setData(body);
  }, [requestId]);

  useEffect(() => {
    // 首屏拉取数据；setState 发生在 fetch 回调而非 effect 同步体内
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) {
    return (
      <main className='page'>
        <h1>无法查看</h1>
        <p className='error'>{error}</p>
      </main>
    );
  }
  if (!data) return <main className='page'>加载中…</main>;

  const shareUrl = rootNodeId ? `${location.origin}/r/${rootNodeId}` : null;

  return (
    <main className='page'>
      <h1>{data.request.title}</h1>
      <p className='desc'>{data.request.description}</p>

      {shareUrl && (
        <div className='panel'>
          <h3>分享给朋友，开始接力</h3>
          <p className='share-url'>{shareUrl}</p>
          <button className='primary' onClick={() => navigator.clipboard.writeText(shareUrl)}>
            复制链接
          </button>
          <p className='hint'>把链接发给你觉得“可能认识相关人”的朋友或群。</p>
        </div>
      )}

      <h2>
        达成的链条（{data.chains.length}）
        <button className='chip' onClick={load}>
          刷新
        </button>
      </h2>
      {data.chains.length === 0 && <p className='hint'>还没有人认领，链条达成后会显示在这里。</p>}
      {data.chains.map((ch) => (
        <div key={ch.claim.id} className='panel chain-card'>
          <p className='badges'>
            {ch.claim.id === data.shortestClaimId && <span className='badge'>最短路径</span>}
            {ch.claim.id === data.strongestClaimId && <span className='badge strong'>最强路径</span>}
            <span className='meta'>
              {ch.hops} 跳 · 最弱一环 {['', '弱', '中', '强'][ch.minStrength]}
            </span>
          </p>
          <ChainView nodes={ch.nodes} />
          <p className='contact'>
            认领人联系方式：<strong>{ch.claim.contact}</strong>
            {ch.claim.message && <span>（留言：{ch.claim.message}）</span>}
          </p>
        </div>
      ))}
    </main>
  );
}
