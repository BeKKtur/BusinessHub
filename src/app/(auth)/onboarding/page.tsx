"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { businessTypes } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";

export default function OnboardingPage() {
  const { businessType, setBusinessType } = useAppStore();

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Выберите тип бизнеса</CardTitle>
        <CardDescription>Dashboard и шаблоны будут адаптированы под вашу нишу.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {businessTypes.map((type) => (
            <motion.button
              key={type}
              whileHover={{ y: -2 }}
              className={cn(
                "rounded-lg border p-4 text-left text-sm font-medium transition-colors",
                businessType === type ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"
              )}
              onClick={() => setBusinessType(type)}
            >
              {type}
            </motion.button>
          ))}
        </div>
        <Button className="mt-6 w-full" asChild>
          <Link href="/dashboard">Открыть BusinessHub</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
