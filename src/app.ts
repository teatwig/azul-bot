import path from "path";
import Twitter from "twitter-lite";
import { Telegraf } from "telegraf";
import { getTweet } from "./tweetDownloader";

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

    let tweetId: string;
    let mainTag: string = "_untagged";
    let subTags: string[];

    switch (args.length) {
      case 1:
        tweetId = extractTweetId(args[0]);
        break;
      case 2:
        mainTag = args[0];
        tweetId = extractTweetId(args[1]);
        break;
      case 3:
        mainTag = args[0];
        subTags = args[1].split(",");
        tweetId = extractTweetId(args[2]);
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

    await getTweet(tweetId, targetDir, twitterClient).then(
      (result) => {
        ctx.replyWithHTML(
          `Saved ${result.localPaths.length} files as <b>${tagDir}</b> from tweet: ${result.id}`
        );
      },
      (error) => {
        throw new Error(error);
      }
    );
  } catch (error) {
    console.error(`Error: ${error}`);
    ctx.reply(`Error: ${error}`);
  }
});
bot.launch();

function extractTweetId(arg: string): string {
  return (
    arg.match(/^.*twitter\.com\/.*\/status\/(\d+)\/?.*$/)?.[1] ||
    arg.match(/^(\d+)$/)?.[1]
  );
}
