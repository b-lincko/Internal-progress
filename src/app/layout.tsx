import "./globals.css"

export const metadata = {
  title: "CMMC Tracker",
  description: "CMMC Level 2 Compliance Tracking",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
