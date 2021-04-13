import fs from "fs";
import path from "path";
import request from "request";
import Tweet from "./contracts/tweet";

const sourcePrefixTweet = "tweet_";
const sourcePrefixUnknown = "unknown_";

export async function downloadTweet(
  tweet: Tweet,
  targetDir: string,
  overrideFiles: boolean
): Promise<Tweet> {
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
      overrideFiles,
      isMultipleMedia ? j : null
    );
    tweet.localPaths.push(downloadedPath);
  }

  writeAsJson(tweet, targetDirPrefix);

  return tweet;
}

export async function downloadGenericMedia(
  url: string,
  targetDir: string,
  overrideFiles: boolean
): Promise<string> {
  // replace separators to be path safe
  const currentTime = new Date().toISOString().replace(/[:.]/g, "-");

  const targetDirPrefix = path.join(
    targetDir,
    `${sourcePrefixUnknown}${currentTime}`
  );

  const downloadedPath = await downloadFile(
    url,
    targetDirPrefix,
    overrideFiles
  );

  return downloadedPath;
}

function downloadFile(
  mediaUrl: string,
  targetDirPrefix: string,
  overrideFiles: boolean,
  index?: number
): Promise<string> {
  // TODO passing overrideFiles all the way down seems kinda bad
  // would be cool to have this as a global flag that can be accessed
  // create a "processing" object which does the downloading and has the flag set?

  const ext = mediaUrl
    .split(".")
    .reverse()[0]
    .replace(/\?.*/, "") // remove request parameters from extension
    .replace(/:[a-z]+$/, ""); // remove twitter size indicator (:orig/:large)

  return new Promise((resolve, reject) => {
    const num = index == null ? "" : `_${index}`;

    const targetPath = `${targetDirPrefix}${num}.${ext}`;

    // throw error if the file already exists
    const stats = fs.statSync(targetPath);
    if (stats.isFile && !overrideFiles) {
      // TODO error msgs HAVE to go somewhere else
      // this file shouldn't tell the user what to do
      reject(
        new Error(
          `Media was already saved on: ${stats.mtime}\nOverride by passing "!force" flag.`
        )
      );
    } else {
      console.log("Requesting media from URL: " + mediaUrl);
      const req = request
        .get(mediaUrl)
        .on("response", (resp) => {
          console.log("Request status: " + resp.statusCode);

          const stream = fs
            .createWriteStream(targetPath)
            .on("finish", () => {
              console.log("Saved file: " + targetPath);
              resolve(targetPath);
            })
            .on("error", (err) =>
              reject(new Error("Filesystem error: " + err))
            );

          req.pipe(stream);
        })
        .on("error", (err) => {
          reject(new Error("Request error: " + err));
        });
    }
  });
}

function writeAsJson(object: any, targetDirPrefix: string): string {
  const targetPath = `${targetDirPrefix}.json`;

  fs.writeFile(targetPath, JSON.stringify(object), (err) => {
    if (err) {
      throw new Error("Filesystem error: " + err.message);
    }
    console.log("File created!");
  });

  return targetPath;
}
