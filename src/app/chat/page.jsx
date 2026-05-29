"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Settings, MessageSquare, Phone, Video,
  MoreVertical, Send, Lock, Unlock, Zap, X, Loader2, LogOut, Copy, Check
} from "lucide-react";
import { useRouter } from "next/navigation";
import { initiateSocketConnection, getSocket, disconnectSocket } from "@/utils/socket";
import { encryptMessage, decryptMessage, getPrivateKey, generateE2EEKeys, storePrivateKey, encryptPrivateKeyWithPassword } from "@/utils/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ChatPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [recentChats, setRecentChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const allUsersRef = useRef([]);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Vault states
  const [isVaultOpen, setIsVaultOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [shakeLock, setShakeLock] = useState(false);
  const [pinError, setPinError] = useState("");

  // Chat states
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [nudgeShake, setNudgeShake] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Settings modal states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [pinMessage, setPinMessage] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [hasPrivateKey, setHasPrivateKey] = useState(true);

  const messagesEndRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Fetch all users and recent chats from backend
  const fetchUsers = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const [allRes, recentRes] = await Promise.all([
        fetch(`${API_URL}/api/users/all`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/users/recent`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      ]);

      if (allRes.ok) {
        const allData = await allRes.json();
        setAllUsers(allData);
      }

      if (recentRes.ok) {
        const recentData = await recentRes.json();
        setRecentChats(recentData);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    }
  }, []);

  // Update allUsersRef to prevent stale closures in socket events
  useEffect(() => {
    allUsersRef.current = allUsers;
  }, [allUsers]);

  // Fetch message history with selected contact and decrypt it
  const fetchHistory = useCallback(async (peer, parsedUser) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await fetch(`${API_URL}/api/users/history/${peer._id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch history");
      const historyMessages = await res.json();

      const privateKey = await getPrivateKey(parsedUser.hikeId);
      if (!privateKey) {
        setMessages(historyMessages.map(msg => ({ ...msg, text: "🔒 [Private key missing]" })));
        return;
      }

      const decrypted = await Promise.all(
        historyMessages.map(async (msg) => {
          if (msg.isNudge) return { ...msg, text: "⚡ Sent a Nudge!" };
          const isMine = msg.senderId === parsedUser.id || msg.senderId === parsedUser._id;
          const keyToUse = isMine ? msg.encryptedAesKeySender : msg.encryptedAesKeyReceiver;

          try {
            const decryptedText = await decryptMessage(
              keyToUse,
              msg.ciphertext,
              msg.iv,
              privateKey
            );
            return { ...msg, text: decryptedText };
          } catch (err) {
            console.error("Failed to decrypt history message", err);
            return { ...msg, text: "🔒 [Could not decrypt]" };
          }
        })
      );

      setMessages(decrypted);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  }, []);

  // Check if private key exists in IndexedDB
  const checkPrivateKey = useCallback(async (hikeId) => {
    try {
      const key = await getPrivateKey(hikeId);
      setHasPrivateKey(!!key);
    } catch {
      setHasPrivateKey(false);
    }
  }, []);

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
    checkPrivateKey(parsedUser.hikeId);
    fetchUsers();
    initiateSocketConnection(token);

    const socket = getSocket();

    socket?.on("receive_message", async (msg) => {
      // Find the user details in allUsers
      const contactId = msg.senderId === parsedUser.id || msg.senderId === parsedUser._id ? msg.receiverId : msg.senderId;
      let contactUser = allUsersRef.current.find(u => u._id === contactId);
      if (!contactUser) {
        await fetchUsers();
        contactUser = allUsersRef.current.find(u => u._id === contactId);
      }
      if (contactUser) {
        setRecentChats(prev => {
          const filtered = prev.filter(c => c._id !== contactId);
          return [contactUser, ...filtered];
        });
      }

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

    socket?.on("message_sent", async (msg) => {
      // Move contact to top of recent list
      const contactId = msg.senderId === parsedUser.id || msg.senderId === parsedUser._id ? msg.receiverId : msg.senderId;
      let contactUser = allUsersRef.current.find(u => u._id === contactId);
      if (!contactUser) {
        await fetchUsers();
        contactUser = allUsersRef.current.find(u => u._id === contactId);
      }
      if (contactUser) {
        setRecentChats(prev => {
          const filtered = prev.filter(c => c._id !== contactId);
          return [contactUser, ...filtered];
        });
      }

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
  }, [router, fetchUsers, checkPrivateKey]);

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
  const selectChat = useCallback((user) => {
    setActiveChat(user);
    setSearchQuery("");
    setSearchResults([]);
    
    // Add to recent chats list if not already there (appended to end to preserve sorting until message is sent)
    setRecentChats(prev => {
      const exists = prev.find(c => c._id === user._id);
      return exists ? prev : [...prev, user];
    });

    if (currentUser) {
      fetchHistory(user, currentUser);
    }
  }, [currentUser, fetchHistory]);

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
  const sendMessage = async (e) => {
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
    } catch (err) {
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

  const copyToClipboard = () => {
    if (!currentUser?.publicKey) return;
    navigator.clipboard.writeText(currentUser.publicKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleSetPin = async (e) => {
    e.preventDefault();
    if (!newPin.trim()) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/auth/set-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin: newPin }),
      });

      const data = res.ok ? await res.json() : null;
      if (res.ok) {
        setPinSuccess(true);
        setPinMessage("Hidden vault PIN updated successfully!");
        setNewPin("");
        setTimeout(() => {
          setPinMessage("");
          setPinSuccess(false);
        }, 3000);
      } else {
        const errMsg = data?.error || "Failed to update PIN";
        setPinSuccess(false);
        setPinMessage(errMsg);
      }
    } catch {
      setPinSuccess(false);
      setPinMessage("Error updating PIN");
    }
  };

  const handleRegenerateKeys = async () => {
    if (!currentUser?.hikeId) return;
    const confirmRegen = confirm(
      "Warning: Regenerating your E2EE keys will update your public key on the server. You will be able to decrypt all FUTURE messages, but any PAST messages encrypted with your old key will remain locked. Do you want to proceed?"
    );
    if (!confirmRegen) return;

    const password = prompt("Please enter your ChatX account password to securely back up your new private key on the server:");
    if (!password) {
      alert("Password is required to regenerate keys securely.");
      return;
    }

    try {
      const keys = await generateE2EEKeys();
      const token = localStorage.getItem("token");
      const encryptedBackup = await encryptPrivateKeyWithPassword(keys.privateKey, password);

      const res = await fetch(`${API_URL}/api/users/update-public-key`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          publicKey: keys.publicKeyBase64,
          encryptedPrivateKey: encryptedBackup
        }),
      });

      if (res.ok) {
        // Save the new private key to IndexedDB
        await storePrivateKey(currentUser.hikeId, keys.privateKey);
        
        // Update currentUser state in localStorage and reactively
        const updatedUser = { 
          ...currentUser, 
          publicKey: keys.publicKeyBase64,
          encryptedPrivateKey: encryptedBackup
        };
        setCurrentUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        
        setHasPrivateKey(true);
        alert("E2EE Keys successfully regenerated and securely backed up to the server! Your future conversations are fully secure.");
      } else {
        alert("Failed to update keys on server.");
      }
    } catch (err) {
      console.error("Regeneration failed", err);
      alert("Failed to regenerate keys.");
    }
  };

  // Unified user list sorted like WhatsApp: recent conversation partners at the top, others below
  const sortedUnifiedUsers = React.useMemo(() => {
    const recentIds = recentChats.map(c => c._id);
    
    // Users with active conversations (ordered by recency)
    const activeChats = recentChats;

    // Other users who don't have conversations yet
    const otherUsers = allUsers.filter(user => !recentIds.includes(user._id));

    return [...activeChats, ...otherUsers];
  }, [allUsers, recentChats]);

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
                onClick={() => {
                  if (currentUser) checkPrivateKey(currentUser.hikeId);
                  setIsSettingsOpen(true);
                }}
                className="p-2 rounded-full text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-muted)] transition-colors"
                title="Settings"
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

          {/* Unified WhatsApp-style user list */}
          {!searchQuery && (
            <div className="space-y-1">
              {sortedUnifiedUsers.length > 0 ? (
                <AnimatePresence>
                  {sortedUnifiedUsers.map((user) => {
                    const hasConversation = recentChats.some(rc => rc._id === user._id);
                    const isActive = activeChat?._id === user._id;

                    return (
                      <motion.div
                        key={user._id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => selectChat(user)}
                        className={`p-3 flex items-center gap-3 rounded-xl cursor-pointer transition-colors ${
                          isActive
                            ? "bg-indigo-500/10"
                            : "hover:bg-[var(--color-muted)]/50"
                        }`}
                      >
                        <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${
                          hasConversation 
                            ? "from-indigo-400 to-purple-500" 
                            : "from-emerald-400 to-teal-500"
                        } flex items-center justify-center text-white font-bold text-lg`}>
                          {user.hikeId.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="font-semibold text-sm text-[var(--color-foreground)] truncate">@{user.hikeId}</p>
                          <p className="text-xs text-[var(--color-muted-foreground)]">
                            {hasConversation ? "🔒 E2EE encrypted" : "🔑 Click to start chat"}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-[var(--color-muted-foreground)] px-4 text-center">
                  <Search className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm font-medium">Explore & chat with users</p>
                  <p className="text-xs mt-1 opacity-70">No other users signed up yet</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile & Logout Bottom Bar */}
        <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-muted)]/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              {currentUser?.hikeId?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-[var(--color-foreground)] truncate">
                {currentUser?.hikeId ? `@${currentUser.hikeId}` : "User"}
              </span>
              <span className="text-xs text-[var(--color-muted-foreground)] truncate">
                {currentUser?.email || ""}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-rose-500 hover:text-white hover:bg-rose-500/20 active:bg-rose-500/30 transition-all flex-shrink-0"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
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

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-muted)]/20">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-bold text-lg text-[var(--color-foreground)]">Settings</h3>
                </div>
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setPinMessage("");
                    setNewPin("");
                  }}
                  className="p-1.5 rounded-full hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 space-y-6 overflow-y-auto max-h-[70vh]">
                {/* Profile Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                    Profile Information
                  </h4>
                  <div className="bg-[var(--color-muted)]/40 border border-[var(--color-border)] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                        {currentUser?.hikeId?.charAt(0).toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-bold text-base text-[var(--color-foreground)]">
                          @{currentUser?.hikeId || "unknown"}
                        </p>
                        <p className="text-sm text-[var(--color-muted-foreground)]">
                          {currentUser?.email || "unknown"}
                        </p>
                      </div>
                    </div>

                    {/* Public Key Display */}
                    {currentUser?.publicKey && (
                      <div className="pt-2 border-t border-[var(--color-border)] space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-[var(--color-muted-foreground)]">
                            E2EE Public Key
                          </span>
                          <button
                            onClick={copyToClipboard}
                            className="text-xs text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-1 transition-colors"
                          >
                            {copiedKey ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" /> Copy Key
                              </>
                            )}
                          </button>
                        </div>
                        <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg p-2 font-mono text-[10px] break-all max-h-20 overflow-y-auto text-[var(--color-muted-foreground)] select-all leading-tight">
                          {currentUser.publicKey}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vault PIN Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                      Hidden Vault Security
                    </h4>
                  </div>
                  
                  <form onSubmit={handleSetPin} className="space-y-3">
                    <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">
                      Set or update your 4-digit PIN. This PIN is used to encrypt and lock/unlock your hidden conversational vault from the sidebar.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="Enter 4-digit PIN"
                        value={newPin}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, "");
                          setNewPin(val);
                        }}
                        className="flex-1 px-3 py-2 rounded-xl bg-[var(--color-muted)] text-[var(--color-foreground)] border border-[var(--color-border)] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={newPin.length !== 4}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                      >
                        Update PIN
                      </button>
                    </div>
                    {pinMessage && (
                      <p className={`text-xs font-medium ${pinSuccess ? "text-emerald-500" : "text-rose-500"}`}>
                        {pinMessage}
                      </p>
                    )}
                  </form>
                </div>

                {/* E2EE Key Management Section */}
                <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
                  <div className="flex items-center gap-2">
                    <Unlock className="w-4 h-4 text-amber-500" />
                    <h4 className="text-xs font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">
                      End-to-End Encryption Keys
                    </h4>
                  </div>
                  
                  <div className="space-y-3">
                    {!hasPrivateKey ? (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                        <p className="text-xs text-amber-400 font-semibold leading-relaxed flex items-center gap-1.5">
                          ⚠️ Private key missing from this browser!
                        </p>
                        <p className="text-[11px] text-[var(--color-muted-foreground)] leading-normal">
                          You won't be able to decrypt past or future messages on this browser unless you regenerate your encryption keys or restore from a password-protected backup.
                        </p>
                        <button
                          onClick={handleRegenerateKeys}
                          className="w-full px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors animate-pulse"
                        >
                          Regenerate E2EE Keys
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2">
                        <p className="text-xs text-emerald-500 font-semibold leading-relaxed flex items-center gap-1.5">
                          ✓ Secure E2EE Key Active
                        </p>
                        <p className="text-[11px] text-[var(--color-muted-foreground)] leading-normal">
                          Your private key is securely stored in this browser's IndexedDB. If you are having issues decrypting messages or logged in on a new device, you can reset your key pair below.
                        </p>
                        <button
                          onClick={handleRegenerateKeys}
                          className="w-full px-3 py-1.5 border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-medium transition-colors"
                        >
                          Regenerate E2EE Keys
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-[var(--color-border)] bg-[var(--color-muted)]/10 flex justify-end">
                <button
                  onClick={() => {
                    setIsSettingsOpen(false);
                    setPinMessage("");
                    setNewPin("");
                  }}
                  className="px-4 py-2 bg-[var(--color-muted)] hover:bg-[var(--color-muted)]/80 text-[var(--color-foreground)] rounded-xl text-sm font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
