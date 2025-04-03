const { TwitterApi } = require('twitter-api-v2');
const fs = require('fs');

// Replace with your credentials
const client = new TwitterApi({
  appKey: 'LezDMtw4MjNX96X2lTMQk4a57',
  appSecret: 'tlL9TihgjkqaWTLA6hz3nvXnVtttoF1coWIrMXQKYkdmz9ePC0',
  accessToken: '1874272473732325376-80cunmDCB8ykmajxt0npoHztHlKW3s',
  accessSecret: 'Rowk4vksfc64VKWrmA9Ao9alUnLM171IBg3BITnaBJDoA',
});

async function postToTwitter(imagePath, caption) {
  const mediaData = await client.v1.uploadMedia(imagePath);
  await client.v2.tweet({ text: caption, media: { media_ids: [mediaData] } });
  console.log(`🐦 Posted alert to Twitter`);
}

module.exports = { postToTwitter };
