#!/usr/bin/env node
/**
 * Trainer Showdown test bots — join a host room via Supabase Realtime and auto-play.
 * Usage: node scripts/showdown-bots.mjs <room-code>
 * Example: npm run bots -- devbattle
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const envPath = join(root, '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const url = env.SUPABASE_URL || '';
const key = env.SUPABASE_ANON_KEY || '';
const roomId = (process.argv[2] || 'devbattle').trim().toLowerCase();

if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_ANON_KEY — copy .env.example → .env');
  process.exit(1);
}

const BENCH_MAX = 5;
const BOTS = [
  { voterId: '00000000-0000-4000-8000-000000000001', name: 'Bot Alpha' },
  { voterId: '00000000-0000-4000-8000-000000000002', name: 'Bot Bravo' },
];

function payloadOf(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  if (msg.payload != null && (msg.type === 'broadcast' || msg.event)) return msg.payload;
  return msg;
}

function send(channel, bot, event, payload) {
  channel.send({ type: 'broadcast', event, payload: { voterId: bot.voterId, playerName: bot.name, ...payload } });
}

function createBot(bot) {
  const client = createClient(url, key, { realtime: { params: { eventsPerSecond: 20 } } });
  const channel = client.channel(`pokemon-party-${roomId}`, {
    config: { broadcast: { ack: false, self: true }, presence: { key: bot.voterId } },
  });

  let busy = false;
  let lastTurn = -1;

  const hello = () => {
    send(channel, bot, 'player_hello', { roomId, at: Date.now() });
    send(channel, bot, 'request_state', { roomId, at: Date.now() });
  };

  const maybeQuizVote = (state) => {
    if (state?.phase !== 'round' || !state.votingOpen) return;
    const round = state.round ?? 0;
    const key = `bot-vote-${bot.voterId}-${round}`;
    if (channel._lastVoteRound === round) return;
    const choices = state.choices?.length || 4;
    const idx = Math.floor(Math.random() * choices);
    send(channel, bot, 'vote', { choiceIndex: idx, round });
    channel._lastVoteRound = round;
    console.log(`[${bot.name}] voted ${idx} on round ${round + 1}`);
  };

  const playShowdown = (state) => {
    const duel = state?.randomDuel;
    if (!duel?.active || duel.phase !== 'combat') return;
    if (duel.activePlayerId !== bot.voterId) return;
    if (duel.isVotingLocked || busy) return;
    if (duel.turn === lastTurn && busy) return;

    const me = duel.trainers?.[bot.voterId];
    if (!me) return;

    busy = true;
    lastTurn = duel.turn;
    const turn = duel.turn;
    const oppId = duel.duelistIds?.find(id => id !== bot.voterId);
    const opp = oppId ? duel.trainers?.[oppId] : null;

    setTimeout(() => {
      try {
        const benchLive = (me.bench || []).filter(m => m.hp > 0);

        if (!benchLive.length) {
          send(channel, bot, 'showdown_action', { action: 'end_turn', turn });
          console.log(`[${bot.name}] end turn (no bench after deploy)`);
          return;
        }

        const roll = Math.random();
        if (roll < 0.12 && me.energy >= 2 && me.trainerHp < me.maxTrainerHp - 4) {
          send(channel, bot, 'showdown_action', { action: 'heal', benchUid: 'trainer', turn });
          console.log(`[${bot.name}] heal trainer`);
          return;
        }
        if (roll < 0.22 && me.energy >= 1) {
          const mon = benchLive[Math.floor(Math.random() * benchLive.length)];
          send(channel, bot, 'showdown_action', { action: 'buff', benchUid: mon.uid, turn });
          console.log(`[${bot.name}] buff ${mon.pokemon?.name}`);
          return;
        }
        if (roll < 0.32) {
          const mon = benchLive[Math.floor(Math.random() * benchLive.length)];
          send(channel, bot, 'showdown_action', { action: 'defend', benchUid: mon.uid, turn });
          console.log(`[${bot.name}] defend ${mon.pokemon?.name}`);
          return;
        }

        const attacker = benchLive[Math.floor(Math.random() * benchLive.length)];
        const moveIndex = Math.floor(Math.random() * Math.max(1, attacker.moves?.length || 4));
        const oppBench = (opp?.bench || []).filter(m => m.hp > 0);

        if (!oppBench.length || Math.random() < 0.3) {
          send(channel, bot, 'showdown_action', { action: 'attack_trainer', benchUid: attacker.uid, moveIndex, turn });
          console.log(`[${bot.name}] direct strike (${attacker.pokemon?.name})`);
        } else {
          const target = oppBench[Math.floor(Math.random() * oppBench.length)];
          send(channel, bot, 'showdown_action', {
            action: 'attack_pokemon', benchUid: attacker.uid, targetBenchUid: target.uid, moveIndex, turn,
          });
          console.log(`[${bot.name}] attacks ${target.pokemon?.name}`);
        }
      } finally {
        setTimeout(() => { busy = false; }, 1800);
      }
    }, 600 + Math.random() * 900);
  };

  channel
    .on('broadcast', { event: 'room_state' }, (msg) => {
      const state = payloadOf(msg);
      maybeQuizVote(state);
      playShowdown(state);
    })
    .subscribe(async (status, err) => {
      if (err) console.warn(`[${bot.name}]`, status, err);
      if (status !== 'SUBSCRIBED') return;
      await channel.track({ role: 'player', id: bot.voterId, name: bot.name, at: Date.now() });
      hello();
      console.log(`[${bot.name}] connected → room ${roomId}`);
      setInterval(hello, 8000);
    });

  return { bot, channel };
}

console.log(`\n⚔️  Showdown bots joining room: ${roomId}`);
console.log(`   Host URL: http://localhost:8765/?room=${roomId}&forceShowdown=1\n`);

BOTS.forEach(createBot);

process.on('SIGINT', () => {
  console.log('\nBots stopped.');
  process.exit(0);
});
