import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="text-center">
        <div className="text-5xl font-semibold tracking-tight">404</div>
        <p className="mt-2 text-sm text-muted-foreground">Oops!.. That page doesn&apos;t exist.</p>
        <div className="mt-6"><Link href="/"><Button>Back to dashboard</Button></Link></div>
      </div>
    </div>
  );
}
