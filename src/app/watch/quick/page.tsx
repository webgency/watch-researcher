import Link from "next/link";
import QuickAddForm from "@/components/QuickAddForm";

export const dynamic = "force-dynamic";

export default function QuickAddPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quick add</h1>
          <p className="text-sm text-slate-500">Just the basics and an image — add specs later by editing the watch.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/watch/new" className="btn-secondary">
            Full form
          </Link>
          <Link href="/" className="btn-secondary">
            ← Back
          </Link>
        </div>
      </div>
      <QuickAddForm />
    </div>
  );
}
