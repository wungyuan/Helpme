'use client';

// 发起人详情页：分享入口 + 达成情况
// public：完整达成链条（最短/最强对比 + 联系方式）
// private：只看自己直接转发的人里哪一支达成；联系方式仅在你直接转发给认领者时可见
import { use, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ChainView, { type ChainViewNode } from '@/components/ChainView';
import CopyButton from '@/components/CopyButton';
import SharePoster from '@/components/SharePoster';
import SiteFooter from '@/components/SiteFooter';
import { getClientToken } from '@/lib/clientToken';
import { buildShareText } from '@/lib/share';

interface RequestMeta {
  id: string;
  title: string;
  description: string;
  visibility: 'private' | 'public';
  rewardType: 'paid' | 'friendship';
  rewardNote: string | null;
  targetMatchCount: number | null;
  deadlineAt: number | null;
  status: string;
}

interface StopState {
  open: boolean;
  reason: 'count' | 'deadline' | 'manual' | null;
}

interface ChainDto {
  claim: { id: string; contact: string; message: string | null };
  hops: number;
  minStrength: number;
  nodes: ChainViewNode[];
}

interface BranchDto {
  childNodeId: string;
  childNickname: string;
  childContact: string | null;
  isClaimer: boolean;
  achieved: boolean;
  claimMessage: string | null;
  bestHops: number | null;
  bestMinStrength: number | null;
  recommendRank: number | null;
}

interface PublicDto {
  mode: 'public';
  request: RequestMeta;
  stop: StopState;
  recommendedClaimIds: string[];
  chains: ChainDto[];
  shortestClaimId: string | null;
  strongestClaimId: string | null;
}

interface PrivateDto {
  mode: 'private';
  request: RequestMeta;
  stop: StopState;
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

  // 发起人手动结束 / 重新开放
  async function toggleStatus(next: 'open' | 'closed') {
    if (next === 'closed' && !confirm('结束后将不再接受新的接力，确定结束这条求助吗？')) return;
    await fetch(`/api/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: getClientToken(), status: next }),
    });
    load();
  }

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

      <p className='hint'>
        终止条件：
        {request.targetMatchCount ? `匹配满 ${request.targetMatchCount} 条` : '不限数量'}
        {' · '}
        {request.deadlineAt ? `${new Date(request.deadlineAt).toLocaleDateString()} 截止` : '不限时间'}
      </p>
      {data.stop.open ? (
        <button className='chip end-btn' onClick={() => toggleStatus('closed')}>
          结束这条求助
        </button>
      ) : (
        <div className='panel stopped'>
          <h3>已结束</h3>
          <p>
            {data.stop.reason === 'deadline'
              ? '已到截止时间，不再接受新的接力。'
              : data.stop.reason === 'count'
                ? '已达到目标匹配数量，不再接受新的接力。'
                : '你已手动结束这条求助，不再接受新的接力。'}
          </p>
          {data.stop.reason === 'manual' && (
            <button className='chip' onClick={() => toggleStatus('open')}>
              重新开放
            </button>
          )}
        </div>
      )}

      {shareText && data.stop.open && (
        <div className='panel'>
          <h3>把它发出去，链条就开始了</h3>
          <p className='hint'>推荐转发这张图：长按保存，发给可能认识相关人的朋友或群，文字和二维码都在图里。</p>
          {shareUrl && (
            <div className='poster-block'>
              <SharePoster
                title={request.title}
                description={request.description}
                shareUrl={shareUrl}
                rewardType={request.rewardType}
                asOriginator
              />
              <p className='hint'>长按上图「保存图片」或直接转发给微信好友 / 群。</p>
            </div>
          )}
          <details className='share-fallback'>
            <summary className='meta'>或只复制文字链接</summary>
            <pre className='share-text'>{shareText}</pre>
            <CopyButton className='primary' text={shareText}>
              复制这段话去分享
            </CopyButton>
          </details>
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
          {data.chains.length > 1 && (
            <p className='hint'>已为你按“最短优先、再看最弱一环”推荐最优前 {data.recommendedClaimIds.length} 条，供你挑选联系。</p>
          )}
          {data.chains.map((ch) => {
            const rank = data.recommendedClaimIds.indexOf(ch.claim.id);
            return (
            <div key={ch.claim.id} className={`panel chain-card${rank === 0 ? ' top' : ''}`}>
              <p className='badges'>
                {rank !== -1 && <span className='badge rec'>推荐 #{rank + 1}</span>}
                {ch.claim.id === data.shortestClaimId && <span className='badge'>最短路径</span>}
                {ch.claim.id === data.strongestClaimId && <span className='badge strong'>最强路径</span>}
                <span className='meta'>
                  {ch.hops} 跳 · 最弱一环 {['', '弱', '中', '强'][ch.minStrength]}
                </span>
              </p>
              <ChainView nodes={ch.nodes} showStrength />
              <p className='contact'>
                🎯 最终者联系方式：<strong>{ch.nodes[ch.nodes.length - 1]?.nickname}</strong> ·{' '}
                {ch.claim.contact}
                {ch.claim.message && <span>（留言：{ch.claim.message}）</span>}
              </p>
            </div>
            );
          })}
        </>
      ) : (
        <>
          <p className='hint'>
            私密求助：你只看到自己直接转发的人。达成时联系方式沿链条逐级回传——
            {data.achievedBranchCount > 0 ? '请联系达成的那一支朋友顺着问下去。' : '耐心等等，第一棒往往最关键。'}
          </p>
          {data.branches.length === 0 && <p className='hint'>你还没把它转发给任何人，先去分享吧。</p>}
          {data.achievedBranchCount > 1 && (
            <p className='hint'>多支已达成，已为你按链路最优排序、标出推荐前几支，供你挑选跟进。</p>
          )}
          {data.branches.map((b) => (
            <div
              key={b.childNodeId}
              className={`panel branch-card${b.achieved ? ' achieved' : ''}${b.recommendRank === 1 ? ' top' : ''}`}
            >
              <p className='branch-head'>
                <span className='chain-name'>{b.childNickname}</span>
                {b.recommendRank !== null && <span className='badge rec'>推荐 #{b.recommendRank}</span>}
                {b.isClaimer ? (
                  <span className='badge strong'>🎯 就是 TA</span>
                ) : b.achieved ? (
                  <span className='badge strong'>这一支已达成 🎉</span>
                ) : (
                  <span className='meta'>传递中…</span>
                )}
              </p>
              {b.achieved && b.bestHops !== null && (
                <p className='meta'>
                  最优链路 {b.bestHops} 跳 · 最弱一环 {['', '弱', '中', '强'][b.bestMinStrength ?? 0]}
                </p>
              )}
              {b.childContact && (
                <p className='contact'>
                  {b.isClaimer ? '🎯 最终者联系方式' : '联系方式'}：<strong>{b.childNickname}</strong> · {b.childContact}
                  {b.claimMessage && <span>（留言：{b.claimMessage}）</span>}
                </p>
              )}
              {!b.isClaimer && b.achieved && (
                <p className='hint'>这一支在下游达成了，请联系 {b.childNickname} 顺着问下去。</p>
              )}
            </div>
          ))}
        </>
      )}

      <SiteFooter />
    </main>
  );
}
