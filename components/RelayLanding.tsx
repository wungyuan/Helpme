'use client';

// 接力着陆页的交互区：先识别访客身份，再决定展示
// - 新访客：展示“谁把它传给了你”链条 + 接力面板
// - 你就是这个节点/你在更上游：你转发出去的链接，给出回到自己进展页的入口（不再“自己接力自己”）
// - 你是发起人：给出回到求助进展页的入口
import Link from 'next/link';
import { useEffect, useState } from 'react';
import ChainView, { type ChainViewNode } from './ChainView';
import RelayPanel from './RelayPanel';
import { getClientToken } from '@/lib/clientToken';

interface Relation {
  role: 'outsider' | 'self' | 'ancestor';
  isCreator: boolean;
  myNodeId: string | null;
  requestId: string;
  rootNodeId: string;
}

interface Props {
  nodeId: string;
  title: string;
  description: string;
  visibility: 'private' | 'public';
  rewardType: 'paid' | 'friendship';
  publicChain: ChainViewNode[];
  forwarder: ChainViewNode;
  hiddenUpstream: number;
  stopOpen: boolean;
  stopText: string;
}

export default function RelayLanding({
  nodeId,
  title,
  description,
  visibility,
  rewardType,
  publicChain,
  forwarder,
  hiddenUpstream,
  stopOpen,
  stopText,
}: Props) {
  const [rel, setRel] = useState<Relation | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/nodes/${nodeId}/relation?token=${getClientToken()}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setRel(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [nodeId]);

  if (!rel) return <p className='hint'>加载中…</p>;

  // 你已经在这条链上（你转发出去的链接 / 你在更上游 / 你是发起人）
  if (rel.role !== 'outsider') {
    if (rel.isCreator) {
      return (
        <div className='panel'>
          <h3>👋 这是你发起的求助</h3>
          <p className='hint'>你不用在这里接力。点下面回到你的求助进展，查看接力情况和达成的链条。</p>
          <Link href={`/my/${rel.requestId}?root=${rel.rootNodeId}`} className='primary button'>
            查看求助进展 →
          </Link>
        </div>
      );
    }
    return (
      <div className='panel'>
        <h3>👋 你已经在这条接力链上了</h3>
        <p className='hint'>这是你之前转发出去的链接。点下面回到你这一棒的进展，看看传到哪了。</p>
        {rel.myNodeId && (
          <Link href={`/me/${rel.myNodeId}`} className='primary button'>
            查看我的接力进展 →
          </Link>
        )}
      </div>
    );
  }

  // 新访客：正常接力流程
  return (
    <>
      <h2>谁把它传给了你</h2>
      {visibility === 'public' ? (
        <ChainView nodes={publicChain} />
      ) : (
        <>
          <ChainView nodes={[forwarder]} />
          {hiddenUpstream > 0 && (
            <p className='hint'>这是一条私密接力，更上游的 {hiddenUpstream} 位朋友对你隐藏。</p>
          )}
        </>
      )}

      {stopOpen ? (
        <RelayPanel
          nodeId={nodeId}
          title={title}
          description={description}
          visibility={visibility}
          rewardType={rewardType}
        />
      ) : (
        <div className='panel stopped'>
          <h3>接力已结束</h3>
          <p>{stopText}感谢你愿意搭把手 🙏</p>
        </div>
      )}
    </>
  );
}
