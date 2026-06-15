import type { Metadata } from 'next';
import Link from 'next/link';
import RelayLanding from '@/components/RelayLanding';
import SiteFooter from '@/components/SiteFooter';
import { getLandingData } from '@/lib/store';

interface Props {
  params: Promise<{ nodeId: string }>;
}

// 微信转发链接卡片读取这里的 og 标签
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nodeId } = await params;
  const data = getLandingData(nodeId);
  if (!data) return { title: '六度搭桥' };
  return {
    title: `帮忙搭个桥：${data.request.title}`,
    description: data.request.description.slice(0, 60),
    openGraph: {
      title: `帮忙搭个桥：${data.request.title}`,
      description: data.request.description.slice(0, 60),
    },
  };
}

export default async function RelayLandingPage({ params }: Props) {
  const { nodeId } = await params;
  const data = getLandingData(nodeId);
  if (!data) {
    return (
      <main className='page'>
        <h1>链接失效了</h1>
        <p>这条接力链接不存在或已关闭。</p>
        <Link href='/' className='primary button'>
          回首页看看
        </Link>
      </main>
    );
  }
  const { request, path, hiddenUpstream, stop } = data;
  const forwarder = path[path.length - 1];
  const stopText =
    stop.reason === 'deadline'
      ? '这条求助已到截止时间，接力已结束。'
      : stop.reason === 'count'
        ? '这条求助已达到目标匹配数量，接力已结束。'
        : '这条求助已关闭。';
  const toViewNode = (n: (typeof path)[number]) => ({
    id: n.id,
    nickname: n.nickname,
    relationStrength: n.relationStrength,
    forwardNote: n.forwardNote,
  });
  return (
    <main className='page'>
      <p className='breadcrumb'>🤝 有人请你帮个忙，传一棒就是一座桥</p>
      <h1>{request.title}</h1>
      <p className='desc'>{request.description}</p>
      {request.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className='request-image' src={request.imageUrl} alt='求助配图' />
      )}

      <p className={`reward-tag ${request.rewardType}`}>
        {request.rewardType === 'paid' ? '💰 有偿请求' : '💛 友情帮助'}
        {request.rewardNote && <span className='reward-note'>{request.rewardNote}</span>}
      </p>

      <RelayLanding
        nodeId={nodeId}
        title={request.title}
        description={request.description}
        visibility={request.visibility}
        rewardType={request.rewardType}
        publicChain={path.map(toViewNode)}
        forwarder={toViewNode(forwarder)}
        hiddenUpstream={hiddenUpstream}
        stopOpen={stop.open}
        stopText={stopText}
      />

      <p className='hint center'>
        自己也有想找的人？<Link href='/new'>发起我自己的求助 →</Link>
      </p>
      <SiteFooter />
    </main>
  );
}
