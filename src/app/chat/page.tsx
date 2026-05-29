"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Settings, MessageSquare, Phone, Video,
  MoreVertical, Send, Lock, Unlock, Zap, X, Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { initiateSocketConnection, getSocket, disconnectSocket } from "@/utils/socket";
import { encryptMessage, decryptMessage, getPrivateKey } from "@/utils/crypto";

interface ChatUser {
  _id: string;
  hikeId: string;
  publicKey: string;
}

interface Message {
  _id?: string;
  senderId: string;
  receiverId: string;
  ciphertext: string;
  iv: string;
  encryptedAesKeySender: string;
  encryptedAesKeyReceiver: string;
  isNudge: boolean;
  text?: string;
  createdAt?: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ChatPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeChat, setActiveChat] = useState<ChatUser | null>(null);
  const [recentChats, setRecentChats] = useState<ChatUser[]>([]);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Vault states
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [shakeLock, setShakeLock] = useState(false);
  const [pinError, setPinError] = useState("");

  // Chat states
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [nudgeShake, setNudgeShake] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Auth & Socket setup ─────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (!token || !user) {
      router.push("/auth");
      return;
    }

    const parsedUser = JSON.parse(user);
    setCurrentUser(parsedUser);
    initiateSocketConnection(token);

    const socket = getSocket();

    socket?.on("receive_message", async (msg: Message) => {
      if (msg.isNudge) {
        setNudgeShake(true);
        try {
          const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
          audio.play();
        } catch {}
        setTimeout(() => setNudgeShake(false), 800);
        return;
      }

      try {
        const privateKey = await getPrivateKey(parsedUser.hikeId);
        if (privateKey) {
          const decryptedText = await decryptMessage(
            msg.encryptedAesKeyReceiver,
            msg.ciphertext,
            msg.iv,
            privateKey
          );
          setMessages(prev => [...prev, { ...msg, text: decryptedText }]);
        }
      } catch (err) {
        console.error("Failed to decrypt received message", err);
        setMessages(prev => [...prev, { ...msg, text: "🔒 [Could not decrypt]" }]);
      }
    });

    socket?.on("message_sent", async (msg: Message) => {
      if (msg.isNudge) return;
      try {
        const privateKey = await getPrivateKey(parsedUser.hikeId);
        if (privateKey) {
          const decryptedText = await decryptMessage(
            msg.encryptedAesKeySender,
            msg.ciphertext,
            msg.iv,
            privateKey
          );
          setMessages(prev => [...prev, { ...msg, text: decryptedText }]);
        }
      } catch (err) {
        console.error("Failed to decrypt sent message", err);
      }
    });

    return () => { disconnectSocket(); };
  }, [router]);

  // ── Auto-scroll to latest message ──────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Live User Search (debounced) ────────────────────────
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setSearchResults(data);
      } catch (err) {
        console.error("Search failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // ── Select a chat contact ───────────────────────────────
  const selectChat = useCallback((user: ChatUser) => {
    setActiveChat(user);
    setMessages([]); // Clear messages when switching chats
    setSearchQuery("");
    setSearchResults([]);
    // Add to recent chats list if not already there
    setRecentChats(prev => {
      const exists = prev.find(c => c._id === user._id);
      return exists ? prev : [user, ...prev];
    });
  }, []);

  // ── Hidden Vault toggle ─────────────────────────────────
  const handleVaultToggle = async () => {
    if (isVaultOpen) {
      setIsVaultOpen(false);
      setPinInput("");
      setPinError("");
      return;
    }

    if (!pinInput.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/users/verify-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: pinInput }),
      });

      if (res.ok) {
        setIsVaultOpen(true);
        setPinInput("");
        setPinError("");
      } else {
        setPinError("Wrong PIN");
        setShakeLock(true);
        setTimeout(() => { setShakeLock(false); setPinError(""); }, 500);
      }
    } catch {
      setPinError("Error verifying PIN");
    }
  };

  // ── Send a message (E2EE encrypted) ────────────────────
  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!messageInput.trim() || !activeChat || isSending) return;

    if (!activeChat.publicKey) {
      alert("Cannot encrypt: peer has no public key.");
      return;
    }

    const myPublicKey = currentUser?.publicKey;
    if (!myPublicKey) {
      alert("Cannot encrypt: your public key is missing. Please log out and log back in.");
      return;
    }

    setIsSending(true);
    const socket = getSocket();

    try {
      const payload = await encryptMessage(messageInput, activeChat.publicKey, myPublicKey);
      socket?.emit("send_message", {
        receiverId: activeChat._id,
        ...payload,
        isNudge: false,
      });
      setMessageInput("");
    } catch (err: any) {
      console.error("Encryption failed:", err.message);
      alert(`Encryption failed: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // ── Send Nudge ──────────────────────────────────────────
  const sendNudge = async () => {
    if (!activeChat || !currentUser?.publicKey) return;
    const socket = getSocket();
    try {
      const payload = await encryptMessage("NUDGE", activeChat.publicKey, currentUser.publicKey);
      socket?.emit("send_message", { receiverId: activeChat._id, ...payload, isNudge: true });
    } catch (err) {
      console.error("Nudge failed:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    disconnectSocket();
    router.push("/auth");
  };

  return (
    <div className="flex h-screen w-full bg-[var(--color-background)] overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────── */}
      <div className="w-80 h-full border-r border-[var(--color-border)] flex flex-col bg-[var(--color-card)] z-20">

        {/* Header */}
        <div className="p-4 border-b border-[var(--color-border)] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-foreground)]">
              ChatX
            </h1>
            <div className="flex items-center gap-2">
              {isVaultOpen && (
                <button
                  onClick={handleVaultToggle}
                  className="p-2 rounded-full text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                  title="Lock Vault"
                >
                  <Unlock className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleLogout}
                className="p-2 rounded-full text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
                title="Logout"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Hidden Vault Unlock */}
          <motion.div
            animate={shakeLock ? { x: [-6, 6, -6, 6, 0] } : {}}
            transition={{ duration: 0.3 }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Lock className="absolute left-2.5 top-2.5 w-4 h-4 text-[var(--color-muted-foreground)]" />
              <input
                type="password"
                placeholder={isVaultOpen ? "Vault open — tap 🔓 to close" : "Hidden vault PIN…"}
                disabled={isVaultOpen}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVaultToggle()}
                className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--color-muted)] text-sm text-[var(--color-foreground)] focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
              />
            </div>
            {!isVaultOpen && (
              <button
                onClick={handleVaultToggle}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {pinError ? "Retry" : "Unlock"}
              </button>
            )}
          </motion.div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--color-muted-foreground)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Hike ID or email…"
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--color-muted)] text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                className="absolute right-2.5 top-2.5 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Chat / Search list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {isSearching && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            </div>
          )}

          {/* Search Results */}
          <AnimatePresence>
            {searchResults.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-[var(--color-muted-foreground)] font-medium px-2 mb-1 uppercase tracking-wide">
                  Search Results
                </p>
                {searchResults.map((user) => (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={() => selectChat(user)}
                    className="p-3 flex items-center gap-3 rounded-xl cursor-pointer hover:bg-[var(--color-muted)] transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold">
                      {user.hikeId.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[var(--color-foreground)]">@{user.hikeId}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {user.publicKey ? "🔑 E2EE ready" : "⚠️ No public key"}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* No search results */}
          {!isSearching && searchQuery && searchResults.length === 0 && (
            <p className="text-center text-sm text-[var(--color-muted-foreground)] py-8">
              No users found for &quot;{searchQuery}&quot;
            </p>
          )}

          {/* Recent Chats */}
          {!searchQuery && (
            <>
              {recentChats.length > 0 && (
                <p className="text-xs text-[var(--color-muted-foreground)] font-medium px-2 mb-1 uppercase tracking-wide">
                  Recent
                </p>
              )}
              <AnimatePresence>
                {recentChats.map((chat) => (
                  <motion.div
                    key={chat._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => selectChat(chat)}
                    className={`p-3 flex items-center gap-3 rounded-xl cursor-pointer transition-colors ${
                      activeChat?._id === chat._id
                        ? "bg-indigo-500/10"
                        : "hover:bg-[var(--color-muted)]/50"
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {chat.hikeId.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-semibold text-sm text-[var(--color-foreground)] truncate">@{chat.hikeId}</p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">🔒 E2EE encrypted</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {recentChats.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 text-[var(--color-muted-foreground)] px-4 text-center">
                  <Search className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm font-medium">Find someone to chat with</p>
                  <p className="text-xs mt-1 opacity-70">Search by their Hike ID above</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ────────────────────────────────── */}
      <motion.div
        animate={nudgeShake ? { x: [-15, 15, -15, 15, -8, 8, -4, 4, 0] } : {}}
        transition={{ duration: 0.5 }}
        className="flex-1 flex flex-col relative"
        style={{ background: "linear-gradient(135deg, var(--color-background), var(--color-muted))" }}
      >
        {activeChat ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-[var(--color-border)] flex items-center justify-between px-6 bg-[var(--color-card)]/80 backdrop-blur-md z-10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                  {activeChat.hikeId.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-semibold text-[var(--color-foreground)]">@{activeChat.hikeId}</h2>
                  <p className="text-xs text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    End-to-End Encrypted
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-[var(--color-muted-foreground)]">
                <button className="hover:text-indigo-500 transition-colors"><Phone className="w-5 h-5" /></button>
                <button className="hover:text-indigo-500 transition-colors"><Video className="w-5 h-5" /></button>
                <button className="hover:text-indigo-500 transition-colors"><MoreVertical className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
              {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-muted-foreground)] opacity-50">
                  <Lock className="w-10 h-10 mb-2" />
                  <p className="text-sm">Messages are end-to-end encrypted</p>
                  <p className="text-xs mt-1">Say hi to @{activeChat.hikeId}!</p>
                </div>
              )}
              <AnimatePresence>
                {messages.map((msg, idx) => {
                  if (msg.isNudge) return null;
                  const isMine = msg.senderId === currentUser?.id || msg.senderId === currentUser?._id;
                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 16, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", bounce: 0.35, duration: 0.4 }}
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm ${
                        isMine
                          ? "self-end bg-indigo-600 text-white rounded-tr-sm"
                          : "self-start bg-[var(--color-card)] text-[var(--color-foreground)] rounded-tl-sm border border-[var(--color-border)]"
                      }`}
                    >
                      <p className="text-sm break-words leading-relaxed">{msg.text}</p>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={sendMessage}
              className="p-4 bg-[var(--color-card)]/80 backdrop-blur-md border-t border-[var(--color-border)]"
            >
              <div className="flex items-center gap-2 max-w-4xl mx-auto">
                {/* Nudge Button */}
                <motion.button
                  type="button"
                  onClick={sendNudge}
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.88 }}
                  className="p-3 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-full transition-all flex-shrink-0"
                  title="Send a Nudge! ⚡"
                >
                  <Zap className="w-5 h-5" />
                </motion.button>

                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type a secure message…"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={isSending}
                    className="w-full pl-4 pr-12 py-3 rounded-full bg-[var(--color-muted)] text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !messageInput.trim()}
                    className="absolute right-1.5 top-1.5 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-full transition-colors"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                  </button>
                </div>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-[var(--color-muted-foreground)]">
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <MessageSquare className="w-20 h-20 opacity-10 mb-4" />
            </motion.div>
            <p className="text-lg font-semibold opacity-40">Welcome to ChatX</p>
            <p className="text-sm opacity-30 mt-1">Search for a user to start a secure conversation</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
