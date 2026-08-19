import "./globals.css";
import Sidebar from "../components/Sidebar";

export const metadata = { title: "ALKAHTANI OS" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
