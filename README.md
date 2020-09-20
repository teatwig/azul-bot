# Azul Bot

A Telegram bot for downloading all media from a provided tweet to a local (optionally tagged) directory on the server while keeping information about the source (tweet text, author, URL).

Also supports direct media URLs.

This was hacked together solely for personal use and I don't even know why I'm putting any effort into documenting it.

## Installation

TODO

Create an `.env` file containing the environment variables with the API keys for Twitter and Telegram, as well as the path for the local download directory.

Run
```shell
npm start
```

## Bot Usage

```
[main-tag] [[sub-tags,]] media-source
```

After sending the bot the media source (which can be either a URL of a tweet, the ID of a tweet, or a direct URL to an image etc.) it will be downloaded to an `_untagged` directory on the configured download path.

Specifying a main tag will change the name of the target directory, a comma separated list of sub-tags will be appended to the directory name in the form `maintag[subtag1][subtag2].

All tags will be lowercased and the sub tags sorted alphabetically to avoid duplicates.
