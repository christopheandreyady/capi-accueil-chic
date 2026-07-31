CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_client_id text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'lobby',
  fill_with_bots boolean NOT NULL DEFAULT true,
  state jsonb,
  state_seq bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.room_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  seat integer NOT NULL,
  client_id text NOT NULL,
  name text NOT NULL,
  avatar text,
  level integer NOT NULL DEFAULT 1,
  is_bot boolean NOT NULL DEFAULT false,
  is_host boolean NOT NULL DEFAULT false,
  ready boolean NOT NULL DEFAULT false,
  connected boolean NOT NULL DEFAULT true,
  last_seen timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, seat),
  UNIQUE (room_id, client_id)
);

CREATE TABLE public.room_actions (
  id bigserial PRIMARY KEY,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  seat integer,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_room_players_room ON public.room_players(room_id);
CREATE INDEX idx_room_actions_room ON public.room_actions(room_id, id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_players TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_actions TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.room_actions_id_seq TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.room_players TO service_role;
GRANT ALL ON public.room_actions TO service_role;
GRANT ALL ON SEQUENCE public.room_actions_id_seq TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_open_beta" ON public.rooms FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "room_players_open_beta" ON public.room_players FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "room_actions_open_beta" ON public.room_actions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.room_players REPLICA IDENTITY FULL;
ALTER TABLE public.room_actions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_actions;