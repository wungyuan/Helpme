import Link from 'next/link';
import AppShare from '@/components/AppShare';

export default function Home() {
  return (
    <main className='page'>
      <h1>六度搭桥</h1>
      <p className='lead'>
        你想找的那个人，其实并不远。六度分隔理论说，你和世界上任何人之间，最多隔着几个朋友。
        发起一张求助卡片，让朋友一棒接一棒地传下去，把那条隐藏的人脉链条点亮。
      </p>
      <ol className='howto'>
        <li>📝 写下你想找的人或资源</li>
        <li>📤 把它发给可能认识的朋友</li>
        <li>🤝 朋友接力转发，每一棒都被记录</li>
        <li>✨ 有人能帮上时，最短、最强的那条桥就浮现出来</li>
      </ol>
      <Link href='/new' className='primary button cta-main'>
        发起我的求助
      </Link>
      <p className='center' style={{ marginTop: '12px' }}>
        <Link href='/mine'>我的记录（发起 / 接力）</Link>
      </p>
      <div className='home-share'>
        <AppShare />
      </div>
      <p className='center' style={{ marginTop: '12px' }}>
        <Link href='/about'>看看它是怎么找到马斯克的 →</Link>
      </p>
      <p className='hint'>本工具不读取任何通讯录，链条完全由朋友们自愿接力形成。</p>
    </main>
  );
}
