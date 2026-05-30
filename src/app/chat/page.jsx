"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Settings, MessageSquare, Phone, Video,
  MoreVertical, Send, Lock, Unlock, Zap, X, Loader2, LogOut, Copy, Check
} from "lucide-react";
import { useRouter } from "next/navigation";
import { initiateSocketConnection, getSocket, disconnectSocket } from "@/utils/socket";
import { encryptMessage, decryptMessage, getPrivateKey, generateE2EEKeys, storePrivateKey, encryptPrivateKeyWithPassword, verifyKeyPair } from "@/utils/crypto";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const getCleanId = (val) => {
  if (!val) return "";
  if (typeof val === "string") return val.trim().toLowerCase();
  if (typeof val === "object") {
    const rawVal = val._id || val.id || val;
    return (rawVal ? rawVal.toString() : "").trim().toLowerCase();
  }
  return val.toString().trim().toLowerCase();
};

const isSameId = (id1, id2) => {
  return getCleanId(id1) === getCleanId(id2);
};

export default function ChatPage() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window !== "undefined") {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    }
    return null;
  });
  const [activeChat, setActiveChat] = useState(null);
  const [recentChats, setRecentChats] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const allUsersRef = useRef([]);

  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [decryptedLastMessages, setDecryptedLastMessages] = useState({});

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setMounted(true);
    }, 0);
  }, []);

  const messagesEndRef = useRef(null);

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
        setMessages(historyMessages.map(msg => ({ ...msg, text: "🔒 [Private key missing on this browser]" })));
        return;
      }

      const isKeyValid = parsedUser.publicKey ? await verifyKeyPair(parsedUser.publicKey, privateKey) : true;
      if (!isKeyValid) {
        setMessages(historyMessages.map(msg => ({ ...msg, text: "🔒 [E2EE key mismatch - please restore or regenerate keys]" })));
        return;
      }

      const decrypted = await Promise.all(
        historyMessages.map(async (msg) => {
          if (msg.isNudge) return { ...msg, text: "⚡ Sent a Nudge!" };
          const isMine = isSameId(msg.senderId, parsedUser);
          const primaryKey = isMine ? msg.encryptedAesKeySender : msg.encryptedAesKeyReceiver;
          const fallbackKey = isMine ? msg.encryptedAesKeyReceiver : msg.encryptedAesKeySender;

          try {
            const decryptedText = await decryptMessage(
              primaryKey,
              msg.ciphertext,
              msg.iv,
              privateKey
            );
            return { ...msg, text: decryptedText };
          } catch (err) {
            // Robust dual-key fallback to prevent E2EE ID mismatch OperationErrors
            try {
              const decryptedText = await decryptMessage(
                fallbackKey,
                msg.ciphertext,
                msg.iv,
                privateKey
              );
              return { ...msg, text: decryptedText };
            } catch (fallbackErr) {
              console.error("Failed to decrypt history message with both keys", { err, fallbackErr });
              return { ...msg, text: "🔒 [Could not decrypt]" };
            }
          }
        })
      );

      setMessages(decrypted);
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  }, []);

  // Check if private key exists in IndexedDB and matches our public key
  const checkPrivateKey = useCallback(async (hikeId, serverPublicKey) => {
    try {
      const key = await getPrivateKey(hikeId);
      if (!key) {
        setHasPrivateKey(false);
        return;
      }
      if (serverPublicKey) {
        const matches = await verifyKeyPair(serverPublicKey, key);
        setHasPrivateKey(matches);
      } else {
        setHasPrivateKey(true);
      }
    } catch {
      setHasPrivateKey(false);
    }
  }, []);
  // Format message time like WhatsApp
  const formatMessageTime = useCallback((dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1 || (diffDays === 2 && now.getDate() !== date.getDate())) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "long" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  }, []);

  // Decrypt all recent chats' last messages asynchronously
  useEffect(() => {
    const decryptAll = async () => {
      if (!currentUser?.hikeId || recentChats.length === 0) return;
      const privateKey = await getPrivateKey(currentUser.hikeId);
      if (!privateKey) return;

      for (const chat of recentChats) {
        const msg = chat.latestMessage;
        if (!msg) continue;

        let alreadyDecrypted = false;
        setDecryptedLastMessages(prev => {
          if (prev[chat._id] && prev[chat._id].msgId === msg._id) {
            alreadyDecrypted = true;
          }
          return prev;
        });

        if (alreadyDecrypted) continue;

        if (msg.isNudge) {
          setDecryptedLastMessages(prev => ({
            ...prev,
            [chat._id]: { text: "⚡ Sent a Nudge!", msgId: msg._id }
          }));
          continue;
        }

        const isMine = isSameId(msg.senderId, currentUser);
        const primaryKey = isMine ? msg.encryptedAesKeySender : msg.encryptedAesKeyReceiver;
        const fallbackKey = isMine ? msg.encryptedAesKeyReceiver : msg.encryptedAesKeySender;

        try {
          const decText = await decryptMessage(primaryKey, msg.ciphertext, msg.iv, privateKey);
          setDecryptedLastMessages(prev => ({
            ...prev,
            [chat._id]: { text: decText, msgId: msg._id }
          }));
        } catch {
          // Robust dual-key fallback to prevent E2EE ID mismatch OperationErrors in sidebar
          try {
            const decText = await decryptMessage(fallbackKey, msg.ciphertext, msg.iv, privateKey);
            setDecryptedLastMessages(prev => ({
              ...prev,
              [chat._id]: { text: decText, msgId: msg._id }
            }));
          } catch {
            setDecryptedLastMessages(prev => ({
              ...prev,
              [chat._id]: { text: "🔒 [Could not decrypt]", msgId: msg._id }
            }));
          }
        }
      }
    };

    decryptAll();
  }, [recentChats, currentUser]);

  // ── Auth & Socket setup ─────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    if (!token || !user) {
      router.push("/auth");
      return;
    }

    const parsedUser = JSON.parse(user);
    
    // Fetch latest user profile from backend to ensure we have the correct, fresh publicKey
    fetch(`${API_URL}/api/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(async (dbUser) => {
        const activeUser = dbUser || parsedUser;
        if (dbUser) {
          setCurrentUser(dbUser);
          localStorage.setItem("user", JSON.stringify(dbUser));
        }

        const key = await getPrivateKey(activeUser.hikeId);
        if (!key) {
          setHasPrivateKey(false);
          return;
        }
        if (activeUser.publicKey) {
          const matches = await verifyKeyPair(activeUser.publicKey, key);
          setHasPrivateKey(matches);
        } else {
          setHasPrivateKey(true);
        }
      })
      .catch(() => {
        getPrivateKey(parsedUser.hikeId)
          .then(async (key) => {
            if (!key) {
              setHasPrivateKey(false);
              return;
            }
            if (parsedUser.publicKey) {
              const matches = await verifyKeyPair(parsedUser.publicKey, key);
              setHasPrivateKey(matches);
            } else {
              setHasPrivateKey(true);
            }
          })
          .catch(() => setHasPrivateKey(false));
      });
    setTimeout(() => {
      fetchUsers();
    }, 0);
    initiateSocketConnection(token);

    const socket = getSocket();

    socket?.on("receive_message", async (msg) => {
      // Find the user details in allUsers
      const contactId = isSameId(msg.senderId, parsedUser) ? msg.receiverId : msg.senderId;
      let contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
      if (!contactUser) {
        await fetchUsers();
        contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
      }
      if (contactUser) {
        setRecentChats(prev => {
          const filtered = prev.filter(c => !isSameId(c._id, contactId));
          const updatedContact = {
            ...contactUser,
            latestMessage: msg
          };
          return [updatedContact, ...filtered];
        });
      }

      if (msg.isNudge) {
        setNudgeShake(true);
        try {
          // const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
          const audio = new Audio("../../media/bell-notification.wav");
          audio.play();
        } catch {}
        setTimeout(() => setNudgeShake(false), 800);
        return;
      }

      try {
        const privateKey = await getPrivateKey(parsedUser.hikeId);
        if (privateKey) {
          let decryptedText;
          try {
            decryptedText = await decryptMessage(
              msg.encryptedAesKeyReceiver,
              msg.ciphertext,
              msg.iv,
              privateKey
            );
          } catch {
            decryptedText = await decryptMessage(
              msg.encryptedAesKeySender,
              msg.ciphertext,
              msg.iv,
              privateKey
            );
          }
          setMessages(prev => [...prev, { ...msg, text: decryptedText }]);
        }
      } catch (err) {
        console.error("Failed to decrypt received message with both keys", err);
        setMessages(prev => [...prev, { ...msg, text: "🔒 [Could not decrypt]" }]);
      }
    });

    socket?.on("message_sent", async (msg) => {
      // Move contact to top of recent list
      const contactId = isSameId(msg.senderId, parsedUser) ? msg.receiverId : msg.senderId;
      let contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
      if (!contactUser) {
        await fetchUsers();
        contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
      }
      if (contactUser) {
        setRecentChats(prev => {
          const filtered = prev.filter(c => !isSameId(c._id, contactId));
          const updatedContact = {
            ...contactUser,
            latestMessage: msg
          };
          return [updatedContact, ...filtered];
        });
      }

      if (msg.isNudge) return;
      try {
        const privateKey = await getPrivateKey(parsedUser.hikeId);
        if (privateKey) {
          let decryptedText;
          try {
            decryptedText = await decryptMessage(
              msg.encryptedAesKeySender,
              msg.ciphertext,
              msg.iv,
              privateKey
            );
          } catch {
            decryptedText = await decryptMessage(
              msg.encryptedAesKeyReceiver,
              msg.ciphertext,
              msg.iv,
              privateKey
            );
          }
          setMessages(prev => [...prev, { ...msg, text: decryptedText }]);
        }
      } catch (err) {
        console.error("Failed to decrypt sent message with both keys", err);
      }
    });

    return () => { disconnectSocket(); };
  }, [router, fetchUsers, checkPrivateKey]);

  // ── Auto-scroll to latest message ──────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Debounce Search Query ──────────────────────────────
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // ── Select a chat contact ───────────────────────────────
  const selectChat = useCallback((user) => {
    setSearchQuery("");
    
    // Add to recent chats list if not already there (appended to end to preserve sorting until message is sent)
    setRecentChats(prev => {
      const exists = prev.find(c => isSameId(c._id, user._id));
      return exists ? prev : [...prev, user];
    });

    fetchUsers().then(() => {
      const latestPeer = allUsersRef.current.find(u => isSameId(u._id, user._id)) || user;
      setActiveChat(latestPeer);
      if (currentUser) {
        fetchHistory(latestPeer, currentUser);
      }
    });
  }, [currentUser, fetchHistory, fetchUsers]);

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

  const handleRestorePrivateKey = async () => {
    if (!currentUser?.hikeId) return;
    const password = prompt(
      "Please enter your ChatX account password to restore your secure E2EE private key from the server backup:"
    );
    if (!password) return;

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch user backup profile");
      const meData = await res.json();

      if (!meData.encryptedPrivateKey) {
        alert("No private key backup found on the server. Please regenerate your E2EE keys in Settings.");
        return;
      }

      const decryptedKey = await decryptPrivateKeyWithPassword(meData.encryptedPrivateKey, password);
      await storePrivateKey(currentUser.hikeId, decryptedKey);
      
      setHasPrivateKey(true);
      alert("E2EE Private Key successfully restored! All your messages will now be decrypted.");
      
      // Refresh current chat history to decrypt it instantly
      if (activeChat) {
        fetchHistory(activeChat, currentUser);
      }
      
      // Refresh user lists to decrypt sidebar last messages
      fetchUsers();
    } catch (err) {
      console.error("Failed to restore private key:", err);
      alert("Restoration failed: Please check if your password is correct.");
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

  // Filter unified users based on the debounced search query
  const filteredUsers = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return sortedUnifiedUsers;
    }
    const query = debouncedSearchQuery.toLowerCase().replace(/^@/, '');
    return sortedUnifiedUsers.filter(user => 
      user.hikeId.toLowerCase().includes(query) || 
      (user.email && user.email.toLowerCase().includes(query))
    );
  }, [sortedUnifiedUsers, debouncedSearchQuery]);

  if (!mounted) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[var(--color-background)]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

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
                  if (currentUser) checkPrivateKey(currentUser.hikeId, currentUser.publicKey);
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearching(true);
              }}
              placeholder="Search by Hike ID or email…"
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--color-muted)] text-[var(--color-foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(""); setDebouncedSearchQuery(""); setIsSearching(false); }}
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

          {/* Unified WhatsApp-style user list with client-side debounced search */}
          <div className="space-y-1">
            {filteredUsers.length > 0 ? (
              <AnimatePresence>
                {filteredUsers.map((user) => {
                  const latestMsg = user.latestMessage;
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
                      className={`p-3 flex items-center gap-3 rounded-xl cursor-pointer transition-all ${
                        isActive
                          ? "bg-indigo-500/15 border-l-4 border-indigo-600 pl-2"
                          : "hover:bg-[var(--color-muted)]/50"
                      }`}
                    >
                      {/* Dynamic DiceBear Profile Avatar */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.hikeId}&radius=50&backgroundType=gradientLinear`}
                        alt={user.hikeId}
                        className="w-11 h-11 rounded-full object-cover border border-[var(--color-border)] shadow-sm flex-shrink-0"
                      />
                      
                      {/* User Info & Last Message */}
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex justify-between items-baseline mb-0.5">
                          <p className="font-semibold text-sm text-[var(--color-foreground)] truncate">
                            @{user.hikeId}
                          </p>
                          {latestMsg && (
                            <span className="text-[10px] text-[var(--color-muted-foreground)] flex-shrink-0 font-medium ml-1">
                              {formatMessageTime(latestMsg.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[var(--color-muted-foreground)] truncate pr-2">
                          {latestMsg ? (
                            decryptedLastMessages[user._id]?.text || "🔒 [Decrypting...]"
                          ) : (
                            "No messages yet. Say hi! 👋"
                          )}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-[var(--color-muted-foreground)] px-4 text-center">
                <Search className="w-10 h-10 opacity-20 mb-3" />
                {searchQuery ? (
                  <>
                    <p className="text-sm font-medium">No users found</p>
                    <p className="text-xs mt-1 opacity-70">No matching user details for &quot;{searchQuery}&quot;</p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">Explore & chat with users</p>
                    <p className="text-xs mt-1 opacity-70">No other users signed up yet</p>
                  </>
                )}
              </div>
            )}
          </div>
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

            {/* E2EE Key Restoration Warning Banner */}
            {!hasPrivateKey && (
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-2.5 flex items-center justify-between gap-4 backdrop-blur-sm z-10">
                <div className="flex items-center gap-2 text-amber-500 text-xs font-medium">
                  <span>⚠️ Secure E2EE private key is missing on this browser. Messages are locked.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRestorePrivateKey}
                    className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-[11px] font-semibold transition-colors shadow-sm"
                  >
                    Restore with Password
                  </button>
                  <button
                    onClick={() => setIsSettingsOpen(true)}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-[11px] font-semibold transition-colors shadow-sm"
                  >
                    Regenerate Keys
                  </button>
                </div>
              </div>
            )}

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
                  const isMine = isSameId(msg.senderId, currentUser);
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
                          You won&apos;t be able to decrypt past or future messages on this browser unless you regenerate your encryption keys or restore from a password-protected backup.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={handleRestorePrivateKey}
                            className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Restore from Backup
                          </button>
                          <button
                            onClick={handleRegenerateKeys}
                            className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Regenerate Keys
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2">
                        <p className="text-xs text-emerald-500 font-semibold leading-relaxed flex items-center gap-1.5">
                          ✓ Secure E2EE Key Active
                        </p>
                        <p className="text-[11px] text-[var(--color-muted-foreground)] leading-normal">
                          Your private key is securely stored in this browser&apos;s IndexedDB. If you are having issues decrypting messages or logged in on a new device, you can reset your key pair below.
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
