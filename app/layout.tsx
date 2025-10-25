import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <title>BaseStream - Salary Streaming Platform</title>
        <meta name="description" content="Stream salaries on Base blockchain" />
      </head>
      <body>{children}</body>
    </html>
  )
}
