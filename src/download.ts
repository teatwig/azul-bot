import fs from "fs";
import path from "path";
import request from "request";
import Tweet from "./contracts/tweet";

const sourcePrefixTweet = "tweet_";
const sourcePrefixUnknown = "unknown_";

export async function downloadTweet(tweet: Tweet, targetDir: string) {
  const targetDirPrefix = path.join(
    targetDir,
    `${sourcePrefixTweet}${tweet.id.toString()}`
  );
  const isMultipleMedia = tweet.mediaUrls.length > 1;

  for (var j = 0; j < tweet.mediaUrls.length; j++) {
    const mediaUrl = tweet.mediaUrls[j];
    const downloadedPath = await downloadFile(
      mediaUrl,
      targetDirPrefix,
      isMultipleMedia ? j : null
    );
    tweet.localPaths.push(downloadedPath);
  }

  writeAsJson(tweet, targetDirPrefix);

  return tweet;
}

export async function downloadGenericMedia(url: string, targetDir: string) {
  // replace separators to be path safe
  const currentTime = new Date().toISOString().replace(/[:.]/g, "-");

  const targetDirPrefix = path.join(
    targetDir,
    `${sourcePrefixUnknown}${currentTime}`
  );

  const downloadedPath = await downloadFile(url, targetDirPrefix);

  return downloadedPath;
}

function downloadFile(
  mediaUrl: string,
  targetDirPrefix: string,
  index?: number
): Promise<string> {
  // remove request parameters from extension
  const ext = mediaUrl.split(".").reverse()[0].replace(/\?.*/, "");

  return new Promise((resolve) => {
    const num = index == null ? "" : `_${index}`;

    const targetPath = `${targetDirPrefix}${num}.${ext}`;

    const stream = fs.createWriteStream(targetPath);
    request(mediaUrl).pipe(stream);
    stream.on("finish", () => resolve(targetPath));
  });
}

function writeAsJson(object: any, targetDirPrefix: string): string {
  const targetPath = `${targetDirPrefix}.json`;

  fs.writeFile(targetPath, JSON.stringify(object), function (err) {
    if (err) {
      return console.error(err);
    }
    console.log("File created!");
  });

  return targetPath;
}
