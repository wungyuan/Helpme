'use client';

// 首页通知：若我发起的求助已有人能帮上忙，给出醒目提示
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getClientToken, getSavedPhone } from '@/lib/clientToken';

export default function HomeNotice() {
  const [matched, setMatched] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch(`/api/me?token=${getClientToken()}&phone=${encodeURIComponent(getSavedPhone())}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const count = (d.created ?? []).filter((c: { matchedCount: number }) => c.matchedCount > 0).length;
        setMatched(count);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (matched === 0) return null;

  return (
    <Link href='/mine' className='home-notice'>
      🎉 你有 {matched} 条求助已经有人能帮上忙了，点这里查看 →
    </Link>
  );
}
