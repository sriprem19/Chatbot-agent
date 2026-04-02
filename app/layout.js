import './globals.css';

export const metadata = {
  title: 'AgentX — Your AI Conversation Buddy',
  description: 'AgentX remembers everything about you and gets smarter the more you talk. Pick a topic, start chatting, and watch your AI buddy learn.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
