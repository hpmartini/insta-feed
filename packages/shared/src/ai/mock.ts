import { clusterItems } from "../clustering";
import { firstSentences } from "../text";
import type { AiAdapter } from "./adapter";

export class MockAdapter implements AiAdapter {
  async summarize({ title, text }: { title: string; text: string }) {
    return firstSentences(text, 3) || title;
  }

  async cluster(items: Parameters<AiAdapter["cluster"]>[0]) {
    return clusterItems(items);
  }
}
