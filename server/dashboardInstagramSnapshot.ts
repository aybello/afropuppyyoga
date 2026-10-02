export type DashboardInstagramSnapshot = {
  status: "verified_snapshot";
  source: string;
  refreshedAt: string;
  followers: number;
  following: number;
  posts: number;
  recentPostsAnalyzed: number;
  recentLikes: number;
  recentComments: number;
  averageInteractions: number;
  topRecentPost: {
    publishedAt: string;
    format: "Image" | "Reel" | "Carousel";
    likes: number;
    comments: number;
    interactions: number;
  };
  message: string;
};

/**
 * Owner-only aggregate snapshot collected from the authenticated @afropuppyyoga
 * Instagram Business connection on 2026-10-02. Do not add post captions,
 * audience identities, tokens, or account credentials to this payload.
 */
export const dashboardInstagramSnapshot: DashboardInstagramSnapshot = {
  status: "verified_snapshot",
  source: "@afropuppyyoga Instagram Business connection",
  refreshedAt: "2026-10-02T04:54:11.000Z",
  followers: 13365,
  following: 1471,
  posts: 913,
  recentPostsAnalyzed: 20,
  recentLikes: 1244,
  recentComments: 18,
  averageInteractions: 63.1,
  topRecentPost: {
    publishedAt: "2026-09-27T00:45:12.000Z",
    format: "Image",
    likes: 256,
    comments: 2,
    interactions: 258,
  },
  message: "Verified account snapshot. Recent engagement covers the latest 20 posts available through the connected business account at refresh time.",
};
