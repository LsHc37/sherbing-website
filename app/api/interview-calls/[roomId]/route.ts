import { NextRequest, NextResponse } from 'next/server';

type SignalType = 'offer' | 'answer' | 'ice';

type RoomParticipant = {
  id: string;
  name: string;
  joinedAt: number;
  lastSeenAt: number;
};

type RoomSignal = {
  id: string;
  to: string;
  from: string;
  type: SignalType;
  payload: unknown;
  createdAt: number;
};

type RoomState = {
  participants: Record<string, RoomParticipant>;
  signals: RoomSignal[];
};

type RoomsStore = Map<string, RoomState>;

const ROOM_IDLE_TTL_MS = 1000 * 60 * 60;
const SIGNAL_TTL_MS = 1000 * 60 * 10;

function getStore(): RoomsStore {
  const globalWithStore = globalThis as typeof globalThis & { __sherbInterviewRooms?: RoomsStore };
  if (!globalWithStore.__sherbInterviewRooms) {
    globalWithStore.__sherbInterviewRooms = new Map<string, RoomState>();
  }

  return globalWithStore.__sherbInterviewRooms;
}

function sanitizeRoomId(value: string) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 64);
}

function cleanupRoom(room: RoomState, now: number) {
  room.signals = room.signals.filter((signal) => now - signal.createdAt <= SIGNAL_TTL_MS);

  Object.keys(room.participants).forEach((participantId) => {
    const participant = room.participants[participantId];
    if (now - participant.lastSeenAt > ROOM_IDLE_TTL_MS) {
      delete room.participants[participantId];
    }
  });
}

function cleanupStore(store: RoomsStore, now: number) {
  for (const [roomId, room] of store.entries()) {
    cleanupRoom(room, now);
    if (Object.keys(room.participants).length === 0 && room.signals.length === 0) {
      store.delete(roomId);
    }
  }
}

function getOrCreateRoom(store: RoomsStore, roomId: string): RoomState {
  const existing = store.get(roomId);
  if (existing) return existing;

  const room: RoomState = {
    participants: {},
    signals: [],
  };
  store.set(roomId, room);
  return room;
}

export async function GET(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  const { roomId: rawRoomId } = await context.params;
  const roomId = sanitizeRoomId(rawRoomId);
  if (!roomId) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });

  const participantId = String(request.nextUrl.searchParams.get('participantId') || '').trim();
  const since = Number(request.nextUrl.searchParams.get('since') || '0');
  const now = Date.now();

  const store = getStore();
  cleanupStore(store, now);

  const room = store.get(roomId);
  if (!room) {
    return NextResponse.json({ participants: [], signals: [], serverTime: now });
  }

  cleanupRoom(room, now);

  if (participantId && room.participants[participantId]) {
    room.participants[participantId].lastSeenAt = now;
  }

  const participants = Object.values(room.participants).map((participant) => ({
    id: participant.id,
    name: participant.name,
    joinedAt: participant.joinedAt,
  }));

  const signals = room.signals.filter((signal) => {
    if (signal.createdAt <= since) return false;
    if (!participantId) return true;
    return signal.to === participantId || signal.to === '*';
  });

  return NextResponse.json({
    participants,
    signals,
    serverTime: now,
  });
}

export async function POST(request: NextRequest, context: { params: Promise<{ roomId: string }> }) {
  const { roomId: rawRoomId } = await context.params;
  const roomId = sanitizeRoomId(rawRoomId);
  if (!roomId) return NextResponse.json({ error: 'Invalid room id' }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: 'join' | 'leave' | 'signal' | 'heartbeat';
    participantId?: string;
    participantName?: string;
    to?: string;
    type?: SignalType;
    payload?: unknown;
  };

  const action = body.action;
  const participantId = String(body.participantId || '').trim();
  const now = Date.now();

  if (!action) return NextResponse.json({ error: 'action is required' }, { status: 400 });
  if (!participantId) return NextResponse.json({ error: 'participantId is required' }, { status: 400 });

  const store = getStore();
  cleanupStore(store, now);
  const room = getOrCreateRoom(store, roomId);
  cleanupRoom(room, now);

  if (action === 'join') {
    const participantName = String(body.participantName || '').trim() || 'Guest';
    room.participants[participantId] = {
      id: participantId,
      name: participantName,
      joinedAt: room.participants[participantId]?.joinedAt || now,
      lastSeenAt: now,
    };

    return NextResponse.json({ success: true });
  }

  if (action === 'heartbeat') {
    const existing = room.participants[participantId];
    if (existing) {
      existing.lastSeenAt = now;
    }

    return NextResponse.json({ success: true });
  }

  if (action === 'leave') {
    delete room.participants[participantId];
    return NextResponse.json({ success: true });
  }

  if (action === 'signal') {
    const to = String(body.to || '').trim();
    const type = body.type;

    if (!to) return NextResponse.json({ error: 'to is required' }, { status: 400 });
    if (!type || !['offer', 'answer', 'ice'].includes(type)) {
      return NextResponse.json({ error: 'Invalid signal type' }, { status: 400 });
    }

    room.signals.push({
      id: `sig-${now}-${Math.random().toString(36).slice(2, 8)}`,
      to,
      from: participantId,
      type,
      payload: body.payload,
      createdAt: now,
    });

    if (room.participants[participantId]) {
      room.participants[participantId].lastSeenAt = now;
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
