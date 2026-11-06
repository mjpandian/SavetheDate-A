// Activity sources for the agent's search tools. A source returns candidate venues with the
// fields code needs to build an Activity: the agent never supplies these itself.
import type { Activity } from "@/lib/types";

/** One search hit. `ref` is unique within a run and is how a submitted row cites a discovered venue. */
export interface SourceResult {
  ref: string;
  name: string;
  category: string;
  /** Price per person from the source, or null when the source does not list one. */
  price: number | null;
  priceIsEstimate: boolean;
  sourceUrl: string;
  /** Set when the hit is a catalog activity. Catalog hits are cited by `activityId`, not `sourceRef`. */
  activityId?: string;
}

export interface ActivitySource {
  searchPlaces(query: string): Promise<SourceResult[]>;
  searchEvents(query: string): Promise<SourceResult[]>;
}

const MAX_RESULTS = 10;

/** MVP source: searches the catalog only, so `discovered` stays empty until a live source exists. */
export function catalogSource(activities: readonly Activity[]): ActivitySource {
  const search = async (query: string): Promise<SourceResult[]> => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = activities.filter((a) => {
      if (words.length === 0) return true;
      const haystack = [a.name, a.category, ...a.tags].join(" ").toLowerCase();
      return words.some((w) => haystack.includes(w));
    });
    return hits.slice(0, MAX_RESULTS).map((a) => ({
      ref: `cat:${a.id}`,
      name: a.name,
      category: a.category,
      price: a.pricePerPerson,
      priceIsEstimate: a.priceIsEstimate,
      sourceUrl: a.sourceUrl,
      activityId: a.id,
    }));
  };
  return { searchPlaces: search, searchEvents: search };
}
