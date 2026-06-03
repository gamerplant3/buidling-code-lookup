import './globals.css';

export const metadata = {
  title: 'Building Code Lookup — MVP',
  description: 'Portfolio roof reserve screening with AI-powered site search',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
