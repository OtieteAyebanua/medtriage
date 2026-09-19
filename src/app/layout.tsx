import type { Metadata, Viewport } from 'next';
import '../index.css';

const APP_NAME = 'MedTriage AI';
const DESCRIPTION =
  'AI-assisted triage and differential-diagnosis support for primary healthcare facilities. ' +
  'Nurses record vitals and symptoms, the engine suggests an urgency level with reasoning, and doctors confirm or override it. ' +
  'Runs entirely on the facility LAN — no internet required.';

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Clinical Triage Decision Support`,
    template: `%s · ${APP_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  keywords: ['triage', 'clinical decision support', 'differential diagnosis', 'primary healthcare', 'offline', 'LAN', 'Nigeria'],
  authors: [{ name: 'MedTriage AI project' }],
  manifest: '/site.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon-512.svg', type: 'image/svg+xml' }],
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false, // patient IDs and readings like 120/80 must not become phone links
    email: false,
    address: false,
  },
  // Clinical tool on a private network — never index, never show in search previews
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: 'no-referrer',
  openGraph: {
    type: 'website',
    siteName: APP_NAME,
    title: `${APP_NAME} — Clinical Triage Decision Support`,
    description: DESCRIPTION,
    locale: 'en_NG',
  },
};

export const viewport: Viewport = {
  themeColor: '#0d9488',
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  // Allow pinch-zoom: clinical staff must be able to enlarge readings on small tablets
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
