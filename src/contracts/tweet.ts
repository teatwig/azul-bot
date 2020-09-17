export default interface Tweet {
  id: BigInt;
  fullText: string;
  createdAt: string;
  mediaUrls: string[];
  hashtags: string[];
  likeCount: number;
  retweetCount: number;

  userName: string;
  userScreenName: string;

  localPaths: string[];
}
