// 通用页脚导航：回首页 / 我的记录 / 发起求助，方便接力者随时回到首页或查看自己的记录
import Link from 'next/link';

export default function SiteFooter() {
  return (
    <p className='hint center site-footer'>
      <Link href='/'>🏠 回首页</Link>
      <span className='sep'>·</span>
      <Link href='/mine'>我的记录</Link>
      <span className='sep'>·</span>
      <Link href='/new'>发起求助</Link>
    </p>
  );
}
