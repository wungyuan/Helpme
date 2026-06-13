'use client';

// 发起人详情页：分享入口 + 达成情况
// public：完整达成链条（最短/最强对比 + 联系方式）
// private：只看自己直接转发的人里哪一支达成；联系方式仅在你直接转发给认领者时可见
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ChainView, { type ChainViewNode } from '@/components/ChainView';
import CopyButton from '@/components/CopyButton';
import { getClientToken } from '@/lib/clientToken';
import { buildShareText } from '@/lib/share';

interface RequestMeta {
  id: string;
  title: string;
  description: string;
  visibility: 'private' | 'public';
  rewardType: 'paid' | 'friendship';
  rewardNote: string | null;
  status: string;
}

interface ChainDto {
  claim: { id: string; contact: string; message: string | null };
  hops: number;
  minStrength: number;
  nodes: ChainViewNode[];
}

interface BranchDto {
  childNickname: string;
  achieved: boolean;
  claimContact: string | null;
  claimMessage: string | null;
}

interface PublicDto {
  mode: 'public';
  request: RequestMeta;
  chains: ChainDto[];
  shortestClaimId: string | null;
  strongestClaimId: string | null;
}

interface PrivateDto {
  mode: 'private';
  request: RequestMeta;
  achievedBranchCount: number;
  branches: BranchDto[];
}

type Dto = PublicDto | PrivateDto;

export default function MyRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = use(params);
  const rootNodeId = useSearchParams().get('root');
  const [data, setData] = useState<Dto | null>(null);
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

  const { request } = data;
  const shareUrl = rootNodeId ? `${location.origin}/r/${rootNodeId}` : null;
  const shareText = shareUrl
    ? buildShareText({ title: request.title, url: shareUrl, rewardType: request.rewardType, asOriginator: true })
    : null;

  return (
    <main className='page'>
      <h1>{request.title}</h1>
      <p className='desc'>{request.description}</p>
      <p className={`reward-tag ${request.rewardType}`}>
        {request.rewardType === 'paid' ? '💰 有偿请求' : '💛 友情帮助'}
        {request.rewardNote && <span className='reward-note'>{request.rewardNote}</span>}
        <span className='meta'>· {request.visibility === 'private' ? '🔒 私密' : '👀 公开'}</span>
      </p>

      {shareText && (
        <div className='panel'>
          <h3>把它发出去，链条就开始了</h3>
          <p className='hint'>整段复制下面这段话，发给你觉得“可能认识相关人”的朋友或群：</p>
          <pre className='share-text'>{shareText}</pre>
          <CopyButton className='primary' text={shareText}>
            复制这段话去分享
          </CopyButton>
        </div>
      )}

      <h2>
        进展
        <button className='chip' onClick={load}>
          刷新
        </button>
      </h2>

      {data.mode === 'public' ? (
        <>
          {data.chains.length === 0 && <p className='hint'>还没有人接上，达成的链条会显示在这里。</p>}
          {data.chains.map((ch) => (
            <div key={ch.claim.id} className='panel chain-card'>
              <p className='badges'>
                {ch.claim.id === data.shortestClaimId && <span className='badge'>最短路径</span>}
                {ch.claim.id === data.strongestClaimId && <span className='badge strong'>最强路径</span>}
                <span className='meta'>
                  {ch.hops} 跳 · 最弱一环 {['', '弱', '中', '强'][ch.minStrength]}
                </span>
              </p>
              <ChainView nodes={ch.nodes} showStrength />
              <p className='contact'>
                联系方式：<strong>{ch.claim.contact}</strong>
                {ch.claim.message && <span>（留言：{ch.claim.message}）</span>}
              </p>
            </div>
          ))}
        </>
      ) : (
        <>
          <p className='hint'>
            私密求助：你只看到自己直接转发的人。达成时联系方式沿链条逐级回传——
            {data.achievedBranchCount > 0 ? '请联系达成的那一支朋友顺着问下去。' : '耐心等等，第一棒往往最关键。'}
          </p>
          {data.branches.length === 0 && <p className='hint'>你还没把它转发给任何人，先去分享吧。</p>}
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
                </p>
              ) : (
                b.achieved && <p className='hint'>联系方式在下游，请联系 {b.childNickname} 顺着这一支问下去。</p>
              )}
            </div>
          ))}
        </>
      )}

      <p className='hint center'>
        想再找一个人？<Link href='/new'>发起新的求助 →</Link>
      </p>
    </main>
  );
}
