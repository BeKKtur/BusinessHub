import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

type FeatureUpgradeCardProps = {
  title: string;
  description: string;
};

export function FeatureUpgradeCard({ title, description }: FeatureUpgradeCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <EmptyState icon={LockKeyhole} title={title} description={description} />
        <div className="mt-6 flex justify-center">
          <Button asChild>
            <Link href="/billing">Перейти в Billing</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
