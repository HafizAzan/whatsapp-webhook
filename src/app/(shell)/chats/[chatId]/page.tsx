import { LegacyChatRedirect } from "@/components/pages/LegacyChatRedirect";

interface Props {
  params: Promise<{ chatId: string }>;
}

export default async function LegacyChatRoute({ params }: Props) {
  const { chatId } = await params;
  return <LegacyChatRedirect chatId={chatId} />;
}
