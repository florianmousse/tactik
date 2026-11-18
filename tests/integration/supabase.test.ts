import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

test(
  'Supabase réel : isolation RLS, RPC privées, CAS concurrent et quotas atomiques',
  { skip: process.env.RUN_SUPABASE_INTEGRATION !== '1', timeout: 60000 },
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
      publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    assert.ok(
      url && publicKey && secret,
      'Variables Supabase nécessaires (projet de test uniquement).',
    );
    const options = { auth: { autoRefreshToken: false, persistSession: false } };
    const admin = createClient(url, secret, options),
      anon = createClient(url, publicKey, options);
    const ids: string[] = [],
      code = randomBytes(6).toString('hex').toUpperCase(),
      rateKey = `integration-${randomUUID()}`;
    try {
      const users = [];
      for (let i = 0; i < 2; i++) {
        const email = `taktik-test-${randomUUID()}@example.com`,
          password = randomBytes(32).toString('hex');
        const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
        assert.equal(created.error, null);
        ids.push(created.data.user!.id);
        // Admin-generated magic link yields a one-time token without sending email.
        const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
        assert.equal(link.error, null);
        const client = createClient(url, publicKey, options);
        const login = await client.auth.verifyOtp({
          token_hash: link.data.properties!.hashed_token,
          type: 'magiclink',
        });
        assert.equal(login.error, null);
        users.push(client);
      }
      const state = {
        host: ids[0],
        capacity: 2,
        people: [{ id: ids[0], name: 'Test' }],
        game: null,
      };
      assert.equal(
        (await admin.rpc('create_game_room', { p_code: code, p_state: state, p_user: ids[0] }))
          .error,
        null,
      );
      for (const client of [anon, ...users]) {
        assert.ok((await client.from('room_messages').select('*').eq('room_code', code)).error);
        assert.ok(
          (
            await client.rpc('append_room_message', {
              p_code: code,
              p_user: ids[0],
              p_id: randomUUID(),
              p_name: 'Test',
              p_text: 'Message',
            })
          ).error,
        );
        assert.ok(
          (await client.from('game_rooms').select('*').eq('code', code)).error,
          'Un client ne doit pas lire game_rooms.',
        );
        assert.ok(
          (await client.rpc('commit_game_room', { p_code: code, p_version: 0, p_state: state }))
            .error,
          'RPC accessible au client.',
        );
        assert.ok(
          (await client.rpc('create_game_room', { p_code: code, p_state: state, p_user: ids[0] }))
            .error,
        );
        assert.ok(
          (await client.rpc('consume_rate_limit', { p_key: rateKey, p_max: 2, p_seconds: 60 }))
            .error,
        );
      }
      const own = await users[0].from('room_events').select('*').eq('room_code', code);
      assert.equal(own.error, null);
      assert.equal(own.data?.length, 1);
      const other = await users[1].from('room_events').select('*').eq('room_code', code);
      assert.equal(other.error, null);
      assert.deepEqual(other.data, []);
      assert.deepEqual(
        (await users[1].from('room_members').select('*').eq('room_code', code)).data,
        [],
      );
      assert.ok(
        (await users[0].from('room_events').update({ version: 100 }).eq('room_code', code)).error,
      );
      const results = await Promise.all(
        [0, 1].map(() =>
          admin.rpc('commit_game_room', { p_code: code, p_version: 0, p_state: state }),
        ),
      );
      assert.ok(results.every((r) => !r.error));
      assert.equal(results.filter((r) => r.data === true).length, 1);
      assert.equal(
        (await admin.from('game_rooms').select('version').eq('code', code).single()).data?.version,
        1,
      );
      const message = {
        p_code: code,
        p_user: ids[0],
        p_id: randomUUID(),
        p_name: 'Test',
        p_text: '<b>Texte</b>',
      };
      assert.ok((await admin.rpc('append_room_message', { ...message, p_user: ids[1] })).error);
      for (let retry = 0; retry < 2; retry++) {
        assert.equal((await admin.rpc('append_room_message', message)).error, null);
      }
      const messages = await admin.from('room_messages').select('text').eq('room_code', code);
      assert.equal(messages.error, null);
      assert.deepEqual(messages.data, [{ text: message.p_text }]);
      const signal = await users[0]
        .from('room_events')
        .select('version,chat_revision')
        .eq('room_code', code)
        .single();
      assert.equal(signal.error, null);
      assert.deepEqual(signal.data, { version: 1, chat_revision: 1 });
      const botState = {
        ...state,
        people: [...state.people, { id: `bot:${randomUUID()}`, name: 'Bot', bot: true }],
      };
      const botCommit = await admin.rpc('commit_game_room', {
        p_code: code,
        p_version: 1,
        p_state: botState,
      });
      assert.equal(botCommit.error, null);
      assert.equal(botCommit.data, true);
      const members = await admin.from('room_members').select('user_id').eq('room_code', code);
      assert.equal(members.error, null);
      assert.deepEqual(members.data, [{ user_id: ids[0] }]);
      const joined = {
        ...state,
        public: true,
        capacity: 4,
        people: [...state.people, { id: ids[1], name: 'Invite' }],
      };
      assert.equal(
        (await admin.rpc('commit_game_room', { p_code: code, p_version: 2, p_state: joined })).data,
        true,
      );
      assert.equal(
        (await users[1].from('room_events').select('*').eq('room_code', code)).data?.length,
        1,
      );
      for (const client of [anon, ...users])
        assert.ok((await client.rpc('list_public_rooms')).error);
      const listed = await admin.rpc('list_public_rooms');
      assert.equal(listed.error, null);
      assert.deepEqual(
        listed.data.find((r: { code: string }) => r.code === code),
        { code, name: 'Test', capacity: 4, players: 2, jokers: false },
      );
      const kicked = { ...joined, people: state.people, banned: [ids[1]] };
      assert.equal(
        (await admin.rpc('commit_game_room', { p_code: code, p_version: 3, p_state: kicked })).data,
        true,
      );
      assert.deepEqual(
        (await users[1].from('room_events').select('*').eq('room_code', code)).data,
        [],
      );
      assert.deepEqual(
        (await users[1].from('room_members').select('*').eq('room_code', code)).data,
        [],
      );
      assert.ok(
        (await admin.rpc('append_room_message', { ...message, p_id: randomUUID(), p_user: ids[1] }))
          .error,
      );
      assert.equal(
        (await admin.rpc('commit_game_room', { p_code: code, p_version: 3, p_state: joined })).data,
        false,
      );
      assert.equal(
        (
          await admin.rpc('commit_game_room', {
            p_code: code,
            p_version: 4,
            p_state: { ...kicked, public: false },
          })
        ).data,
        true,
      );
      assert.equal(
        (await admin.rpc('list_public_rooms')).data.some((r: { code: string }) => r.code === code),
        false,
      );
      const limits = await Promise.all(
        Array.from({ length: 5 }, () =>
          admin.rpc('consume_rate_limit', { p_key: rateKey, p_max: 2, p_seconds: 60 }),
        ),
      );
      assert.ok(limits.every((r) => !r.error));
      assert.equal(limits.filter((r) => r.data === true).length, 2);
    } finally {
      // Only exact temporary keys/UUIDs created by this invocation are removed.
      assert.equal((await admin.from('game_rooms').delete().eq('code', code)).error, null);
      assert.equal((await admin.from('rate_limits').delete().eq('key', rateKey)).error, null);
      for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  },
);
