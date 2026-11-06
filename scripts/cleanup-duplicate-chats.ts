/**
 * Merge duplicate active conversations between the same two people.
 *
 * Older duplicate chats are folded into the most recently active chat:
 *   - every message is re-pointed at the kept chat (nothing is lost)
 *   - the kept chat's last message/time is recalculated
 *   - an active deal from a duplicate is preserved if the kept chat has none
 *   - the duplicate chat documents are deleted
 *
 * Run a preview first:
 *   npx tsx scripts/cleanup-duplicate-chats.ts --dry-run
 * Then for real:
 *   npx tsx scripts/cleanup-duplicate-chats.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const MONGODB_URI = process.env.MONGODB_URI;
const DRY_RUN = process.argv.includes("--dry-run");

type ChatDoc = {
  _id: mongoose.Types.ObjectId;
  type?: string;
  participants: mongoose.Types.ObjectId[];
  dealInfo?: Record<string, unknown> & { status?: string };
  lastMessage?: mongoose.Types.ObjectId;
  lastMessageTime?: Date;
  createdAt?: Date;
};

function pairKey(participants: mongoose.Types.ObjectId[]): string {
  return participants
    .map(String)
    .filter(Boolean)
    .sort()
    .join(":");
}

function timestamp(chat: ChatDoc): number {
  const value = chat.lastMessageTime || chat.createdAt;
  return value ? new Date(value).getTime() : 0;
}

function isActiveDeal(chat: ChatDoc): boolean {
  return (
    !!chat.dealInfo &&
    chat.dealInfo.status !== "completed" &&
    chat.dealInfo.status !== "cancelled"
  );
}

async function main() {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set in .env");
  }

  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  const chats = db.collection<ChatDoc>("chats");
  const messages = db.collection("messages");

  const activeChats = await chats
    .find({
      isActive: true,
      "participants.1": { $exists: true },
      "participants.2": { $exists: false },
    })
    .toArray();

  const groups = new Map<string, ChatDoc[]>();
  for (const chat of activeChats) {
    const key = pairKey(chat.participants || []);
    if (!key) continue;
    const list = groups.get(key) || [];
    list.push(chat);
    groups.set(key, list);
  }

  const duplicateGroups = [...groups.values()].filter((list) => list.length > 1);
  const duplicateCount = duplicateGroups.reduce((sum, list) => sum + list.length - 1, 0);

  console.log(`Active conversations: ${activeChats.length}`);
  console.log(`Pairs with duplicates: ${duplicateGroups.length}`);
  console.log(`Duplicate conversations to remove: ${duplicateCount}`);
  if (DRY_RUN) console.log("DRY RUN — no changes will be written.\n");

  let mergedPairs = 0;
  let removedChats = 0;
  let movedMessages = 0;

  for (const list of duplicateGroups) {
    list.sort((a, b) => timestamp(b) - timestamp(a));
    const keeper = list[0];
    const duplicates = list.slice(1);

    console.log(
      `Pair ${pairKey(keeper.participants)}: keep ${keeper._id} (${list.length - 1} duplicate${list.length > 2 ? "s" : ""})`
    );

    let moved = 0;
    for (const duplicate of duplicates) {
      const result = await messages.updateMany(
        { chatId: duplicate._id },
        { $set: { chatId: keeper._id } }
      );
      moved += result.modifiedCount;
    }

    const latestMessage = await messages
      .find({ chatId: keeper._id })
      .sort({ timestamp: -1 })
      .limit(1)
      .next();

    const update: Record<string, unknown> = {};
    if (latestMessage) {
      update.lastMessage = latestMessage._id;
      update.lastMessageTime = latestMessage.timestamp;
    }

    // Keep the newest active deal if the kept chat has none (or only a finished one).
    if (!isActiveDeal(keeper)) {
      const activeDealSource = list.find(isActiveDeal);
      if (activeDealSource?.dealInfo) {
        update.dealInfo = activeDealSource.dealInfo;
        update.type = "deal";
      } else if (keeper.dealInfo) {
        update.type = "deal";
      }
    } else {
      update.type = "deal";
    }

    if (!DRY_RUN) {
      if (Object.keys(update).length > 0) {
        await chats.updateOne({ _id: keeper._id }, { $set: update });
      }
      await chats.deleteMany({ _id: { $in: duplicates.map((d) => d._id) } });
    }

    mergedPairs++;
    removedChats += duplicates.length;
    movedMessages += moved;
  }

  console.log(`\n${DRY_RUN ? "Would merge" : "Merged"} ${mergedPairs} pair(s).`);
  console.log(`${DRY_RUN ? "Would move" : "Moved"} ${movedMessages} message(s).`);
  console.log(`${DRY_RUN ? "Would delete" : "Deleted"} ${removedChats} duplicate chat(s).`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error("❌ Duplicate chat cleanup failed:", error);
  process.exit(1);
});
