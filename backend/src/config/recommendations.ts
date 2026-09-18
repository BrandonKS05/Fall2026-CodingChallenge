/**
 * Every number the recommender can be tuned by, in one place.
 *
 * Nothing here is encoded in the schema, so moving any of it is a restart
 * rather than a migration. Each entry says which way to move it and what that
 * does, because a constant whose effect you have to derive from the call site
 * is a constant nobody dares touch.
 */
export const RECOMMENDATIONS = {
  embedding: {
    /** The model the vectors come from. Changing it means re-embedding everything. */
    model: 'text-embedding-3-small',
    /**
     * Pictures per request to the model. Higher = fewer round trips and a
     * faster backfill; too high and one bad row fails a big batch and the
     * whole batch is retried. 96 is comfortably inside the provider's limit.
     */
    batchSize: 96,
    /**
     * How many times a picture may fail before it is left alone. Higher =
     * more patience with a flaky provider; lower = a permanently broken row
     * stops costing requests sooner.
     */
    maxAttempts: 4,
    /** Backoff between attempts, doubled each time. Higher = gentler on a provider that is rate-limiting. */
    retryBaseMs: 500,
    /** How long a single embedding call may take before it is abandoned. */
    requestTimeoutMs: 20_000,
    /**
     * How long the worker sleeps when the queue is empty. Lower = a new
     * picture becomes recommendable sooner; higher = fewer idle queries.
     */
    idlePollMs: 15_000,
  },

  interaction: {
    /**
     * What each action is worth when it is blended into a centroid. These are
     * ratios, not absolutes: what matters is that a save counts for more than
     * a like and a hide pushes the other way. Raise one and that action starts
     * to dominate what the feed thinks somebody wants.
     */
    weights: {
      view: 0.1,
      like: 1.0,
      save: 1.5,
      share: 2.0,
      hide: -1.0,
    },
    /**
     * How long a picture has to be on screen before looking counts as
     * interest. Higher = only deliberate looks count; lower = scrolling past
     * starts to shape the feed.
     */
    viewDwellMs: 3_000,
  },

  profile: {
    /**
     * How many interests somebody may hold at once. Higher = a broader taste
     * is represented faithfully but each centroid is reinforced less often;
     * lower = a few strong interests crowd out the rest.
     */
    maxCentroids: 8,
    /**
     * How close a picture has to be to an existing interest to count as more
     * of the same. Higher = new interests spawn readily and the profile
     * fragments; lower = everything is absorbed into a few vague centroids.
     *
     * Measured, not guessed. Pictures people put on the same board are the
     * ground truth for "one interest", and against this model their pairwise
     * similarity runs about 0.65 median against 0.35 for pictures from
     * different boards. At 0.55, 77% of same-board pairs merge and only 6% of
     * unrelated ones do — the widest gap between the two. It was 0.72 first,
     * which merged under a third of what belonged together and would have
     * thrashed the centroid cap. Re-measure after changing the model: the
     * usable range is a property of the embeddings, not of taste.
     */
    mergeThreshold: 0.55,
    /**
     * How much of a new picture is blended into the interest it lands in.
     * Higher = taste follows the last few things done; lower = taste is slow
     * to change and slow to correct a mistake.
     */
    alpha: 0.15,
    /**
     * How many centroids a sign-up's chosen categories may seed. The rest of
     * the cap is left free for interests earned by behaviour, which is why
     * seeds are also the first to be evicted.
     */
    maxSeedCentroids: 3,
    /**
     * Days of silence after which an interest is considered stale when the cap
     * is reached. Lower = the profile forgets quickly.
     */
    stalenessDays: 30,
  },

  ranking: {
    /** Pictures fetched per interest before merging. Higher = better feeds, more index work. */
    candidatesPerCentroid: 100,
    /**
     * How long a picture takes to lose half its freshness. Higher = the feed
     * happily shows older work; lower = it chases whatever was posted today.
     */
    recencyHalfLifeDays: 14,
    /** At most this many from one person, so no single account fills a feed. */
    maxPerAuthor: 2,
    /** At most this share of a feed from one interest, so it stays more than one mood. */
    maxSharePerCentroid: 0.4,
    /**
     * How much of the feed is deliberately not personalised. Higher = more
     * chance to discover something outside the bubble, and more of the feed
     * spent on things there is no evidence anybody wants.
     */
    explorationRatio: 0.15,
    /** How many pictures a slate is ranked into. It is the depth a reader can scroll before a re-rank. */
    slateSize: 240,
    /** How long a slate is good for. Longer = the order survives a break; shorter = a fresher feed on return. */
    slateTtlMinutes: 30,
  },

  seen: {
    /**
     * How long a picture stays suppressed after it has been shown. Higher =
     * less repetition and a bigger table; lower = the feed recycles sooner.
     */
    retentionDays: 30,
  },
} as const;

export type RecommendationsConfig = typeof RECOMMENDATIONS;
