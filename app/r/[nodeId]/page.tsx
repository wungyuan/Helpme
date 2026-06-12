import type { Metadata } from 'next';
import ChainView from '@/components/ChainView';
import RelayPanel from '@/components/RelayPanel';
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
        <h1>链接无效</h1>
        <p>这条接力链接不存在或已失效。</p>
      </main>
    );
  }
  const { request, path } = data;
  return (
    <main className='page'>
      <p className='breadcrumb'>朋友请你帮忙搭桥 · 已接力 {path.length - 1} 跳</p>
      <h1>{request.title}</h1>
      <p className='desc'>{request.description}</p>
      {request.targetDesc && (
        <p className='target'>
          要找的{request.type === 'direct' ? '人' : '资源'}：{request.targetDesc}
        </p>
      )}
      <h2>接力链条</h2>
      <ChainView nodes={path} />
      <RelayPanel nodeId={nodeId} requestType={request.type} />
    </main>
  );
}
