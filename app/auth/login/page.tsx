import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

// Suspense boundary required by Next 16's Cache Components — LoginForm reads
// useSearchParams() to honor ?next=, which is dynamic and would otherwise
// block the whole route from prerendering.
export default function Page() {
  return (
    <Suspense
      fallback={<div style={{ minHeight: "100dvh", backgroundColor: "black" }} />}
    >
      <LoginForm />
    </Suspense>
  );
}
