import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold" href="/">
          BusinessHub
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-normal">Privacy Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: June 6, 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-foreground">
          <p>
            BusinessHub collects account information such as name, email address, workspace details, subscription
            status and product usage data needed to provide the CRM service.
          </p>
          <p>
            Customers may store business data including clients, appointments, services, revenues, expenses and
            notification settings. This data is used to operate BusinessHub and is isolated by business workspace.
          </p>
          <p>
            Payments are processed by Paddle. BusinessHub does not store full card numbers. Telegram settings are used
            only to send configured notifications and reminders.
          </p>
          <p>
            You may request access, correction, or deletion of your data by contacting{" "}
            <a className="text-foreground underline" href="mailto:batyrbekovbektur0@gmail.com">
              batyrbekovbektur0@gmail.com
            </a>
            .
          </p>
        </div>
      </article>
    </main>
  );
}
