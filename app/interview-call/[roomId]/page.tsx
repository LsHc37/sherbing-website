'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

type CallParticipant = {
  id: string;
  name: string;
  joinedAt: number;
};

type SignalPayload = {
  from: string;
  to?: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

function randomId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildIceServers(): RTCIceServer[] {
  const iceServers: RTCIceServer[] = [];
  const stunUrls = String(process.env.NEXT_PUBLIC_WEBRTC_STUN_URLS || 'stun:stun.l.google.com:19302')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);

  if (stunUrls.length > 0) {
    iceServers.push({ urls: stunUrls });
  }

  const turnUrls = String(process.env.NEXT_PUBLIC_WEBRTC_TURN_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  const turnUsername = String(process.env.NEXT_PUBLIC_WEBRTC_TURN_USERNAME || '').trim();
  const turnCredential = String(process.env.NEXT_PUBLIC_WEBRTC_TURN_CREDENTIAL || '').trim();

  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    iceServers.push({
      urls: turnUrls,
      username: turnUsername,
      credential: turnCredential,
    });
  }

  return iceServers;
}

export default function InterviewCallPage({ params }: { params: Promise<{ roomId: string }> }) {
  const [roomId, setRoomId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState('Waiting to join call...');
  const [participants, setParticipants] = useState<CallParticipant[]>([]);
  const [peerState, setPeerState] = useState('idle');
  const [iceState, setIceState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const channelRef = useRef<RealtimeChannel | null>(null);
  const participantIdRef = useRef<string>(randomId());
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteParticipantIdRef = useRef<string>('');
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    void (async () => {
      const resolved = await params;
      setRoomId(String(resolved.roomId || '').trim());
    })();
  }, [params]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    if (!roomId) return '';
    return `${window.location.origin}/interview-call/${encodeURIComponent(roomId)}`;
  }, [roomId]);

  const sendSignal = async (payload: SignalPayload) => {
    if (!channelRef.current) return;
    await channelRef.current.send({
      type: 'broadcast',
      event: 'signal',
      payload,
    });
  };

  const ensurePeer = () => {
    if (peerRef.current) return peerRef.current;

    const peer = new RTCPeerConnection({
      iceServers: buildIceServers(),
    });

    peer.onnegotiationneeded = async () => {
      if (!joined) return;
      try {
        makingOfferRef.current = true;
        await peer.setLocalDescription();
        await sendSignal({
          from: participantIdRef.current,
          to: remoteParticipantIdRef.current || '*',
          description: peer.localDescription || undefined,
        });
      } catch {
        // Ignore negotiation retries.
      } finally {
        makingOfferRef.current = false;
      }
    };

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal({
        from: participantIdRef.current,
        to: remoteParticipantIdRef.current || '*',
        candidate: event.candidate.toJSON(),
      });
    };

    peer.ontrack = (event) => {
      if (!remoteVideoRef.current) return;
      remoteVideoRef.current.srcObject = event.streams[0];
      setStatus('Connected');
    };

    peer.onconnectionstatechange = () => {
      setPeerState(peer.connectionState);
      if (peer.connectionState === 'connected') {
        setStatus('Connected');
      } else if (peer.connectionState === 'connecting') {
        setStatus('Connecting media...');
      } else if (peer.connectionState === 'failed') {
        setStatus('Connection failed. Check camera/mic permissions and network access.');
      }
    };

    peer.oniceconnectionstatechange = () => {
      setIceState(peer.iceConnectionState);
      if (peer.iceConnectionState === 'connected' || peer.iceConnectionState === 'completed') {
        setStatus('Connected');
      } else if (peer.iceConnectionState === 'checking') {
        setStatus('Checking network path...');
      } else if (peer.iceConnectionState === 'failed') {
        setStatus('ICE failed. This usually means a network/NAT issue or missing TURN relay.');
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current as MediaStream);
      });
    }

    peerRef.current = peer;
    return peer;
  };

  const handleSignal = async (signal: SignalPayload) => {
    if (signal.from === participantIdRef.current) return;
    if (signal.to && signal.to !== '*' && signal.to !== participantIdRef.current) return;

    const peer = ensurePeer();
    remoteParticipantIdRef.current = signal.from;

    if (signal.description) {
      const description = signal.description;
      const polite = participantIdRef.current > signal.from;
      const offerCollision = description.type === 'offer' && (makingOfferRef.current || peer.signalingState !== 'stable');
      ignoreOfferRef.current = !polite && offerCollision;
      if (ignoreOfferRef.current) return;

      try {
        if (offerCollision && polite) {
          await peer.setLocalDescription({ type: 'rollback' });
        }
        await peer.setRemoteDescription(description);
        if (description.type === 'offer') {
          await peer.setLocalDescription();
          await sendSignal({
            from: participantIdRef.current,
            to: signal.from,
            description: peer.localDescription || undefined,
          });
          setStatus('Joining call...');
        }
      } catch {
        // Ignore transient negotiation races.
      }

      return;
    }

    if (signal.candidate) {
      try {
        await peer.addIceCandidate(signal.candidate);
      } catch {
        // Ignore candidate order races.
      }
    }
  };

  const updateParticipantsFromPresence = () => {
    const channel = channelRef.current;
    if (!channel) return;

    const presenceState = channel.presenceState<CallParticipant>();
    const nextParticipants: CallParticipant[] = Object.values(presenceState)
      .flat()
      .map((entry) => ({
        id: String(entry.id || '').trim(),
        name: String(entry.name || 'Guest').trim(),
        joinedAt: Number(entry.joinedAt || Date.now()),
      }))
      .filter((entry) => entry.id);

    setParticipants(nextParticipants);

    const otherParticipant = nextParticipants.find((entry) => entry.id !== participantIdRef.current);
    if (otherParticipant && !remoteParticipantIdRef.current) {
      remoteParticipantIdRef.current = otherParticipant.id;
      setStatus('Participant joined, connecting...');
    }
  };

  const joinCall = async () => {
    const safeName = String(displayName || '').trim() || 'Guest';

    if (!roomId) {
      setStatus('Invalid room id.');
      return;
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      setStatus('Supabase realtime is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      ensurePeer();

      const supabase = createClient();
      const channel = supabase.channel(`interview-room-${roomId}`, {
        config: {
          presence: {
            key: participantIdRef.current,
          },
        },
      });

      channel
        .on('presence', { event: 'sync' }, () => {
          updateParticipantsFromPresence();
        })
        .on('broadcast', { event: 'signal' }, (event: { payload: unknown }) => {
          const payload = event.payload;
          if (!payload || typeof payload !== 'object') return;
          void handleSignal(payload as SignalPayload);
        });

      const subscriptionResult = await new Promise<string>((resolve) => {
        channel.subscribe((nextStatus) => {
          resolve(nextStatus);
        });
      });

      if (subscriptionResult !== 'SUBSCRIBED') {
        setStatus('Unable to connect realtime call channel.');
        return;
      }

      await channel.track({
        id: participantIdRef.current,
        name: safeName,
        joinedAt: Date.now(),
      });

      channelRef.current = channel;
      setJoined(true);
      setStatus('Joined. Waiting for the other participant...');
      updateParticipantsFromPresence();
    } catch {
      setStatus('Camera/Mic permission is required to join the call.');
    }
  };

  const leaveCall = async () => {
    setJoined(false);

    if (channelRef.current) {
      await channelRef.current.untrack();
      await channelRef.current.unsubscribe();
      channelRef.current = null;
    }

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    remoteParticipantIdRef.current = '';
    setParticipants([]);
    setStatus('Call ended.');
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const nextCameraOff = !cameraOff;
    localStreamRef.current.getVideoTracks().forEach((track) => {
      track.enabled = !nextCameraOff;
    });
    setCameraOff(nextCameraOff);
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyMessage('Invite link copied.');
      window.setTimeout(() => setCopyMessage(''), 2000);
    } catch {
      setCopyMessage('Unable to copy. Copy it manually below.');
      window.setTimeout(() => setCopyMessage(''), 2500);
    }
  };

  useEffect(() => {
    return () => {
      void leaveCall();
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Interview Video Call Room</h1>
          <Link href="/employee/job-applications" className="text-sm text-gray-300 hover:text-white">Back to job applications</Link>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
          <p className="text-sm text-gray-300">Room: <span className="font-mono text-gray-100">{roomId}</span></p>
          <p className="text-sm text-gray-300">Status: {status}</p>
          <p className="text-xs text-gray-400">Peer state: {peerState} | ICE state: {iceState}</p>
          <p className="text-sm text-gray-300">Participants in room: {participants.length}</p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              disabled={joined}
              placeholder="Your name"
              className="rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white"
            />
            {!joined ? (
              <button onClick={() => void joinCall()} className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
                Join call
              </button>
            ) : (
              <>
                <button onClick={toggleMute} className="rounded-md bg-gray-700 px-3 py-2 text-sm hover:bg-gray-600">
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button onClick={toggleCamera} className="rounded-md bg-gray-700 px-3 py-2 text-sm hover:bg-gray-600">
                  {cameraOff ? 'Camera on' : 'Camera off'}
                </button>
                <button onClick={() => void leaveCall()} className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold hover:bg-rose-600">
                  Leave call
                </button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900 p-4 space-y-3">
          <p className="text-sm font-semibold">Share Invite Link</p>
          <div className="flex gap-2 flex-wrap">
            <input readOnly value={shareUrl} className="min-w-[300px] flex-1 rounded-md border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white" />
            <button onClick={() => void copyLink()} className="rounded-md bg-sky-700 px-3 py-2 text-sm font-semibold hover:bg-sky-600">Copy link</button>
          </div>
          {copyMessage && <p className="text-xs text-emerald-300">{copyMessage}</p>}
          <p className="text-xs text-gray-400">Send this link to the interview person so they can join directly in your website.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-800 bg-black p-2">
            <p className="px-2 py-1 text-xs text-gray-400">You</p>
            <video ref={localVideoRef} autoPlay muted playsInline className="w-full rounded-md bg-gray-900 aspect-video object-cover" />
          </div>
          <div className="rounded-lg border border-gray-800 bg-black p-2">
            <p className="px-2 py-1 text-xs text-gray-400">Other participant</p>
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full rounded-md bg-gray-900 aspect-video object-cover" />
          </div>
        </div>
      </div>
    </main>
  );
}
