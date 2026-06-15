'use client';

// 分享“整个程序”：把这个工具推荐给朋友（区别于转发某一条求助）
import { useState } from 'react';
import CopyButton from './CopyButton';
import SharePoster from './SharePoster';
import { APP_PITCH, buildAppShareText } from '@/lib/share';

export default function AppShare() {
  const [open, setOpen] = useState(false);
  // 客户端才能拿到 origin；分享的是程序首页
  const url = typeof window !== 'undefined' ? window.location.origin + '/' : '/';
  const text = buildAppShareText(url);

  if (!open) {
    return (
      <button className='button outline' onClick={() => setOpen(true)}>
        把这个程序分享给朋友
      </button>
    );
  }

  return (
    <div className='panel'>
      <h3>把六度搭桥推荐给朋友</h3>
      <p className='hint'>复制下面这段话发给朋友或群；也可以转发下方的二维码图片。</p>
      <pre className='share-text'>{text}</pre>
      <CopyButton className='primary' text={text}>
        复制这段话去分享
      </CopyButton>

      <div className='poster-block'>
        <SharePoster
          title='六度搭桥'
          shareUrl={url}
          lead='🌉 帮你找到那个人'
          body={APP_PITCH}
          caption='长按二维码「识别图中二维码」，打开看看'
        />
        <p className='hint'>或长按上图「保存图片」转发给微信好友 / 群，朋友长按识别二维码打开。</p>
      </div>
    </div>
  );
}
