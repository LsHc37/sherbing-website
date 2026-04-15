'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

type PollSignal = {
  id: string;
  to: string;
  from: string;
  type: 'offer' | 'answer' | 'ice';
  payload: unknown;
  createdAt: number;
};

type PollParticipant = {
  id: string;
  name: string;
  joinedAt: number;
};

function randomId() {
  return `p-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function InterviewCallPage({ params }: { params: { roomId: string } }) {
  const roomId = String(params.roomId || '').trim();
  const [displayName, setDisplayName] = useState('');
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState('Waiting to join call...');
  const [participants, setParticipants] = useState<PollParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');

  const participantIdRef = useRef<string>(randomId());
  const lastSeenSignalTimeRef = useRef<number>(0);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteParticipantIdRef = useRef<string>('');

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/interview-call/${encodeURIComponent(roomId)}`;
  }, [roomId]);

  const postAction = async (payload: unknown) => {
    await fetch(`/api/interview-calls/${encodeURIComponent(roomId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  };

  const ensurePeer = () => {
    if (peerRef.current) return peerRef.current;

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    peer.onicecandidate = (event) => {
      if (!event.candidate || !remoteParticipantIdRef.current) return;
      void postAction({
        action: 'signal',
        participantId: participantIdRef.current,
        to: remoteParticipantIdRef.current,
        type: 'ice',
        payload: event.candidate,
      });
    };

    peer.ontrack = (event) => {
      if (!remoteVideoRef.current) return;
      remoteVideoRef.current.srcObject = event.streams[0];
      setStatus('Connected');
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peer.addTrack(track, localStreamRef.current as MediaStream);
      });
    }

    peerRef.current = peer;
    return peer;
  };

  const createOfferFor = async (targetParticipantId: string) => {
    if (!targetParticipantId) return;
    remoteParticipantIdRef.current = targetParticipantId;

    const peer = ensurePeer();
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    await postAction({
      action: 'signal',
      participantId: participantIdRef.current,
      to: targetParticipantId,
      type: 'offer',
      payload: offer,
    });

    setStatus('Calling participant...');
  };

  const handleSignal = async (signal: PollSignal) => {
    const peer = ensurePeer();
    remoteParticipantIdRef.current = signal.from;

    if (signal.type === 'offer') {
      await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await postAction({
        action: 'signal',
        participantId: participantIdRef.current,
        to: signal.from,
        type: 'answer',
        payload: answer,
      });
      setStatus('Joining call...');
      return;
    }

    if (signal.type === 'answer') {
      await peer.setRemoteDescription(signal.payload as RTCSessionDescriptionInit);
      setStatus('Connected');
      return;
    }

    if (signal.type === 'ice') {
      try {
        await peer.addIceCandidate(signal.payload as RTCIceCandidateInit);
      } catch {
        // Ignore occasional out-of-order candidate errors.
      }
    }
  };

  const pollRoom = async () => {
    if (!joined) return;

    const response = await fetch(
      `/api/interview-calls/${encodeURIComponent(roomId)}?participantId=${encodeURIComponent(participantIdRef.current)}&since=${lastSeenSignalTimeRef.current}`,
      { cache: 'no-store' }
    );
    const data = await response.json().catch(() => ({}));

    const nextParticipants = Array.isArray(data.participants) ? (data.participants as PollParticipant[]) : [];
    const nextSignals = Array.isArray(data.signals) ? (data.signals as PollSignal[]) : [];

    setParticipants(nextParticipants);

    for (const signal of nextSignals) {
      lastSeenSignalTimeRef.current = Math.max(lastSeenSignalTimeRef.current, Number(signal.createdAt || 0));
      if (signal.to === participantIdRef.current || signal.to === '*') {
        await handleSignal(signal);
      }
    }

    const otherParticipant = nextParticipants.find((participant) => participant.id !== participantIdRef.current);
    if (!remoteParticipantIdRef.current && otherParticipant) {
      await createOfferFor(otherParticipant.id);
    }

    await postAction({ action: 'heartbeat', participantId: participantIdRef.current });
  };

  const joinCall = async () => {
    const safeName = String(displayName || '').trim() || 'Guest';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      await postAction({
        action: 'join',
        participantId: participantIdRef.current,
        participantName: safeName,
      });

      setJoined(true);
      setStatus('Joined. Waiting for the other participant...');
    } catch {
      setStatus('Camera/Mic permission is required to join the call.');
    }
  };

  const leaveCall = async () => {
    setJoined(false);
    await postAction({ action: 'leave', participantId: participantIdRef.current });

    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    remoteParticipantIdRef.current = '';
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
    if (!joined) return;

    const timer = window.setInterval(() => {
      void pollRoom();
    }, 1200);

    return () => window.clearInterval(timer);
    // Polling interval intentionally follows joined state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);

  useEffect(() => {
    return () => {
      void leaveCall();
    };
    // Cleanup should run once on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
