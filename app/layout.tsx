import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '股票交易记录',
  description: '在手机上记录买入、卖出和自动盈亏。',
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
