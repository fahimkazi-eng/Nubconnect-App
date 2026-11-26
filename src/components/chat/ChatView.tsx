'use client';

// Full-screen conversation view. Renders OUTSIDE the app shell so the chat is
// immersive on mobile (§8.2): no bottom nav, composer pinned above the
// keyboard via 100dvh layout.
//
// Split from the route: this is the client half; src/app/(chat)/messages/[id]/page.tsx
// is the thin server wrapper that exports metadata.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Ban,
  BellOff,
  Copy,
  ChevronRight,
  Check,
  CheckCheck,
  CornerUpLeft,
  Flag,
  Forward,
  ImagePlus,
  ListChecks,
  Mic,
  MoreVertical,
  Pause,
  Pencil,
  Pin,
  Play,
  Search as SearchIcon,
  Send,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { useApp } from '@/lib/store';
import { Avatar, BottomSheet, DemoTag, Lightbox } from '@/components/ui/kit';
import { timeAgo } from '@/lib/format';
import { DEMO_PEOPLE } from '@/lib/demo/dataset';
import { getSupabaseBrowserClient, isBackendConfigured } from '@/lib/supabase';
import { signedMessagePhoto } from '@/lib/messaging';

export default function ChatView({ id }: { id: string }) {
  const router = useRouter();
  const {
    conversations,
    forwardMessage,
    toggleConversationArchive,
    toggleMessagePin,
    pinnedMessages,
    presenceHidden,
    user,
    editMessage,
    deleteMessage,
    pushToast,
    inboxLoading,
    authLoading,
    refreshConversation,
    sendMessage,
    reactToMessage,
    replyTo,
    setReplyTo,
    acceptRequest,
    declineRequest,
    markConversationRead,
    reportContent,
    toggleConversationPin,
    toggleConversationMute,
    blockedIds,
    blockPerson,
    unblockPerson,
  } = useApp();

  const found = conversations.find((c) => c.id === id);
  // With a real backend, never render a session-only (demo or local) chat.
  const conversation =
    isBackendConfigured() && found && (found.isDemo || found.isLocal) ? undefined : found;
  const recentConversations = conversations
    .filter((c) => c.id !== id && !c.archived && c.request !== 'declined')
    .slice(0, 8);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [photoErrors, setPhotoErrors] = useState<Record<string, boolean>>({});
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTyping, setShowTyping] = useState(false);
  const [atBottom, setAtBottom] = useState(true);
  const [forwardFor, setForwardFor] = useState<string | null>(null);
  const [forwardSelectionOpen, setForwardSelectionOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // In-conversation search
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageQuery, setMessageQuery] = useState('');
  // Multi-select mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Voice notes
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<{ blob: Blob; url: string } | null>(null);
  const [recordedSeconds, setRecordedSeconds] = useState(0);
  const [waveBars, setWaveBars] = useState<number[]>([]);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<Record<string, number>>({});
  const [audioDurations, setAudioDurations] = useState<Record<string, number>>({});
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStartedAtRef = useRef(0);
  const recordingTimerRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const waveTimerRef = useRef<number | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const micStreamRef = useRef<MediaStream | null>(null);
  // Presence: the other participant is considered active while any of their
  // devices is in this conversation's presence channel.
  const [otherOnline, setOtherOnline] = useState(false);
  const atBottomRef = useRef(true);
  const jumpToBottomRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingSentAtRef = useRef(0);
  const pingRefreshTimerRef = useRef<number | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const isRealConversation = Boolean(conversation && !conversation.isDemo && !conversation.isLocal);
  const messagesLoaded = conversation?.messagesLoaded !== false;
  const lastMessageId = conversation?.messages[conversation.messages.length - 1]?.id;

  useEffect(() => {
    if (!conversation) return;
    if (conversation.messagesLoaded === false) void refreshConversation(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id, conversation?.messagesLoaded, id]);

  useEffect(() => {
    if (!messagesLoaded) return;
    void markConversationRead(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, messagesLoaded, lastMessageId]);

  useEffect(() => {
    if (jumpToBottomRef.current || atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      jumpToBottomRef.current = false;
    }
  }, [conversation?.messages.length, replyTo]);

  // Real-time delivery ping: no content crosses the wire; receivers re-fetch
  // through the authorized loader. Falls back to the 30s inbox poll when
  // Realtime is unavailable on this deployment.
  useEffect(() => {
    if (!isBackendConfigured() || !isRealConversation) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase.channel(`conversation:${id}`);
    channel
      .on('broadcast', { event: 'ping' }, () => {
        if (pingRefreshTimerRef.current) window.clearTimeout(pingRefreshTimerRef.current);
        pingRefreshTimerRef.current = window.setTimeout(() => void refreshConversation(id), 120);
      })
      .on('broadcast', { event: 'typing' }, () => {
        setShowTyping(true);
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = window.setTimeout(() => setShowTyping(false), 3500);
      })
      .subscribe();
    typingChannelRef.current = channel;

    return () => {
      typingChannelRef.current = null;
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isRealConversation]);

  // Presence: "Active now" — the other participant is counted as active while
  // any of their devices is inside this conversation's presence channel. A
  // device-local opt-out ("Appear offline") skips tracking entirely.
  useEffect(() => {
    if (!isRealConversation || presenceHidden) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    const myId = user.id;
    const otherId = conversation?.participants[0];
    if (!otherId) return;

    const channel = supabase.channel(`presence:conversation:${id}`, {
      config: { presence: { key: myId } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState() as Record<string, Array<{ user_id?: string }>>;
        const others = Object.values(state)
          .flat()
          .filter((p) => p.user_id === otherId);
        setOtherOnline(others.length > 0);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: myId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isRealConversation, presenceHidden, user.id, conversation?.participants]);

  // Throttled typing ping: at most one every 2s.
  const sendTypingPing = () => {
    const now = Date.now();
    if (now - typingSentAtRef.current < 2000) return;
    typingSentAtRef.current = now;
    void typingChannelRef.current?.send({ type: 'broadcast', event: 'typing', payload: {} });
  };

  // Resolve private photo paths to short-lived signed URLs.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !conversation) return;

    const paths = conversation.messages
      .map((m) => m.photo)
      .filter((p): p is string => Boolean(p && !/^(https?:|blob:|data:)/.test(p)));

    if (paths.length === 0) return;
    let active = true;

    void Promise.all(
      Array.from(new Set(paths)).map(async (path) => {
        const url = await signedMessagePhoto(supabase, path);
        return [path, url] as const;
      }),
    ).then((pairs) => {
      if (!active) return;
      setPhotoUrls((prev) => {
        const next = { ...prev };
        for (const [path, url] of pairs) if (url) next[path] = url;
        return next;
      });
      setPhotoErrors((prev) => {
        const next = { ...prev };
        for (const [path, url] of pairs) {
          if (url) delete next[path];
          else next[path] = true;
        }
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [conversation]);

  // Live updates for real conversations. Demo and session-local chats stay
  // local by design.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase || !isRealConversation) return;

    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        () => void refreshConversation(id),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        () => void refreshConversation(id),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${id}` },
        () => void refreshConversation(id),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, isRealConversation, refreshConversation]);

  if (!conversation) {
    if (inboxLoading || authLoading) {
      return (
        <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-campus-bg px-6 text-center dark:bg-campus-dark-bg">
          <p className="font-display text-lg font-bold">Opening conversation…</p>
          <p className="max-w-xs text-sm text-campus-text-sec dark:text-campus-dark-sec">
            Loading your private messages.
          </p>
        </div>
      );
    }

    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-3 bg-campus-bg px-6 text-center dark:bg-campus-dark-bg">
        <p className="font-display text-lg font-bold">
          {isBackendConfigured() ? 'This conversation isn’t available.' : 'This conversation isn’t available in this session.'}
        </p>
        <p className="max-w-xs text-sm text-campus-text-sec dark:text-campus-dark-sec">
          {isBackendConfigured()
            ? 'It may belong to another account, or the link may be out of date.'
            : 'Demo conversations stay in this browser session — nothing is synced to a server.'}
        </p>
        <Link href="/messages" className="touch-target rounded-xl bg-violet px-5 py-2.5 text-sm font-bold text-plum">
          Back to messages
        </Link>
      </div>
    );
  }

  // ---- Multi-select mode -------------------------------------------------
  const toggleSelect = (messageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) next.delete(messageId);
      else next.add(messageId);
      return next;
    });
  };
  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };
  const selectedCount = selectedIds.size;
  const copySelected = async () => {
    if (!conversation) return;
    const chosen = conversation.messages.filter((m) => selectedIds.has(m.id));
    if (chosen.length === 0) return;
    const body = chosen.map((m) => (m.deletedAt ? '(deleted message)' : m.text)).join('\n\n');
    await copyText(body);
    exitSelectionMode();
  };
  const deleteSelected = async () => {
    if (!conversation || selectedIds.size === 0) return;
    const ids = [...selectedIds];
    for (const messageId of ids) {
      // Fails honestly if migration 015/017 is missing — nothing is faked.
      await deleteMessage(id, messageId);
    }
    exitSelectionMode();
  };
  const forwardSelected = async (targetConversationId: string) => {
    if (!conversation) return;
    const ids = [...selectedIds];
    for (const messageId of ids) {
      const message = conversation.messages.find((m) => m.id === messageId);
      if (!message) continue;
      await forwardMessage(targetConversationId, message.text || '📷 Photo');
    }
    exitSelectionMode();
  };

  const searchMatches = (value: string, query: string): boolean =>
    value.toLowerCase().includes(query.toLowerCase());

  // ---- Voice notes ---------------------------------------------------------
  const preferredMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const candidate of ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']) {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    }
    return null;
  };

  const startRecording = async () => {
    if (recording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      pushToast('Recording is not supported in this browser.', 'warning');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const mimeType = preferredMimeType();
      if (!mimeType) {
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        pushToast('No supported voice recording format in this browser.', 'warning');
        return;
      }
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        const type = mimeType.split(';')[0] ?? 'audio/webm';
        const blob = new Blob(chunks, { type });
        setRecordedBlob((current) => {
          if (current) URL.revokeObjectURL(current.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
        setRecordedSeconds(Math.max(1, Math.round((Date.now() - recordingStartedAtRef.current) / 1000)));
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current = null;
        audioContextRef.current?.close().catch(() => undefined);
        audioContextRef.current = null;
        analyserRef.current = null;
        if (waveTimerRef.current) window.clearInterval(waveTimerRef.current);
      };

      // Real waveform: read RMS from the live mic through an AnalyserNode.
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtor) {
        const context = new AudioCtor();
        audioContextRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;
        waveTimerRef.current = window.setInterval(() => {
          const a = analyserRef.current;
          if (!a) return;
          const data = new Uint8Array(a.frequencyBinCount);
          a.getByteFrequencyData(data);
          const bars: number[] = [];
          const step = Math.max(1, Math.floor(data.length / 28));
          for (let i = 0; i < 28; i += 1) {
            let peak = 0;
            for (let j = i * step; j < (i + 1) * step && j < data.length; j += 1) {
              peak = Math.max(peak, data[j] ?? 0);
            }
            bars.push(peak);
          }
          setWaveBars(bars);
        }, 80);
      }

      recorder.start();
      recorderRef.current = recorder;
      recordingStartedAtRef.current = Date.now();
      setRecording(true);
      setRecordedBlob(null);
      setWaveBars([]);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(
        () => setRecordingSeconds((s) => s + 1),
        1000,
      );
    } catch {
      pushToast('Microphone unavailable or permission denied.', 'warning');
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    setRecording(false);
    recorderRef.current = null;
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
  };

  const discardRecording = () => {
    setRecordedBlob((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setRecordingSeconds(0);
    setWaveBars([]);
  };

  const sendRecording = async () => {
    if (!recordedBlob || sending) return;
    const extension = (recordedBlob.blob.type.split('/')[1] ?? 'webm').replace(/[^a-z0-9]/g, '').slice(0, 5) || 'webm';
    const file = new File([recordedBlob.blob], `voice-${Date.now()}.${extension}`, {
      type: recordedBlob.blob.type || 'audio/webm',
    });
    setSending(true);
    // The upload path is the same private message bucket as photos; audio mime
    // support requires migration 018. Failure is reported honestly.
    const ok = await sendMessage(id, 'Voice message', undefined, file);
    setSending(false);
    if (ok) {
      discardRecording();
      jumpToBottomRef.current = true;
    }
  };

  const toggleAudioPlayback = (messageId: string, src: string | null) => {
    if (!src) {
      pushToast('Audio is not available yet.', 'warning');
      return;
    }
    const elements = audioElementsRef.current;
    const current = elements.get(messageId);
    if (current) {
      if (current.paused) {
        void current.play();
        setPlayingAudioId(messageId);
      } else {
        current.pause();
        setPlayingAudioId(null);
      }
      return;
    }
    const audio = new Audio(src);
    elements.set(messageId, audio);
    audio.addEventListener('timeupdate', () =>
      setAudioProgress((prev) => ({ ...prev, [messageId]: audio.currentTime })),
    );
    audio.addEventListener('loadedmetadata', () =>
      setAudioDurations((prev) => ({ ...prev, [messageId]: audio.duration })),
    );
    audio.addEventListener('ended', () => setPlayingAudioId(null));
    void audio.play();
    setPlayingAudioId(messageId);
  };

  const formatDuration = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  };

  const visibleMessages = (conversation?.messages ?? []).filter((m) => {
    if (!messageQuery.trim()) return true;
    return searchMatches(m.text, messageQuery.trim());
  });
  const matchCount = messageQuery.trim() ? visibleMessages.length : null;

  const withinEditWindow = (iso: string) => Date.now() - new Date(iso).getTime() < 15 * 60 * 1000;
  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      pushToast('Message copied');
    } catch {
      pushToast('Could not copy this message', 'warning');
    }
  };
  const confirmDelete = async (messageId: string) => {
    setConfirmDeleteId(null);
    await deleteMessage(id, messageId);
  };
  const saveEdit = async () => {
    const next = editText.trim();
    if (!next || !editingId) return;
    const ok = await editMessage(id, editingId, next);
    if (ok) {
      setEditingId(null);
      setEditText('');
    }
  };
  const doForward = async (targetConversationId: string) => {
    const source = conversation?.messages.find((m) => m.id === forwardFor);
    if (!source) return;
    const ok = await forwardMessage(targetConversationId, source.text || '📷 Photo');
    setForwardFor(null);
    pushToast(ok ? 'Message forwarded' : 'Could not forward — try again.', ok ? 'success' : 'warning');
  };

  // Shared pick handler for the Forward sheet — works for a single message
  // and for multi-selected messages alike.
  const handleForwardPick = async (targetConversationId: string) => {
    if (forwardSelectionOpen) {
      await forwardSelected(targetConversationId);
      setForwardSelectionOpen(false);
      return;
    }
    await doForward(targetConversationId);
  };

  const otherId = conversation.avatarSeeds[0] ?? conversation.participants[0] ?? id;
  const demoPerson = DEMO_PEOPLE.find((p) => p.id === conversation.participants[0]);
  const other = conversation.other;
  const person = other
    ? {
        username: other.username,
        name: other.name,
        isVerified: other.isVerified,
        avatarUrl: other.avatarUrl ?? undefined,
      }
    : demoPerson;
  const profileHref = other
    ? null
    : conversation.kind === 'group' || conversation.kind === 'plan'
      ? null
      : demoPerson
        ? `/profile/${demoPerson.username}`
        : null;
  const isBlockedDirect =
    conversation.kind === 'direct' && blockedIds.includes(conversation.participants[0] ?? '');
  const awaitingAcceptance =
    conversation.request === 'sent' && !conversation.isDemo && !conversation.isLocal;
  const declined = conversation.request === 'declined';

  const photoSrc = (path?: string) => {
    if (!path) return null;
    if (/^(https?:|blob:|data:)/.test(path)) return path;
    return photoUrls[path] ?? null;
  };
  const photoFailed = (path?: string) => Boolean(path && photoErrors[path]);

  const send = async () => {
    if (!text.trim() && !photo) return;
    setSending(true);
    const ok = await sendMessage(
      id,
      text.trim() || '📷 Photo',
      photo ?? undefined,
      photoFile ?? undefined,
    );
    setSending(false);
    if (ok) {
      jumpToBottomRef.current = true;
      setText('');
      setPhoto(null);
      setPhotoFile(null);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const identity = (
    <>
      <span className="relative shrink-0">
        <Avatar
          seed={otherId}
          name={conversation.title}
          size={38}
          src={other?.avatarUrl ?? undefined}
        />
        {otherOnline && isRealConversation && (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-lime ring-2 ring-campus-bg dark:ring-campus-dark-bg"
            title="Active now"
            aria-label="Active now"
          />
        )}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-display text-sm font-bold">{conversation.title}</span>
          {conversation.isDemo && <DemoTag compact />}
          {conversation.isLocal && (
            <span className="shrink-0 rounded-full bg-campus-bg px-1.5 py-px text-[9px] font-bold text-campus-text-sec ring-1 ring-campus-border dark:bg-campus-dark-card dark:text-campus-dark-sec dark:ring-campus-dark-border">
              This session
            </span>
          )}
        </span>
        <span className="block truncate text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
          {isRealConversation && otherOnline
            ? 'Active now'
            : conversation.kind === 'group' || conversation.kind === 'plan'
              ? `${conversation.participants.length + 1} members${conversation.kind === 'plan' ? ' · plan chat' : ''}`
              : person?.isVerified
                ? 'Verified NUB student'
                : 'NUB student'}
        </span>
      </span>
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col bg-campus-bg dark:bg-campus-dark-bg">
      {/* Header */}
      <header className="glass safe-top sticky top-0 z-30 flex items-center gap-3 border-x-0 border-t-0 px-2 py-2 sm:px-4">
        {selectionMode ? (
          <>
            <button
              onClick={exitSelectionMode}
              aria-label="Cancel selection"
              className="touch-target flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X size={20} />
            </button>
            <span className="flex-1 font-display text-sm font-bold">{selectedCount} selected</span>
            <button onClick={() => void copySelected()} disabled={selectedCount === 0} aria-label="Copy selected" className="touch-target flex items-center justify-center rounded-full p-2 disabled:opacity-40"><Copy size={18} /></button>
            <button onClick={() => setForwardSelectionOpen(true)} disabled={selectedCount === 0} aria-label="Forward selected" className="touch-target flex items-center justify-center rounded-full p-2 disabled:opacity-40"><Forward size={18} /></button>
            <button onClick={() => void deleteSelected()} disabled={selectedCount === 0} aria-label="Delete selected" className="touch-target flex items-center justify-center rounded-full p-2 text-coral-ink disabled:opacity-40"><Trash2 size={18} /></button>
          </>
        ) : (
          <>
            <button
              onClick={() => router.push('/messages')}
              aria-label="Back to messages"
              className="touch-target flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ArrowLeft size={20} />
            </button>
            {profileHref ? (
              <Link href={profileHref} className="flex min-w-0 flex-1 items-center gap-2.5">
                {identity}
              </Link>
            ) : (
              <div className="flex min-w-0 flex-1 items-center gap-2.5">{identity}</div>
            )}
            <button
              onClick={() => setSearchOpen((v) => !v)}
              aria-pressed={searchOpen}
              aria-label="Search in conversation"
              className="touch-target flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <SearchIcon size={19} />
            </button>
            <button
              onClick={() => setSelectionMode(true)}
              aria-label="Select messages"
              className="touch-target flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
            >
              <ListChecks size={19} />
            </button>
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Conversation options"
            aria-expanded={menuOpen}
            className="touch-target flex items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
          >
            <MoreVertical size={19} />
          </button>
          {menuOpen && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" aria-hidden onClick={() => setMenuOpen(false)} />
              <div role="menu" className="glass-strong absolute right-0 top-11 z-20 w-48 animate-pop rounded-2xl p-1 text-sm">
                <button
                  role="menuitem"
                  onClick={() => {
                    void toggleConversationPin(id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
                >
                  <Pin size={14} className={conversation.pinned ? 'rotate-45 text-violet-ink' : ''} />
                  {conversation.pinned ? 'Unpin' : 'Pin to top'}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    void toggleConversationMute(id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
                >
                  <BellOff size={14} />
                  {conversation.muted ? 'Unmute' : 'Mute notifications'}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    void toggleConversationArchive(id);
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
                >
                  {conversation.archived ? <ArchiveRestore size={14} className="text-violet-ink" /> : <Archive size={14} />}
                  {conversation.archived ? 'Restore to inbox' : 'Archive conversation'}
                </button>
                {conversation.kind === 'direct' && (
                  <button
                    role="menuitem"
                    onClick={() => {
                      const blocked = blockedIds.includes(conversation.participants[0] ?? '');
                      if (blocked) void unblockPerson(conversation.participants[0] ?? '');
                      else void blockPerson(conversation.participants[0] ?? '', conversation.title);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
                  >
                    <Ban size={14} />
                    {blockedIds.includes(conversation.participants[0] ?? '') ? 'Unblock' : 'Block'}
                  </button>
                )}
                <button
                  role="menuitem"
                  onClick={() => {
                    reportContent('this conversation', {
                      targetType: 'user',
                      targetId: conversation.participants[0] ?? '',
                      reason: 'harassment',
                    });
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium text-coral-ink hover:bg-coral-soft dark:text-coral dark:hover:bg-coral/10"
                >
                  <Flag size={14} /> Report
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    router.push('/messages');
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 font-medium hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
                >
                  <X size={14} /> Close chat
                </button>
              </div>
            </>
          )}
        </div>
          </>
        )}
      </header>

      {/* In-conversation search */}
      {searchOpen && !selectionMode && (
        <div className="flex items-center gap-2 border-x-0 border-b border-campus-border/60 bg-campus-bg px-3 py-2 dark:border-campus-dark-border dark:bg-campus-dark-bg">
          <SearchIcon size={15} className="shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />
          <input
            autoFocus
            value={messageQuery}
            onChange={(e) => setMessageQuery(e.target.value)}
            placeholder="Search loaded messages…"
            aria-label="Search messages"
            className="touch-target min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
          {matchCount !== null && conversation && (
            <span className="shrink-0 text-[11px] font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              {matchCount} of {conversation.messages.length}
            </span>
          )}
          {messageQuery && (
            <button onClick={() => setMessageQuery('')} aria-label="Clear search" className="touch-target shrink-0 rounded-lg p-1.5 text-campus-text-sec hover:bg-black/5 dark:hover:bg-white/10">
              <X size={15} />
            </button>
          )}
        </div>
      )}

      {/* Pinned strip */}
      {!selectionMode && (pinnedMessages[id]?.length ?? 0) > 0 && conversation && (
        <div className="border-x-0 border-b border-campus-border/60 bg-violet-soft/60 px-3 py-1.5 dark:border-campus-dark-border dark:bg-violet-dark-soft/60">
          <div className="mx-auto flex max-w-2xl items-center gap-2 overflow-x-auto no-scrollbar">
            <Pin size={12} className="shrink-0 text-violet-ink dark:text-violet" aria-hidden />
            {(pinnedMessages[id] ?? []).map((pinId) => {
              const pinnedMessage = conversation.messages.find((m) => m.id === pinId);
              if (!pinnedMessage) return null;
              return (
                <button
                  key={pinId}
                  onClick={() => document.getElementById(`msg-${pinId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  className="max-w-[220px] shrink-0 truncate rounded-lg bg-white/70 px-2 py-1 text-[11px] font-semibold dark:bg-campus-dark-card/70"
                  title={pinnedMessage.text}
                >
                  {pinnedMessage.deletedAt ? 'This message was deleted' : pinnedMessage.text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Item context (room / marketplace linked conversations) */}
      <main className="relative flex min-h-0 flex-1 flex-col">
        {conversation.context && (
          <Link
            href={conversation.context.href}
            className="card mx-2 mt-2 flex items-center gap-2.5 p-2 sm:mx-4"
          >
            <img src={conversation.context.thumb} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-bold">{conversation.context.title}</span>
              <span className="block text-[10px] text-campus-text-sec dark:text-campus-dark-sec">
                {conversation.context.price} • {conversation.context.status}
              </span>
            </span>
            <ChevronRight size={15} className="shrink-0 text-campus-text-sec dark:text-campus-dark-sec" />
          </Link>
        )}

        {/* Blocked person banner */}
        {conversation.kind === 'direct' && blockedIds.includes(conversation.participants[0] ?? '') && (
          <div className="mx-2 mt-2 rounded-2xl bg-coral-soft p-3 text-xs dark:bg-coral/10 sm:mx-4">
            <p className="font-bold text-coral-ink dark:text-coral">You blocked {conversation.title}</p>
            <p className="mt-0.5 text-campus-text-sec dark:text-campus-dark-sec">
              They can no longer message you or start new conversations with you. The history stays for your record.
            </p>
            <button
              onClick={() => void unblockPerson(conversation.participants[0] ?? '')}
              className="touch-target mt-2 rounded-xl bg-violet px-3.5 py-1.5 font-bold text-plum"
            >
              Unblock
            </button>
          </div>
        )}

        {/* Message request banner */}
        {conversation.request === 'incoming' && (
          <div className="mx-2 mt-2 rounded-2xl bg-violet-soft p-3 text-xs dark:bg-violet-dark-soft sm:mx-4">
            <p className="font-bold">{conversation.title} sent you a message request</p>
            <p className="mt-0.5 text-campus-text-sec dark:text-campus-dark-sec">
              They can’t see your reply until you accept.
            </p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => void acceptRequest(id)} className="touch-target flex-1 rounded-xl bg-violet py-2 font-bold text-plum">
                Accept
              </button>
              <button onClick={() => void declineRequest(id)} className="touch-target flex-1 rounded-xl bg-campus-card py-2 font-bold ring-1 ring-campus-border dark:bg-campus-dark-card dark:ring-campus-dark-border">
                Decline
              </button>
            </div>
          </div>
        )}

        {/* History */}
        <div
          ref={historyRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
            atBottomRef.current = distance < 80;
            setAtBottom(distance < 80);
          }}
          className="flex-1 overflow-y-auto px-2 py-3 sm:px-4"
        >
          <div className="mx-auto max-w-2xl space-y-2">
            {!messagesLoaded && (
              <p className="py-8 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
                Loading messages…
              </p>
            )}
            {visibleMessages.map((m) => {
              const mine = m.senderId === 'me';
              const replySource = m.replyToId
                ? conversation.messages.find((x) => x.id === m.replyToId)
                : null;
              const selected = selectedIds.has(m.id);
              const isPinned = (pinnedMessages[id] ?? []).includes(m.id);
              return (
                <div
                  key={m.id}
                  id={`msg-${m.id}`}
                  className={`group flex items-end gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}
                >
                  {selectionMode && (
                    <button
                      role="checkbox"
                      aria-checked={selected}
                      aria-label={selected ? 'Deselect message' : 'Select message'}
                      onClick={() => toggleSelect(m.id)}
                      className={`touch-target flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-full ring-2 transition ${
                        selected
                          ? 'bg-violet text-plum ring-violet'
                          : 'text-transparent ring-campus-border dark:ring-campus-dark-border'
                      }`}
                    >
                      <Check size={14} strokeWidth={3} />
                    </button>
                  )}
                  {!mine && !selectionMode && (
                    <Avatar
                      seed={otherId}
                      name={conversation.title}
                      size={26}
                      src={other?.avatarUrl ?? undefined}
                    />
                  )}
                  <div className={`max-w-[78%] sm:max-w-[65%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      role={selectionMode ? 'checkbox' : undefined}
                      aria-checked={selectionMode ? selected : undefined}
                      tabIndex={selectionMode ? 0 : undefined}
                      onClick={selectionMode ? () => toggleSelect(m.id) : undefined}
                      onKeyDown={selectionMode ? (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleSelect(m.id); } } : undefined}
                      className={`animate-msg-in rounded-2xl px-3.5 py-2 text-[14px] leading-relaxed shadow-soft ${
                        mine ? 'bg-violet text-plum' : 'card'
                      } ${replySource ? 'rounded-tl-sm' : ''} ${
                        selected ? 'ring-2 ring-violet' : ''
                      } ${selectionMode ? 'cursor-pointer select-none' : ''}`}
                    >
                      {replySource && (
                        <div className="mb-1 rounded-lg bg-black/10 px-2 py-1 text-[11px] opacity-70">
                          {replySource.senderId === 'me' ? 'You' : conversation.title.split(' ')[0]}:{' '}
                          {replySource.text.slice(0, 60)}
                        </div>
                      )}
                      {editingId === m.id ? (
                        <form onSubmit={(e) => { e.preventDefault(); void saveEdit(); }} className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            aria-label="Edit message"
                            className="min-w-0 flex-1 rounded-lg border border-campus-border bg-white px-2 py-1.5 text-[14px] outline-none focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-elev"
                          />
                          <button type="submit" aria-label="Save edit" className="touch-target flex items-center justify-center rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10">
                            <Check size={16} />
                          </button>
                          <button type="button" aria-label="Cancel edit" onClick={() => setEditingId(null)} className="touch-target flex items-center justify-center rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10">
                            <X size={16} />
                          </button>
                        </form>
                      ) : m.deletedAt ? (
                        <p className="text-[14px] italic opacity-60">This message was deleted</p>
                      ) : (
                        <>
                          {m.audio &&
                            (() => {
                              const src = photoSrc(m.photo);
                              const duration = audioDurations[m.id] ?? 0;
                              const progress = audioProgress[m.id] ?? 0;
                              const playing = playingAudioId === m.id;
                              const pct = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;
                              return (
                                <div className="mb-1 flex min-w-44 items-center gap-2 pr-1">
                                  <button
                                    onClick={() => toggleAudioPlayback(m.id, src)}
                                    aria-label={playing ? 'Pause voice message' : 'Play voice message'}
                                    className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-plum/15 transition hover:bg-plum/25 dark:bg-white/15 dark:hover:bg-white/25"
                                  >
                                    {playing ? (
                                      <Pause size={15} fill="currentColor" />
                                    ) : (
                                      <Play size={15} fill="currentColor" className="ml-0.5" />
                                    )}
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
                                      <div className="h-full rounded-full bg-current opacity-70" style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className="mt-1 text-[10px] opacity-70">
                                      Voice message{duration > 0 ? ` · ${formatDuration(duration)}` : ''}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          {!m.audio && m.photo &&
                            (() => {
                              const src = photoSrc(m.photo);
                              if (!src) {
                                return (
                                  <div className="mb-1 flex h-24 w-40 items-center justify-center rounded-xl bg-black/5 px-2 text-center text-[10px] font-semibold text-campus-text-sec dark:bg-white/10 dark:text-campus-dark-sec">
                                    {photoFailed(m.photo) ? 'Photo unavailable' : 'Loading photo…'}
                                  </div>
                                );
                              }
                              return (
                                <button onClick={() => setLightbox(src)} className="mb-1 block overflow-hidden rounded-xl" aria-label="Open photo">
                                  <img src={src} alt="Photo attachment" className="max-h-64 w-full object-cover" />
                                </button>
                              );
                            })()}
                          {!(m.photo && m.text === '📷 Photo') && (
                            <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          )}
                        </>
                      )}
                    </div>
                    <div className={`mt-0.5 flex items-center gap-1.5 px-1 text-[10px] text-campus-text-sec dark:text-campus-dark-sec ${mine ? 'flex-row-reverse' : ''}`}>
                      <span>{timeAgo(m.createdAt)}</span>
                      {m.editedAt && !m.deletedAt && <span>· edited</span>}
                      {mine && !m.deletedAt && (m.read ? <CheckCheck size={12} className="text-violet-ink" aria-label="Read" /> : <Check size={12} aria-label="Sent" />)}
                      {m.reactions && m.reactions.length > 0 && <span>{m.reactions.join('')}</span>}
                      {!m.deletedAt && !selectionMode && (
                        <>
                          {['❤️', '🔥', '😂', '🙌', '💪'].map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => void reactToMessage(id, m.id, emoji)}
                              aria-label={`React ${emoji}`}
                              className="hit-pad relative rounded p-1.5 text-[13px] leading-none opacity-50 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-white/10"
                            >
                              {emoji}
                            </button>
                          ))}
                          <button
                            onClick={() => setReplyTo(m.id)}
                            aria-label="Reply to message"
                            className="hit-pad relative rounded p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-white/10"
                          >
                            <CornerUpLeft size={13} />
                          </button>
                          <button
                            onClick={() => void copyText(m.text)}
                            aria-label="Copy message"
                            className="hit-pad relative rounded p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-white/10"
                          >
                            <Copy size={13} />
                          </button>
                          <button
                            onClick={() => setForwardFor(m.id)}
                            aria-label="Forward message"
                            className="hit-pad relative rounded p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-white/10"
                          >
                            <Forward size={13} />
                          </button>
                          <button
                            onClick={() => void toggleMessagePin(id, m.id)}
                            aria-label={isPinned ? 'Unpin message' : 'Pin message'}
                            aria-pressed={isPinned}
                            className={`hit-pad relative rounded p-1.5 transition hover:bg-black/5 focus-visible:opacity-100 dark:hover:bg-white/10 ${
                              isPinned ? 'text-violet-ink opacity-100 dark:text-violet' : 'opacity-50 hover:opacity-100'
                            }`}
                          >
                            <Pin size={13} fill={isPinned ? 'currentColor' : 'none'} />
                          </button>
                          {mine && withinEditWindow(m.createdAt) && (
                            <button
                              onClick={() => { setEditingId(m.id); setEditText(m.text); }}
                              aria-label="Edit message"
                              className="hit-pad relative rounded p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-white/10"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {mine && withinEditWindow(m.createdAt) &&
                            (confirmDeleteId === m.id ? (
                              <button
                                onClick={() => void confirmDelete(m.id)}
                                className="rounded px-1.5 py-1 text-[10px] font-bold text-coral-ink"
                              >
                                Delete?
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(m.id)}
                                aria-label="Delete message"
                                className="hit-pad relative rounded p-1.5 opacity-50 transition hover:bg-black/5 hover:opacity-100 focus-visible:opacity-100 dark:hover:bg-white/10"
                              >
                                <Trash2 size={13} />
                              </button>
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {isRealConversation && showTyping && (
              <div className="flex items-end gap-1.5" aria-live="polite">
                <Avatar seed={otherId} name={conversation.title} size={26} src={other?.avatarUrl ?? undefined} />
                <div className="card flex items-center gap-1 rounded-2xl rounded-bl-sm px-3.5 py-3 shadow-soft" aria-label={`${conversation.title} is typing`}>
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-campus-text-sec dark:bg-campus-dark-sec" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-campus-text-sec dark:bg-campus-dark-sec" style={{ animationDelay: '150ms' }} />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-campus-text-sec dark:bg-campus-dark-sec" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
        {!atBottom && (
          <button
            onClick={() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
              atBottomRef.current = true;
              setAtBottom(true);
            }}
            className="touch-target absolute bottom-24 right-3 z-10 rounded-full bg-plum px-3.5 py-2 text-[11px] font-bold text-lime shadow-lift"
          >
            ↓ Latest messages
          </button>
        )}
      </main>

      {/* Composer — keyboard-safe: fixed at the bottom of the 100dvh flex */}
      {conversation.request === 'incoming' ? (
        <div className="safe-bottom glass border-x-0 border-b-0 px-3 py-3 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          Accept the request to reply.
        </div>
      ) : awaitingAcceptance ? (
        <div className="safe-bottom glass border-x-0 border-b-0 px-3 py-3 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          Request sent — waiting for {conversation.title.split(' ')[0]} to accept.
        </div>
      ) : declined ? (
        <div className="safe-bottom glass border-x-0 border-b-0 px-3 py-3 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          This request was declined. Start a new conversation from Messages → New.
        </div>
      ) : isBlockedDirect ? (
        <div className="safe-bottom glass border-x-0 border-b-0 px-3 py-3 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
          Blocked — unblock {conversation.title.split(' ')[0]} to send messages again.
        </div>
      ) : (
        <div className="safe-bottom glass border-x-0 border-b-0 px-2 py-2 sm:px-4">
          <div className="mx-auto max-w-2xl">
            {replyTo && (
              <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-violet-soft px-3 py-1.5 text-[11px] dark:bg-violet-dark-soft">
                <CornerUpLeft size={12} className="shrink-0 text-violet-ink" />
                <span className="min-w-0 flex-1 truncate">
                  Replying to{' '}
                  <strong>
                    {conversation.messages.find((m) => m.id === replyTo)?.senderId === 'me'
                      ? 'yourself'
                      : conversation.title.split(' ')[0]}
                  </strong>
                  : {conversation.messages.find((m) => m.id === replyTo)?.text.slice(0, 40)}
                </span>
                <button onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="hit-pad relative shrink-0 rounded p-1">
                  <X size={13} />
                </button>
              </div>
            )}
            {photo && (
              <div className="relative mb-1.5 inline-flex">
                <img src={photo} alt="Attachment preview" className="h-20 w-20 rounded-xl object-cover" />
                <button
                  onClick={() => {
                    setPhoto(null);
                    setPhotoFile(null);
                  }}
                  aria-label="Remove attachment"
                  className="hit-pad absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#211B35] text-white"
                >
                  <X size={11} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-1.5">
            {recording ? (
              <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-coral-soft px-3 dark:bg-coral/10">
                <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-coral" aria-hidden="true" />
                <span className="shrink-0 font-mono text-sm font-bold text-coral-ink dark:text-coral">
                  {formatDuration(recordingSeconds)}
                </span>
                <div className="flex h-8 min-w-0 flex-1 items-center justify-center gap-[3px] overflow-hidden" aria-hidden="true">
                  {waveBars.map((height, index) => (
                    <span
                      key={index}
                      className="w-[3px] rounded-full bg-coral/70"
                      style={{ height: `${Math.max(3, Math.round((height / 255) * 26))}px` }}
                    />
                  ))}
                </div>
                <button
                  onClick={stopRecording}
                  aria-label="Stop recording"
                  className="touch-target flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-coral text-white"
                >
                  <Square size={12} fill="currentColor" />
                </button>
              </div>
            ) : recordedBlob ? (
              <div className="flex h-11 flex-1 items-center gap-2 rounded-2xl bg-campus-bg px-2 dark:bg-campus-dark-elev">
                <audio src={recordedBlob.url} controls className="h-8 min-w-0 flex-1" aria-label="Recorded voice message preview" />
                <span className="shrink-0 font-mono text-[11px] font-bold text-campus-text-sec dark:text-campus-dark-sec">
                  {formatDuration(recordedSeconds)}
                </span>
                <button
                  onClick={discardRecording}
                  aria-label="Discard recording"
                  className="touch-target flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-campus-text-sec hover:bg-black/5 dark:text-campus-dark-elev dark:hover:bg-white/10"
                >
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => void sendRecording()}
                  disabled={sending}
                  aria-label="Send voice message"
                  className="touch-target flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet text-plum"
                >
                  <Send size={16} />
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPhoto(URL.createObjectURL(f));
                      setPhotoFile(f);
                    }
                    e.target.value = '';
                  }}
                  aria-label="Attach photo"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  aria-label="Attach photo"
                  className="touch-target flex items-center justify-center rounded-2xl text-violet-ink hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
                >
                  <ImagePlus size={20} />
                </button>
                <button
                  onClick={() => void startRecording()}
                  aria-label="Record voice message"
                  className="touch-target flex items-center justify-center rounded-2xl text-violet-ink hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
                >
                  <Mic size={20} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    sendTypingPing();
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder="Message…"
                  aria-label="Message"
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-campus-border bg-campus-card px-3.5 py-2.5 text-sm outline-none transition placeholder:text-campus-text-sec focus:border-violet dark:border-campus-dark-border dark:bg-campus-dark-card dark:text-campus-dark-text dark:placeholder:text-campus-dark-sec"
                />
                <button
                  onClick={() => void send()}
                  aria-label="Send message"
                  className="touch-target flex items-center justify-center rounded-2xl bg-violet text-plum shadow-violet-glow transition active:scale-95 disabled:opacity-40"
                  disabled={sending || (!text.trim() && !photo)}
                >
                  <Send size={18} />
                </button>
              </>
            )}
            </div>
          </div>
        </div>
      )}

      {lightbox && <Lightbox photos={[lightbox]} index={0} onClose={() => setLightbox(null)} onIndex={() => undefined} />}

      {/* Forward picker — send the message to another conversation */}
      <BottomSheet
        open={forwardFor !== null || forwardSelectionOpen}
        onClose={() => { setForwardFor(null); setForwardSelectionOpen(false); }}
        title="Forward to…"
      >
        <div className="space-y-1 p-3">
          {recentConversations.length === 0 ? (
            <p className="py-6 text-center text-xs font-semibold text-campus-text-sec dark:text-campus-dark-sec">
              No other conversations yet. Start one from Messages.
            </p>
          ) : (
            recentConversations.map((c) => (
              <button
                key={c.id}
                onClick={() => void handleForwardPick(c.id)}
                className="flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition hover:bg-violet-soft dark:hover:bg-violet-dark-soft"
              >
                <Avatar seed={c.avatarSeeds[0] ?? c.id} name={c.title} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{c.title}</span>
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-campus-text-sec dark:text-campus-dark-sec">
                    {c.kind === 'direct' ? 'Direct message' : 'Group chat'}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
