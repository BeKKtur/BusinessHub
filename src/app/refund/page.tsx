import Link from "next/link";

export default function RefundPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <article className="mx-auto max-w-3xl">
        <Link className="text-sm font-semibold" href="/">
          BusinessHub
        </Link>
        <h1 className="mt-8 text-4xl font-semibold tracking-normal">Refund Policy</h1>
        <p className="mt-4 text-sm text-muted-foreground">Last updated: June 6, 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-muted-foreground">
          <p>
            BusinessHub subscriptions are billed monthly through Paddle. If you believe a payment was made in error,
            contact support within 14 days of the charge.
          </p>
          <p>
            Paddle securely processes subscription payments for BusinessHub. You can manage or cancel an active
            subscription from the Billing page after logging in.
          </p>
          <p>
            Refund requests are reviewed individually. Approved refunds are processed through Paddle to the original
            payment method. Cancellation stops future renewals but does not automatically refund previous paid periods.
          </p>
          <p>
            To request a refund, email{" "}
            <a className="text-foreground underline" href="mailto:batyrbekovbektur0@gmail.com">
              batyrbekovbektur0@gmail.com
            </a>{" "}
            with your account email, transaction date and reason for the request.
          </p>
        </div>
      </article>
    </main>
  );
}
