"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Home redireciona para /projetos (dashboard será implementado na v2)
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/projetos");
  }, [router]);

  return null;
}
