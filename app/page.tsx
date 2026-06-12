import Link from 'next/link';

export default function Home() {
  return (
    <main className='page'>
      <h1>六度搭桥</h1>
      <p className='lead'>
        想找一个不认识的人帮忙？六度分隔理论说，你和任何人之间最多隔着几个朋友。
        发起一张求助卡片，让朋友们接力转发，把中间人链条找出来。
      </p>
      <ol className='howto'>
        <li>写下你要找的人或资源</li>
        <li>把链接分享给可能认识的朋友</li>
        <li>朋友接力转发，每一跳都被记录</li>
        <li>目标认领后，完整链条浮现，标出最短和最强路径</li>
      </ol>
      <Link href='/new' className='primary button'>
        发起求助
      </Link>
      <p className='hint'>本工具不读取任何通讯录，链条完全由朋友们自愿接力形成。</p>
    </main>
  );
}
