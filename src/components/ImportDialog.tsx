import { useRef, useState, useEffect } from "react";
import type {
  ReviewRequest,
  ReviewResponse,
} from "../features/characters/types";

export function ImportDialog({
  review,
  finish,
}: {
  review: ReviewRequest;
  finish: (value: ReviewResponse) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [root, setRoot] = useState(review.roots?.[0] || "");

  useEffect(() => {
    ref.current!.showModal();
  }, []);
  return (
    <dialog
      id="import-review"
      ref={ref}
      aria-labelledby="review-title"
      onCancel={(e) => {
        e.preventDefault();
        finish(null);
      }}
    >
      <h2 id="review-title">Review import</h2>
      <div id="review-content">
        {review.roots ? (
          <>
            <p>
              This archive contains multiple packs. Choose one root to import.
            </p>
            <select
              id="pack-root"
              value={root}
              onChange={(e) => setRoot(e.target.value)}
            >
              {review.roots.map((r) => (
                <option key={r} value={r}>
                  {r || "(archive root)"}
                </option>
              ))}
            </select>
          </>
        ) : (
          <>
            <p>
              {review.result.pack.name} · version{" "}
              {review.result.pack.version.join(".")} ·{" "}
              {review.result.skins.length} supported skins
            </p>
            <ul>
              {review.result.skins.map((s) => (
                <li key={s.id}>
                  {s.name} — {s.bodyType} ({s.image.width} × {s.image.height})
                </li>
              ))}
            </ul>
            {review.result.diagnostics.map((d, i) => (
              <p key={i} className="error">
                {d.scope}
                {d.index !== undefined ? " " + (d.index + 1) : ""}: {d.code} —{" "}
                {d.message}
              </p>
            ))}
            {review.conflict && (
              <p>
                An imported pack has this UUID with different content. Replace
                its catalog entries? Existing characters will update to matching
                source indices.
              </p>
            )}
          </>
        )}
      </div>
      <div className="dialog-buttons">
        <button
          id="review-accept"
          className="sequence"
          disabled={!review.roots && !review.result.skins.length}
          onClick={() => finish(review.roots ? root : true)}
        >
          {review.roots
            ? "Choose root"
            : review.conflict
              ? "Replace pack"
              : "Import pack"}
        </button>
        <button id="review-cancel" onClick={() => finish(null)}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
