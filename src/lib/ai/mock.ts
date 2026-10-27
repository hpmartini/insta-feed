import type { AiAdapter } from "@/lib/types";
import { clusterByTitle } from "./cluster";

export const mockAi: AiAdapter = {
  name: "mock",
  async summarize({ title, content }) {
    const sentences = content.replace(/\s+/g, " ").trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [];
    return sentences.slice(0, 3).map((s) => s.trim()).join(" ") || title;
  },
  async clusterStories(items) {
    return clusterByTitle(items);
  },
};
