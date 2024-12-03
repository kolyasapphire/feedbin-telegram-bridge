import { encodeBase64 } from 'jsr:@std/encoding/base64'

import type { Entry } from './types.ts'

const API_BASE = 'https://api.feedbin.com/v2'

const REPLACEMENTS = [['//vitalik.ca', '//vitalik.eth.limo']]

const FEEDBIN_BASE_AUTH = Deno.env.get('FEEDBIN_BASE_AUTH') // user:password
const BOT_TOKEN = Deno.env.get('BOT_TOKEN')
const BOT_CHAT = Deno.env.get('BOT_CHAT')

const job = async () => {
  if (!FEEDBIN_BASE_AUTH || !BOT_TOKEN || !BOT_CHAT) {
    console.error('Bad config')
    return
  }

  const sendMessage = async (
    text: string,
    options?: { [key: string]: unknown },
  ) => {
    const body = {
      chat_id: BOT_CHAT,
      text,
      ...options,
    }

    const req = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    if (!req.ok) console.error(await req.json())
  }

  const headers = {
    'Authorization': `Basic ${encodeBase64(FEEDBIN_BASE_AUTH)}`,
    'Content-Type': 'application/json; charset=utf-8', // required
  }

  // biome-ignore lint: it's better
  const unreadRes = await fetch(API_BASE + '/unread_entries.json', { headers })
  const unreadIds = await unreadRes.json() as number[]

  // biome-ignore lint: it's better
  const entriesRes = await fetch(API_BASE + `/entries.json?ids=${unreadIds.join(',')}`, { headers })
  const entries = await entriesRes.json() as Entry[]

  for (const entry of entries) {
    const url = REPLACEMENTS.reduce(
      (acc, [search, replacement]) => acc.replaceAll(search, replacement),
      entry.url,
    )

    await sendMessage(
      [
        entry.title,
        '', // spacer
        url,
      ].join('\n'),
      { parse_mode: 'HTML' },
    )
  }

  // biome-ignore lint: it's better
  await fetch(API_BASE + '/unread_entries.json', {
    method: 'DELETE',
    headers,
    body: JSON.stringify({
      'unread_entries': unreadIds,
    }),
  })
}

Deno.cron('job', '*/15 * * * *', job)
