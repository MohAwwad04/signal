import { notFound } from "next/navigation";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { PostEditor } from "./editor";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PostPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const session = await getCurrentUser();
  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, id));
  if (!post) notFound();
  const [author] = post.authorId
    ? await db.select().from(schema.authors).where(eq(schema.authors.id, post.authorId))
    : [null];
  const brief = (await db.select().from(schema.designBriefs).where(eq(schema.designBriefs.postId, id)))[0] ?? null;

  const canApprove = session?.isSuperAdmin || (!!session?.authorId && session.authorId === post.authorId);
  const canSubmitForReview = !session?.isAdmin && !session?.isSuperAdmin;

  return <PostEditor post={post} author={author} brief={brief} canApprove={canApprove} canSubmitForReview={canSubmitForReview} />;
}
