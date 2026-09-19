import type { Metadata } from 'next';
import '../index.css';

export const metadata: Metadata = {
  title: 'MedTriage AI - Offline LAN Clinical Decision Support',
  description: 'AI-assisted medical triage and differential diagnosis system for primary healthcare facilities',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
