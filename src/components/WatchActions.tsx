"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function WatchActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/watches/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/");
      router.refresh();
    } catch {
      setDeleting(false);
      alert("Failed to delete. Please try again.");
    }
  }

  return (
    <div className="flex gap-2">
      <Link href={`/watch/${id}/edit`} className="btn-secondary">
        Edit
      </Link>
      <button onClick={handleDelete} className="btn-danger" disabled={deleting}>
        {deleting ? "Deleting…" : "Delete"}
      </button>
    </div>
  );
}
