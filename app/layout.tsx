export const metadata = {
  title: 'CallCRM — Lead Intelligence Dashboard',
  description: 'AI-powered real estate lead intelligence for premium real estate brokers',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <style dangerouslySetInnerHTML={{ __html: `
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html { -webkit-font-smoothing: antialiased; }
          body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: #f0f2f5; }
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
          ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
          details > summary { list-style: none; }
          details > summary::-webkit-details-marker { display: none; }
          @keyframes pulse-ring {
            0%,100% { opacity:1; transform:scale(1); }
            50% { opacity:0.45; transform:scale(0.8); }
          }
          @keyframes fade-up {
            from { opacity:0; transform:translateY(10px); }
            to   { opacity:1; transform:translateY(0); }
          }
          @keyframes spin { to { transform:rotate(360deg); } }
        `}} />
      </head>
      <body>{children}</body>
    </html>
  )
}
