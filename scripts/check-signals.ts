import { config } from "dotenv";
config({ path: ".env.local" });
import { db, schema } from "../lib/db";
import { sql, isNotNull, or } from "drizzle-orm";

async function run() {
  // Overall counts
  const counts = await db.execute(sql`
    SELECT
      status,
      COUNT(*)::int as total,
      COUNT(hook_strength_score)::int as has_score,
      (COUNT(transcript_id) + COUNT(source_transcript))::int as has_transcript
    FROM signals
    GROUP BY status
    ORDER BY status
  `);
  console.log("=== Signal counts ===");
  console.table(counts.rows);

  // Signals that WOULD appear in the list (unused + has score + has transcript)
  const visible = await db.execute(sql`
    SELECT
      id,
      status,
      recommended_author_id,
      hook_strength_score,
      transcript_id IS NOT NULL OR source_transcript IS NOT NULL as has_transcript
    FROM signals
    WHERE status NOT IN ('archived','drafting')
      AND hook_strength_score IS NOT NULL
      AND (transcript_id IS NOT NULL OR source_transcript IS NOT NULL)
    ORDER BY created_at DESC
    LIMIT 20
  `);
  console.log("\n=== Visible signals (pass all filters) ===");
  console.table(visible.rows);

  process.exit(0);
}
run().catch(e => { console.error(e?.message); process.exit(1); });
