import path from "path";
import Twitter from "twitter-lite";
import { Telegraf } from "telegraf";
import { getTweet } from "./tweetDownloader";
import { downloadGenericMedia } from "./download";

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
    const args = ctx.message.text.split(" ");

    console.log("args: " + args.map((a) => `"${a}"`));

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

    const tagDir =
      mainTag.toLowerCase() +
      (subTags
        ?.sort()
        .map((t) => `[${t.toLowerCase()}]`)
        .join("") || "") +
      "";
    const targetDir = path.join(downloadDir, tagDir);

    let tweetId = extractTweetId(source);

    if (tweetId) {
      await getTweet(tweetId, targetDir, twitterClient).then((tweet) => {
        ctx.replyWithHTML(
          `Saved ${tweet.localPaths.length} files as <b>${tagDir}</b> from tweet: ${tweet.id}`
        );
      }, rethrowError);
    } else if (source.match(/^https?:\/\/.+$/)) {
      await downloadGenericMedia(source, targetDir).then((downloadedPath) => {
        ctx.replyWithHTML(`Saved media from URL as: ${downloadedPath}`);
      }, rethrowError);
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

function rethrowError(error: any) {
  throw error instanceof Error ? error : new Error(error);
}

function extractTweetId(arg: string): string | null {
  return (
    arg.match(/^.*twitter\.com\/.*\/status\/(\d+)\/?.*$/)?.[1] ||
    arg.match(/^(\d+)$/)?.[1]
  );
}
