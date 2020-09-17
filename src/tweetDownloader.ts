import Twitter from "twitter-lite";
import fs from "fs";
import path from "path";
import { downloadTweet } from "./download";
import Tweet from "./contracts/tweet";

export async function getTweet(
  tweetId: string,
  targetDir: string,
  client: Twitter
) {
  console.log(`Trying to fetch tweet: ${tweetId}`);

  const jsonTweet = await client
    .get(`statuses/show/${tweetId}`, {
      tweet_mode: "extended",
    })
    .catch((reason) => {
      throw new Error(reason);
    });

  return processExtendedTweet(targetDir, jsonTweet);
}

async function processExtendedTweet(
  targetDir: string,
  jsonTweet: any
): Promise<Tweet> {
  createDir(targetDir);

  const tweet: Tweet = {
    fullText: jsonTweet.full_text,
    createdAt: jsonTweet.created_at,
    id: jsonTweet.id_str,
    mediaUrls: getMediaUrls(jsonTweet),
    hashtags: getHashtags(jsonTweet),
    likeCount: jsonTweet.favorite_count,
    retweetCount: jsonTweet.retweet_count,
    userName: jsonTweet.user.name,
    userScreenName: jsonTweet.user.screen_name,
    localPaths: [],
  };

  console.log(`Got tweet: ${tweet.id}`);

  if (!tweet.mediaUrls) {
    throw new Error("No media URLs in tweet");
  }

  return downloadTweet(tweet, targetDir);
}

function createDir(dir: string) {
  let partsCombined = "";

  dir.split(".").forEach((part) => {
    partsCombined = path.join(partsCombined, part);

    if (!fs.existsSync(partsCombined)) {
      fs.mkdirSync(partsCombined, { recursive: true });
    }
  });
}

function getMediaUrls(tweet: any): string[] {
  if (tweet.extended_entities) {
    return tweet.extended_entities.media.map((media: any) => {
      if (media.type === "video") {
        return getVideoUrl(media);
      } else {
        return media.media_url;
      }
    });
  } else {
    return null;
  }
}

function getHashtags(tweet: any): string[] {
  if (tweet.entities && tweet.entities.hashtags) {
    return tweet.entities.hashtags.map((ht: any) => ht.text);
  }
  return [];
}

function getVideoUrl(media: any): string {
  var bestBitrate = 0;
  var bestVideoUrl;

  for (const variant of media.video_info.variants) {
    if (variant.bitrate && variant.bitrate > bestBitrate) {
      bestBitrate = variant.bitrate;
      bestVideoUrl = variant.url;
    }
  }
  return bestVideoUrl;
}
