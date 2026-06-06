import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold" href="/">
          BusinessHub
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-normal">Terms of Service</h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: June 6, 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-foreground">
          <p>
            BusinessHub provides CRM software for service businesses to manage clients, appointments, services,
            finances, analytics and notifications. By using BusinessHub, you agree to use the service lawfully and to
            provide accurate account and billing information.
          </p>
          <p>
            You are responsible for the data you enter into BusinessHub and for maintaining the confidentiality of your
            account credentials. You may not misuse the platform, attempt unauthorized access, or interfere with service
            operation.
          </p>
          <p>
            Paid subscriptions are billed according to the plan selected on the pricing page. BusinessHub may update
            features, pricing, or these terms with reasonable notice. Continued use after changes means you accept the
            updated terms.
          </p>
          <p>
            Payments are handled securely through Paddle. Subscription upgrades, renewals, cancellations and billing
            management are available from the Billing page inside your BusinessHub account.
          </p>
          <p>
            For support, billing questions, or legal requests, contact us at{" "}
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
