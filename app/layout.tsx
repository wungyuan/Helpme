import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '六度搭桥',
  description: '通过朋友接力，找到能帮你的那个人',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
