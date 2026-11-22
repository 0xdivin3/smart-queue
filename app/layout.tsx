import "./globals.css";

export const metadata = {
  title: "Smart Queue Management System",
  description: "Smart queue management system for university offices",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
