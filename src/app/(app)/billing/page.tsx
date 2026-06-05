import { PageHeader } from "@/components/app/page-header";
import { BillingManager } from "@/components/billing/billing-manager";

export default function BillingPage() {
  return (
    <>
      <PageHeader title="Billing" description="Starter, Pro и Business с оплатой через Paddle." />
      <BillingManager />
    </>
  );
}
