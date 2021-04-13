import path from "path";
import fs from "fs";
import fse from "fs-extra";
import Twitter from "twitter-lite";
import { Telegraf } from "telegraf";
import { getTweet } from "./tweetDownloader";
import { downloadGenericMedia } from "./download";
import { resolve } from "dns";

require("dotenv").config();

const downloadDir = process.env.DOWNLOAD_DIR;

const allowedUsernames = process.env.ALLOWED_USERNAMES.split(",").map((u) =>
  u.trim()
);

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

const twitterClient = new Twitter({
  subdomain: "api",
  consumer_key: process.env.TWTR_CKEY,
  consumer_secret: process.env.TWTR_CSECRET,
  access_token_key: process.env.TWTR_ATOKEN,
  access_token_secret: process.env.TWTR_ASECRET,
});

bot.start((ctx) => ctx.reply("The Mostro Lounge is now open for service."));
bot.on("message", async (ctx) => {
  if (!allowedUsernames.includes(ctx.from.username)) {
    ctx.reply("You must enter a contract with me first.");
    return;
  }

  try {
    let messageText = ctx.message.text;
    if (ctx.message.document) {
      const caption = ctx.message.caption;
      const fileId = ctx.message.document.file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);

      if (caption) {
        messageText = `${caption} ${fileLink}`;
      } else {
        messageText = fileLink;
      }

      console.log("Received document message: " + messageText);
    } else {
      console.log("Received text message: " + messageText);
    }

    let args = messageText.split(" ");

    console.log("args: " + args.map((a) => `"${a}"`));

    let overrideFiles = false;
    if (args[0] === "!force") {
      console.log(
        '"!force" flag set, already downloaded media will be overriden.'
      );
      args.shift(); // remove arg
      overrideFiles = true;
    } else if (args[0] === "!REDOWNLOAD_ALL") {
      await redownloadAll().then((result) => {
        ctx.replyWithHTML(`<b>${result}</b>`);
      }, rethrowError);
      return; // don't do any of the rest
    }

    let source: string;
    let mainTag: string = "_untagged";
    let subTags: string[];

    switch (args.length) {
      case 1:
        source = args[0];
        break;
      case 2:
        mainTag = args[0];
        source = args[1];
        break;
      case 3:
        mainTag = args[0];
        subTags = args[1].split(",");
        source = args[2];
        break;
      default:
        throw new Error(`Invalid number of arguments: ${args.length}`);
    }

    const tagDir = getTagDirName(mainTag, subTags);

    const targetDir = path.join(downloadDir, tagDir);
    createDir(targetDir);

    console.log("Media will be saved in: " + targetDir);

    let tweetId = extractTweetId(source);

    if (tweetId) {
      await getTweet(twitterClient, tweetId, targetDir, overrideFiles).then(
        (tweet) => {
          ctx.replyWithHTML(
            `Saved ${tweet.localPaths.length} files as <b>${tagDir}</b> from tweet: ${tweet.id}`
          );
        },
        rethrowError
      );
    } else if (source.match(/^https?:\/\/.+$/)) {
      await downloadGenericMedia(source, targetDir, overrideFiles).then(
        (downloadedPath) => {
          const relativePath = path.relative(downloadDir, downloadedPath);
          ctx.replyWithHTML(`Saved media from URL as: ${relativePath}`);
        },
        rethrowError
      );
    } else {
      throw new Error("Last argument is neither a tweet nor a URL.");
    }
  } catch (error) {
    let errorMessage = error instanceof Error ? error.message : error;
    console.error(`Error: ${errorMessage}`);
    ctx.reply(`Error: ${errorMessage}`);
  }
});
bot.launch();

console.log(`Started bot with download dir: ${downloadDir}`);

function rethrowError(error: any): Error {
  throw error instanceof Error ? error : new Error(error);
}

function extractTweetId(arg: string): string | null {
  return (
    arg.match(/^.*twitter\.com\/.*\/status\/(\d+)\/?.*$/)?.[1] ||
    arg.match(/^(\d+)$/)?.[1]
  );
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

function getTagDirName(mainTag: string, subTags: string[]): string {
  const mainLower = mainTag.toLowerCase();
  const joinedSubsLower =
    (subTags
      ?.sort()
      .map((t) => `[${t.toLowerCase()}]`)
      .join("") || "") + "";

  return mainLower + joinedSubsLower;
}

const timer = (ms: number) => new Promise((res) => setTimeout(res, ms));

// string contains info about redownloaded files
async function redownloadAll(): Promise<string> {
  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, "-") // time colons
    .replace(/\..+/, ""); // remove milliseconds
  const backupDir = `${downloadDir}_${timestamp}`;

  return new Promise((resolve, reject) => {
    fse
      .copy(downloadDir, backupDir)
      .then(async () => {
        console.log("Created backup directory: " + backupDir);

        const directories = fs
          .readdirSync(downloadDir, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);

        const success: string[] = [];
        const failure: string[] = [];

        for (const dir of directories) {
          console.log("Attempting redownload of files in directory: " + dir);

          const splits = dir
            .replace(/\]/g, "") // remove "]" so we can split on "[" to get all tags
            .split("[");
          const mainTag = splits[0];
          splits.shift(); // remove mainTag
          const subTags = splits;

          const tagDir = getTagDirName(mainTag, subTags);
          const targetDir = path.join(downloadDir, tagDir);

          const tweetIds = fs
            .readdirSync(targetDir, { withFileTypes: true })
            .filter(
              // TODO duplicate var...
              (dirent) => dirent.isFile() && /tweet_.+\.json/.test(dirent.name)
            )
            .map((dirent) => dirent.name.match(/tweet_(.+)\.json/)[1]);

          for (const tweetId of tweetIds) {
            console.log("Attempting redownload of tweet: " + tweetId);
            await getTweet(twitterClient, tweetId, targetDir, true).then(
              (tweet) => {
                console.log("Redownload success: " + tweetId);
                success.push(tweetId);
              },
              (err) => {
                console.log(
                  "Redownload failure: " +
                    tweetId +
                    ", Error: " +
                    (err instanceof Error ? err.message : err)
                );
                failure.push(tweetId);
              }
            );

            await timer(1000).then(() =>
              console.log("(waited to not spam the twitter API)")
            );
          }
        }

        console.log(`Redownload success (${success.length}): ${success}`);
        console.log(`Redownload failure (${failure.length}): ${failure}`);

        resolve(
          `Redownloaded ${success.length} / ${success.length + failure.length}`
        );
      })
      .catch((err) => {
        reject(new Error("Error while creating backup: " + err.message));
      });
  });
}
