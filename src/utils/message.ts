import type { Message } from "@/types";

export function getMessageKey(message: Message) {
  if (message._id) return message._id;

  return [
    message.createdAt,
    message.user?.name ?? "",
    message.message,
    message.status,
    String(message.isCorrect),
  ].join("|");
}
