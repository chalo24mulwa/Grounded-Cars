import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { getViewerProfile, TrendingError } from "@/server/services/trending/profile-service";
import { getConversation } from "@/server/services/trending/message-service";
import { ConversationView } from "@/components/trending/ConversationView";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function TrendingConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ video?: string }>;
}) {
  const [{ id }, { video }] = await Promise.all([params, searchParams]);
  const me = await getViewerProfile();
  if (!me) redirect(`/login?callbackUrl=${encodeURIComponent(`/trending/messages/${id}`)}`);
  let data;
  try {
    data = await getConversation(id);
  } catch (error) {
    if (error instanceof TrendingError) notFound();
    throw error;
  }
  return (
    <ConversationView
      conversationId={id}
      other={data.other}
      blocked={data.blocked}
      initialMessages={data.messages}
      videoRefId={typeof video === "string" ? video : null}
    />
  );
}
