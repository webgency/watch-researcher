import Link from "next/link";
import WatchForm from "@/components/WatchForm";

export default function NewWatchPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Add a watch</h1>
        <Link href="/" className="btn-secondary">
          ← Back
        </Link>
      </div>
      <WatchForm />
    </div>
  );
}
