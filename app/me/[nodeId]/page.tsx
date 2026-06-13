'use client';

// 接力者进展页：凭自己的 token 查看“我转给了谁、哪一支达成了、联系方式回传到我没有”
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { getClientToken } from '@/lib/clientToken';

interface BranchDto {
  childNickname: string;
  achieved: boolean;
  claimContact: string | null;
  claimMessage: string | null;
}

interface ProgressDto {
  request: {
    title: string;
    description: string;
    visibility: 'private' | 'public';
    rewardType: 'paid' | 'friendship';
    rewardNote: string | null;
    status: string;
  };
  you: { nickname: string; depth: number; isCreator: boolean };
  achievedBranchCount: number;
  branches: BranchDto[];
  publicChains: { hops: number; nodes: { id: string; nickname: string }[] }[] | null;
}

export default function MyRelayPage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = use(params);
  const [data, setData] = useState<ProgressDto | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`/api/nodes/${nodeId}?token=${getClientToken()}`);
    const body = await res.json();
    if (!res.ok) {
      setError(body.message ?? '加载失败');
      return;
    }
    setData(body);
  }, [nodeId]);

  useEffect(() => {
    // 首屏拉取；setState 在 fetch 回调里
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (error) {
    return (
      <main className='page'>
        <h1>看不到这一棒</h1>
        <p className='error'>{error}</p>
        <p className='hint'>只能用接力时的同一台设备/浏览器查看自己的进展。</p>
      </main>
    );
  }
  if (!data) return <main className='page'>加载中…</main>;

  const { request, you } = data;
  return (
    <main className='page'>
      <p className='breadcrumb'>我的接力进展</p>
      <h1>{request.title}</h1>
      <p className='desc'>{request.description}</p>
      <p className='hint'>
        你是这条链上的第 {you.depth} 棒（{you.nickname}）。
        {request.visibility === 'private' ? '🔒 私密接力，你只看得到你直接转发的人。' : '👀 公开接力。'}
      </p>

      <h2>
        你转发给的人
        <button className='chip' onClick={load}>
          刷新
        </button>
      </h2>
      {data.branches.length === 0 && <p className='hint'>你还没把它转发给任何人。</p>}
      {data.branches.map((b) => (
        <div key={b.childNickname} className={`panel branch-card${b.achieved ? ' achieved' : ''}`}>
          <p className='branch-head'>
            <span className='chain-name'>{b.childNickname}</span>
            {b.achieved ? <span className='badge strong'>这一支已达成 🎉</span> : <span className='meta'>传递中…</span>}
          </p>
          {b.claimContact ? (
            <p className='contact'>
              对方联系方式：<strong>{b.claimContact}</strong>
              {b.claimMessage && <span>（留言：{b.claimMessage}）</span>}
              <br />
              <span className='hint'>请把它转达给把求助传给你的人，让消息顺着链条回去。</span>
            </p>
          ) : (
            b.achieved && <p className='hint'>联系方式在下游，请联系 {b.childNickname} 顺着问下去。</p>
          )}
        </div>
      ))}

      {data.publicChains && data.publicChains.length > 0 && (
        <>
          <h2>已连成的链条</h2>
          {data.publicChains.map((ch, i) => (
            <div key={i} className='panel'>
              <p className='meta'>{ch.hops} 跳</p>
              <ol className='chain'>
                {ch.nodes.map((n) => (
                  <li key={n.id} className='chain-node'>
                    <span className='chain-row'>
                      <span className='chain-name'>{n.nickname}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </>
      )}

      <p className='hint center'>
        自己也有想找的人？<Link href='/new'>发起我自己的求助 →</Link>
      </p>
    </main>
  );
}
