import "./style.css";
export const metadata = {
  title: "Mehlivo · Invitations & attendance",
  description: "Beautiful invitations, effortless guest replies, and thoughtful celebration planning.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {process.env.NODE_ENV !== "production" && (
          <div className="test-banner">
            Local test environment · Publishing is free · No emails are
            delivered
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
