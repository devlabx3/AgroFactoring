"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getStoredAuth } from "@/features/auth/hooks/use-auth";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const user = getStoredAuth();
    if (user) {
      router.replace(user.role === "exporter" ? "/exporter" : "/farmer");
    } else {
      router.replace("/login");
    }
  }, [router]);

  return null;
}
