// Verifies the X "post on behalf" payload shape matches docs.x.com TweetCreateRequest.
// Mirrors panel approvePost priority: pinned tweet id > latest tweet of contact > standalone.
import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (ok, msg) => { ok ? pass++ : fail++; console.log((ok ? 'PASS' : 'FAIL') + '  ' + msg); };

// Ensure panel source actually implements the safe path (not user-id-as-tweet-id)
const panel = readFileSync('panel.js', 'utf8');
check(
  panel.includes('/tweets?max_results') || panel.includes('/tweets?max_results=5'),
  'panel resolves contact → latest tweet id via Users tweets endpoint'
);
check(
  !/in_reply_to_tweet_id:\s*tu\.data\.id/.test(panel),
  'panel never uses user id as in_reply_to_tweet_id'
);
check(panel.includes('pinnedTweet.tweetId'), 'panel prefers pinnedTweet.tweetId for replies');

const buildPayload = (draft, pinnedTweet, latestTweetId) => {
  const payload = { text: draft };
  if (pinnedTweet && pinnedTweet.tweetId) {
    payload.reply = { in_reply_to_tweet_id: String(pinnedTweet.tweetId) };
  } else if (latestTweetId) {
    payload.reply = { in_reply_to_tweet_id: String(latestTweetId) };
  }
  return payload;
};

const a = buildPayload('hello', null, null);
check(!a.reply && a.text === 'hello', 'standalone post: { text } only, no reply');

const b = buildPayload('nice take', { tweetId: '1881234567890', handle: 'GoddessAther' }, null);
check(
  b.reply && b.reply.in_reply_to_tweet_id === '1881234567890',
  'reply-to-tweet: reply.in_reply_to_tweet_id = the tweet id'
);

const c = buildPayload('agreed', null, '1999888777666');
check(
  c.reply && c.reply.in_reply_to_tweet_id === '1999888777666',
  'reply-to-contact: uses latest tweet id, never @handle'
);

check(
  typeof a.text === 'string' && JSON.stringify(a).length > 0,
  'payload is JSON-serializable'
);

const bg = readFileSync('background.js', 'utf8');
check(bg.includes('in_reply_to_tweet_id'), 'background forwards reply block');
check(bg.includes('/\\d{1,25}/') || bg.includes('^\\d{1,25}$'), 'background validates tweet id shape');

console.log('\n' + (fail === 0 ? 'ALL GREEN (' + pass + ')' : fail + ' FAILURE(S)'));
process.exit(fail === 0 ? 0 : 1);
