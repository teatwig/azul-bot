import fs from "fs";
import path from "path";
import request from "request";
import Tweet from "./contracts/tweet";

export async function downloadTweet(tweet: Tweet, targetDir: string) {
  const targetDirPrefix = path.join(targetDir, tweet.id.toString());
  const isMultipleMedia = tweet.mediaUrls.length > 1;

  for (var j = 0; j < tweet.mediaUrls.length; j++) {
    const mediaUrl = tweet.mediaUrls[j];
    const path = await downloadFile(
      mediaUrl,
      targetDirPrefix,
      isMultipleMedia ? j : null
    );
    tweet.localPaths.push(path);
  }

  writeAsJson(tweet, targetDirPrefix);

  return tweet;
}

function downloadFile(
  imageUrl: string,
  targetDirPrefix: string,
  index?: number
): Promise<string> {
  const ext = imageUrl.split(".").reverse()[0].replace(/\?.*/, "");

  return new Promise((resolve) => {
    const num = index ? `_${index}` : "";

    const targetPath = `${targetDirPrefix}${num}.${ext}`;

    const stream = fs.createWriteStream(targetPath);
    request(imageUrl).pipe(stream);
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
