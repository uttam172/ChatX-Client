"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, Settings, MessageSquare, Phone, Video,
    MoreVertical, Send, Lock, Unlock, Zap, X, Loader2, LogOut, Copy, Check,
    Trash, ShieldCheck, Smile, CornerUpLeft, Paperclip, FileText, Music, Download,
    ChevronLeft, AlignStartVertical, AlignEndVertical, Pencil
} from "lucide-react";
import { useRouter } from "next/navigation";
import { initiateSocketConnection, getSocket, disconnectSocket } from "@/utils/socket";
import { encryptMessage, decryptMessage, getPrivateKey, generateE2EEKeys, storePrivateKey, encryptPrivateKeyWithPassword, verifyKeyPair } from "@/utils/crypto";
import Image from "next/image";
import { logo } from "@/assets/logo";

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

const getEmojiOnlyCount = (str) => {
    if (!str) return 0;
    const cleanStr = str.trim();
    if (!cleanStr) return 0;

    // Use Intl.Segmenter to accurately segment visual characters (handles skins, compound, ZWJs)
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        try {
            const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
            const segments = [...segmenter.segment(cleanStr)];
            
            let count = 0;
            for (const segment of segments) {
                const char = segment.segment.trim();
                if (!char) continue; // Allow/ignore whitespace between emojis
                
                // Match visual emoji character
                const isEmoji = /\p{Extended_Pictographic}/u.test(char) || 
                                /^\p{Emoji_Presentation}$/u.test(char) ||
                                /^[\u2600-\u27BF]$/u.test(char);
                                
                if (!isEmoji) return 0; // Contains non-emoji character
                count++;
            }
            return count;
        } catch (e) {
            console.warn("Intl.Segmenter error, falling back to regex: ", e);
        }
    }

    // Fallback regex if Intl.Segmenter is not supported or errors
    const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/gu;
    const matches = cleanStr.match(emojiRegex);
    if (!matches) return 0;

    // Remove all matched emojis, variation selectors, and spaces
    const nonEmoji = cleanStr
        .replace(emojiRegex, '')
        .replace(/[\uFE0F\u200D\u200B\uFE0E]/g, '')
        .replace(/\s/g, '');

    if (nonEmoji.length > 0) return 0; // Contains non-emoji characters

    return matches.length;
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
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
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
    const [firstUnreadMessageId, setFirstUnreadMessageId] = useState(null);

    // More options dropdown & modal states
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isE2EEInfoOpen, setIsE2EEInfoOpen] = useState(false);
    const [chatSettings, setChatSettings] = useState([]);

    // Calling overlay states
    const [callStatus, setCallStatus] = useState("disconnected"); // "disconnected" | "calling" | "connected"
    const [callType, setCallType] = useState("voice"); // "voice" | "video"
    const [callTimer, setCallTimer] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(true);

    const callingAudioRef = useRef(null);

    // Media Sharing states
    const fileInputRef = useRef(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState("");
    const [activeLightboxImage, setActiveLightboxImage] = useState(null);
    const [pendingFile, setPendingFile] = useState(null);
    const [pendingFilePreview, setPendingFilePreview] = useState(null);

    // Reply and Reaction states
    const [replyingToMessage, setReplyingToMessage] = useState(null);
    const [editingMessage, setEditingMessage] = useState(null);
    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [hoveredMessageId, setHoveredMessageId] = useState(null);
    const [activeMessageReactionId, setActiveMessageReactionId] = useState(null);
    const [expandedMessageReactionId, setExpandedMessageReactionId] = useState(null);
    const [activeReactionTab, setActiveReactionTab] = useState("smileys");

    const hoverTimeoutRef = useRef(null);

    const handleMessageMouseEnter = useCallback((messageId) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setHoveredMessageId(messageId);
    }, []);

    const handleMessageMouseLeave = useCallback((messageId) => {
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
        }
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredMessageId(currentId => {
                if (currentId === messageId) {
                    setActiveMessageReactionId(null);
                    return null;
                }
                return currentId;
            });
        }, 350);
    }, []);

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
    const activeChatRef = useRef(null);
    const messageInputRef = useRef(null);

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

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
                setRecentChats(recentData.map(c => {
                    if (activeChatRef.current && isSameId(c._id, activeChatRef.current)) {
                        return { ...c, unreadCount: 0 };
                    }
                    return c;
                }));
            }
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    }, []);

    // Update allUsersRef to prevent stale closures in socket events
    useEffect(() => {
        allUsersRef.current = allUsers;
    }, [allUsers]);

    // Fetch chat hidden settings
    const fetchChatSettings = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;
            const res = await fetch(API_URL + "/api/users/chat-settings", {
                headers: { Authorization: "Bearer " + token }
            });
            if (res.ok) {
                const data = await res.json();
                setChatSettings(data);
            }
        } catch (err) {
            console.error("Failed to fetch chat settings:", err);
        }
    }, []);

    // Fetch chat settings on mount & when activeChat changes
    useEffect(() => {
        setTimeout(() => {
            fetchChatSettings();
        }, 0);
    }, [fetchChatSettings, activeChat]);

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

            // Find the first unread message from the peer
            const firstUnread = decrypted.find(m => !m.isNudge && !isSameId(m.senderId, parsedUser) && !m.read);
            setFirstUnreadMessageId(firstUnread ? firstUnread._id : null);

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

    // Format date divider text
    const formatDividerDate = useCallback((dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) {
            return "Today";
        }

        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday";
        }

        return date.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    }, []);

    // Format actual bubble timestamp
    const formatBubbleTime = useCallback((dateStr) => {
        if (!dateStr) return "";
        return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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

            const isActive = isSameId(contactId, activeChatRef.current);
            const isPeerMessage = !isSameId(msg.senderId, parsedUser);

            if (contactUser) {
                setRecentChats(prev => {
                    const filtered = prev.filter(c => !isSameId(c._id, contactId));
                    const existing = prev.find(c => isSameId(c._id, contactId));

                    let currentUnread = existing?.unreadCount || 0;
                    if (!isActive && isPeerMessage) {
                        currentUnread += 1;
                    }

                    const updatedContact = {
                        ...contactUser,
                        latestMessage: msg,
                        unreadCount: currentUnread
                    };
                    return [updatedContact, ...filtered];
                });

                if (isActive && isPeerMessage) {
                    // If active chat, mark as read on the backend
                    const token = localStorage.getItem("token");
                    if (token) {
                        fetch(`${API_URL}/api/users/read/${contactId}`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` }
                        }).catch(err => console.error("Error marking read:", err));
                    }
                }
            }

            // Play alert sound for any incoming peer message
            if (isPeerMessage) {
                try {
                    const audio = new Audio("/assets/bubble-pop-up-alert-notification.mp3");
                    audio.play().catch(e => console.log("Audio playback was blocked or failed:", e));
                } catch { }
            }

            if (msg.isNudge) {
                setNudgeShake(true);
                try {
                    const audio = new Audio("/assets/bell-notification.mp3");
                    audio.play().catch(e => console.log("Audio playback was blocked or failed:", e));
                } catch { }
                setTimeout(() => setNudgeShake(false), 800);

                if (isActive) {
                    setMessages(prev => [...prev, { ...msg, text: "⚡ Sent a Nudge!" }]);
                }
                return;
            }

            if (isActive) {
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

                        // Add the new message as normal
                        const newMsg = { ...msg, text: decryptedText, read: true };
                        setMessages(prev => [...prev, newMsg]);
                    }
                } catch (err) {
                    console.error("Failed to decrypt received message with both keys", err);
                    setMessages(prev => [...prev, { ...msg, text: "🔒 [Could not decrypt]" }]);
                }
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
                    const existing = prev.find(c => isSameId(c._id, contactId));
                    const updatedContact = {
                        ...contactUser,
                        latestMessage: msg,
                        unreadCount: existing?.unreadCount || 0
                    };
                    return [updatedContact, ...filtered];
                });
            }

            if (msg.isNudge) {
                if (isSameId(contactId, activeChatRef.current)) {
                    setMessages(prev => [...prev, { ...msg, text: "⚡ Sent a Nudge!" }]);
                }
                return;
            }

            if (isSameId(contactId, activeChatRef.current)) {
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
            }
        });

        socket?.on("message_unsended", ({ messageId }) => {
            setMessages(prev => prev.filter(m => m._id !== messageId));
            setReplyingToMessage(prev => prev?._id === messageId ? null : prev);
        });

        socket?.on("message_reaction", ({ messageId, reactions }) => {
            setMessages(prev => prev.map(m => m._id === messageId ? { ...m, reactions } : m));
        });

        socket?.on("message_edited", async (msg) => {
            const contactId = isSameId(msg.senderId, parsedUser) ? msg.receiverId : msg.senderId;
            const isActive = isSameId(contactId, activeChatRef.current);

            // Decrypt the edited message text
            let decryptedText = "🔒 [Could not decrypt]";
            try {
                const privateKey = await getPrivateKey(parsedUser.hikeId);
                if (privateKey) {
                    const isMine = isSameId(msg.senderId, parsedUser);
                    const primaryKey = isMine ? msg.encryptedAesKeySender : msg.encryptedAesKeyReceiver;
                    const fallbackKey = isMine ? msg.encryptedAesKeyReceiver : msg.encryptedAesKeySender;

                    try {
                        decryptedText = await decryptMessage(
                            primaryKey,
                            msg.ciphertext,
                            msg.iv,
                            privateKey
                        );
                    } catch {
                        try {
                            decryptedText = await decryptMessage(
                                fallbackKey,
                                msg.ciphertext,
                                msg.iv,
                                privateKey
                            );
                        } catch (err) {
                            console.error("Failed to decrypt edited message with fallback key:", err);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to decrypt edited message:", err);
            }

            const updatedMsg = { ...msg, text: decryptedText };

            // Update messages list if active chat
            if (isActive) {
                setMessages(prev => prev.map(m => m._id === msg._id ? updatedMsg : m));
            }

            // Play alert sound for any incoming edited peer message
            const isPeerMessage = !isSameId(msg.senderId, parsedUser);
            if (isPeerMessage) {
                try {
                    const audio = new Audio("/assets/bubble-pop-up-alert-notification.mp3");
                    audio.play().catch(e => console.log("Audio playback was blocked or failed:", e));
                } catch { }
            }

            // Update recent chats list: move to top, update preview, update unread count
            let contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
            if (!contactUser) {
                await fetchUsers();
                contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
            }

            if (contactUser) {
                setRecentChats(prev => {
                    const filtered = prev.filter(c => !isSameId(c._id, contactId));
                    const existing = prev.find(c => isSameId(c._id, contactId));

                    let currentUnread = existing?.unreadCount || 0;
                    if (!isActive && isPeerMessage) {
                        currentUnread += 1;
                    }

                    const updatedContact = {
                        ...contactUser,
                        latestMessage: msg,
                        unreadCount: currentUnread
                    };
                    return [updatedContact, ...filtered];
                });
            }

            // Update decryptedLastMessages for the sidebar preview
            setDecryptedLastMessages(prev => ({
                ...prev,
                [contactId]: { text: decryptedText, msgId: msg._id }
            }));
        });

        return () => { disconnectSocket(); };
    }, [router, fetchUsers, checkPrivateKey]);

    // ── Auto-scroll to latest message ──────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ── Auto-focus message input on typing ──────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Only focus if the pressed key is a single alphanumeric char without modifier keys
            if (
                e.key.length === 1 &&
                /^[a-zA-Z0-9]$/.test(e.key) &&
                !e.ctrlKey &&
                !e.altKey &&
                !e.metaKey
            ) {
                // Do not steal focus if the user is already typing in an input, textarea, or contenteditable
                const activeEl = document.activeElement;
                const isInput =
                    activeEl &&
                    (activeEl.tagName === "INPUT" ||
                        activeEl.tagName === "TEXTAREA" ||
                        activeEl.isContentEditable);

                if (!isInput && !isSettingsOpen && messageInputRef.current) {
                    messageInputRef.current.focus();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isSettingsOpen]);

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
        setReplyingToMessage(null);
        setExpandedMessageReactionId(null);
        setActiveReactionTab("smileys");

        // Set active chat and load history immediately to prevent race conditions
        setActiveChat(user);
        if (currentUser) {
            fetchHistory(user, currentUser);
        }

        // Reset unread count locally and ensure user is in recent list
        setRecentChats(prev => {
            const exists = prev.find(c => isSameId(c._id, user._id));
            if (exists) {
                return prev.map(c => {
                    if (isSameId(c._id, user._id)) {
                        return { ...c, unreadCount: 0 };
                    }
                    return c;
                });
            } else {
                return [...prev, { ...user, unreadCount: 0 }];
            }
        });

        // Re-fetch users list and settings in the background
        fetchUsers();
        fetchChatSettings();
    }, [currentUser, fetchHistory, fetchUsers, fetchChatSettings]);

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

    // ── Handle Media selection and local E2E preview ──────────────────────────
    const handleSelectedFile = useCallback((file) => {
        if (!file) return;

        // Limit size to 100MB
        const MAX_SIZE = 100 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            alert("File size exceeds the 100MB limitation. Please select a smaller file.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        if (!activeChat) {
            alert("Please select a contact to share media.");
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        setPendingFile(file);

        // If selected file is an image, generate object URL preview
        if (file.type?.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            setPendingFilePreview(url);
        } else {
            setPendingFilePreview(null);
        }
    }, [activeChat]);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            handleSelectedFile(file);
        }
    };

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeChat) {
            setIsDraggingFile(true);
        }
    }, [activeChat]);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingFile(false);

        if (!activeChat) return;

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleSelectedFile(file);
        }
    }, [activeChat, handleSelectedFile]);

    const handlePaste = useCallback((e) => {
        if (!activeChat || isSending || isUploading) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                    e.preventDefault();
                    // Create a neat name for the pasted image
                    const ext = file.type.split("/")[1] || "png";
                    const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/:/g, '-');
                    const renamedFile = new File([file], `Pasted Image - ${timeString}.${ext}`, { type: file.type });

                    handleSelectedFile(renamedFile);
                    break;
                }
            }
        }
    }, [activeChat, isSending, isUploading, handleSelectedFile]);

    // ── Send a message or shared media (E2EE encrypted) ───────────────────────
    const sendMessage = async (e) => {
        e?.preventDefault();
        if (!activeChat || isSending || isUploading) return;

        // Check if sending pure text and it's empty
        if (!pendingFile && !messageInput.trim()) return;

        if (!activeChat.publicKey) {
            alert("Cannot encrypt: peer has no public key.");
            return;
        }

        const myPublicKey = currentUser?.publicKey;
        if (!myPublicKey) {
            alert("Cannot encrypt: your public key is missing. Please log out and log back in.");
            return;
        }

        const socket = getSocket();

        // ── CASE 0: Editing an existing E2EE message ────────────────────────────
        if (editingMessage) {
            setIsSending(true);
            try {
                const payload = await encryptMessage(messageInput, activeChat.publicKey, myPublicKey);
                socket?.emit("edit_message", {
                    messageId: editingMessage._id,
                    ...payload,
                });
                setMessageInput("");
                setEditingMessage(null);
            } catch (err) {
                console.error("Encryption failed for edit:", err.message);
                alert(`Encryption failed: ${err.message}`);
            } finally {
                setIsSending(false);
            }
            return;
        }

        // ── CASE 1: Uploading Media File + Custom/Default E2EE Caption ──────────
        if (pendingFile) {
            setIsUploading(true);
            setUploadStatus(`Uploading ${pendingFile.name}...`);

            try {
                const token = localStorage.getItem("token");
                if (!token) throw new Error("No authorization token found. Please log in again.");

                // 1. Get secure signature for Cloudinary from backend
                const presignedRes = await fetch(`${API_URL}/api/media/presigned-url`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        fileName: pendingFile.name,
                        fileType: pendingFile.type || "application/octet-stream",
                        fileSize: pendingFile.size
                    })
                });

                if (!presignedRes.ok) {
                    const errData = await presignedRes.json();
                    if (errData.setupRequired) {
                        throw new Error("Cloudinary is not fully configured on the server yet. Please follow backend env setup.");
                    }
                    throw new Error(errData.error || "Failed to generate secure upload credentials.");
                }

                const { signature, timestamp, apiKey, cloudName, folder } = await presignedRes.json();

                // 2. Upload file directly to Cloudinary via FormData
                const formData = new FormData();
                formData.append("file", pendingFile);
                formData.append("api_key", apiKey);
                formData.append("timestamp", timestamp);
                formData.append("signature", signature);
                formData.append("folder", folder);

                const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                    method: "POST",
                    body: formData
                });

                if (!uploadRes.ok) {
                    const uploadErrorData = await uploadRes.json();
                    throw new Error(uploadErrorData?.error?.message || "Direct upload to Cloudinary failed.");
                }

                const uploadData = await uploadRes.json();
                const fileUrl = uploadData.secure_url;

                setUploadStatus("Securing and sending media message...");

                // 3. Encrypt file caption/metadata as E2EE message text
                const captionText = messageInput.trim() ? messageInput.trim() : `Sent a file: ${pendingFile.name}`;
                const payload = await encryptMessage(captionText, activeChat.publicKey, myPublicKey);

                // 4. Emit socket event
                socket?.emit("send_message", {
                    receiverId: activeChat._id,
                    ...payload,
                    isNudge: false,
                    replyTo: replyingToMessage ? replyingToMessage._id : null,
                    mediaUrl: fileUrl,
                    mediaType: pendingFile.type || "application/octet-stream",
                    mediaName: pendingFile.name,
                    mediaSize: pendingFile.size
                });

                // Reset upload and media states
                setPendingFile(null);
                setPendingFilePreview(null);
                setMessageInput("");
                setReplyingToMessage(null);
                if (fileInputRef.current) fileInputRef.current.value = "";

            } catch (err) {
                console.error("Upload/Send error:", err);
                alert(`Media Sharing Error: ${err.message}`);
            } finally {
                setIsUploading(false);
                setUploadStatus("");
            }

            // ── CASE 2: Sending normal E2EE text message ────────────────────────────
        } else {
            setIsSending(true);
            try {
                const payload = await encryptMessage(messageInput, activeChat.publicKey, myPublicKey);
                socket?.emit("send_message", {
                    receiverId: activeChat._id,
                    ...payload,
                    isNudge: false,
                    replyTo: replyingToMessage ? replyingToMessage._id : null,
                });
                setMessageInput("");
                setReplyingToMessage(null);
            } catch (err) {
                console.error("Encryption failed:", err.message);
                alert(`Encryption failed: ${err.message}`);
            } finally {
                setIsSending(false);
            }
        }
    };

    // ── Send Nudge ──────────────────────────────────────────
    const sendNudge = async () => {
        if (!activeChat) return;
        if (!activeChat.publicKey) {
            alert("Cannot send nudge: peer has no E2EE public key.");
            return;
        }
        if (!currentUser?.publicKey) {
            alert("Cannot send nudge: your public key is missing. Please log out and log back in.");
            return;
        }
        const socket = getSocket();
        try {
            const payload = await encryptMessage("NUDGE", activeChat.publicKey, currentUser.publicKey);
            socket?.emit("send_message", { receiverId: activeChat._id, ...payload, isNudge: true });
        } catch (err) {
            console.error("Nudge failed:", err);
            alert(`Nudge failed: ${err.message}`);
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

    // Handle Call Timer ticking
    useEffect(() => {
        let timerInterval = null;
        if (callStatus === "connected") {
            timerInterval = setInterval(() => {
                setCallTimer(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (timerInterval) clearInterval(timerInterval);
        };
    }, [callStatus]);

    // Ringing call handlers
    const startCall = (type) => {
        if (!activeChat) return;
        setCallType(type);
        setCallStatus("calling");
        setCallTimer(0);
        setIsMuted(false);
        setIsCameraOn(true);

        // Play loop ringing sound
        try {
            const audio = new Audio("/assets/guitar-notification.mp3");
            audio.loop = true;
            audio.play().catch(e => console.log("Calling sound failed to play:", e));
            callingAudioRef.current = audio;
        } catch { }

        // Automatically transition to "connected" after 3.5 seconds
        setTimeout(() => {
            setCallStatus(currentStatus => {
                if (currentStatus === "calling") {
                    // Stop ringing
                    if (callingAudioRef.current) {
                        callingAudioRef.current.pause();
                        callingAudioRef.current = null;
                    }
                    // Play connected sound
                    try {
                        const connectedAudio = new Audio("/assets/sci-fi-confirmation.mp3");
                        connectedAudio.play().catch(e => console.log("Connected sound failed to play:", e));
                    } catch { }
                    return "connected";
                }
                return currentStatus;
            });
        }, 3500);
    };

    const endCall = () => {
        setCallStatus("disconnected");
        setCallTimer(0);
        if (callingAudioRef.current) {
            callingAudioRef.current.pause();
            callingAudioRef.current = null;
        }
    };

    // 3-dots Menu action: Clear Chat History persistently
    const handleClearChat = async () => {
        if (!activeChat) return;
        const confirmClear = confirm("Are you sure you want to permanently clear all message history in this chat? This cannot be undone.");
        if (!confirmClear) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(API_URL + "/api/users/history/" + activeChat._id, {
                method: "DELETE",
                headers: { Authorization: "Bearer " + token }
            });

            if (res.ok) {
                setMessages([]);
                setIsMenuOpen(false);
            } else {
                alert("Failed to clear chat history.");
            }
        } catch (err) {
            console.error("Error clearing chat:", err);
            alert("Error clearing chat history.");
        }
    };

    // 3-dots Menu action: Toggle Hide/Unhide chat setting
    const handleToggleHideChat = async () => {
        if (!activeChat) return;
        const existing = chatSettings.find(s => s.peerId === activeChat._id);
        const currentlyHidden = existing ? existing.isHidden : false;
        const newHiddenState = !currentlyHidden;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(API_URL + "/api/users/chat-settings/hidden", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + token
                },
                body: JSON.stringify({ peerId: activeChat._id, isHidden: newHiddenState })
            });

            if (res.ok) {
                setIsMenuOpen(false);
                await fetchChatSettings();

                alert(
                    newHiddenState
                        ? "Conversation hidden! Enter your hidden vault PIN in the sidebar to reveal it."
                        : "Conversation unhidden successfully!"
                );

                if (newHiddenState && !isVaultOpen) {
                    setActiveChat(null);
                }
            } else {
                alert("Failed to update hidden settings.");
            }
        } catch (err) {
            console.error("Error toggling hidden state:", err);
            alert("Error hiding conversation.");
        }
    };

    // Unified user list sorted like WhatsApp: recent conversation partners at the top, others below
    const sortedUnifiedUsers = React.useMemo(() => {
        const recentIds = recentChats.map(c => c._id);

        // Determine which peers are hidden
        const hiddenPeerIds = chatSettings
            .filter(s => s.isHidden)
            .map(s => s.peerId.toString());

        // Filter recent chats (hide if hidden in settings AND vault is closed)
        const activeChats = recentChats.filter(c => {
            const isHidden = hiddenPeerIds.includes(c._id.toString());
            return isVaultOpen || !isHidden;
        });

        // Other users who don't have conversations yet
        const otherUsers = allUsers
            .filter(user => !recentIds.includes(user._id))
            .filter(user => {
                const isHidden = hiddenPeerIds.includes(user._id.toString());
                return isVaultOpen || !isHidden;
            });

        return [...activeChats, ...otherUsers];
    }, [allUsers, recentChats, chatSettings, isVaultOpen]);

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
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">

            {/* ── Sidebar ───────────────────────────────────────── */}
            <div
                className={`h-full border-r border-border flex flex-col bg-card z-20 transition-all duration-300 ${activeChat ? "hidden md:flex" : "flex w-full md:flex"
                    } ${isSidebarCollapsed ? "md:w-20" : "md:w-80"
                    }`}
            >

                {/* Header */}
                <div className={`p-4 border-b border-border flex flex-col gap-3 transition-all ${isSidebarCollapsed ? "items-center px-2" : ""}`}>
                    <div className={`flex w-full ${isSidebarCollapsed ? "flex-col items-center gap-4" : "items-center justify-between"}`}>
                        <div className="flex items-center gap-2">
                            <Image src={logo} alt="" width={35} className="shrink-0" />
                            {!isSidebarCollapsed && (
                                <h1 className="text-xl font-bold tracking-tight text-foreground animate-fade-in">ChatX</h1>
                            )}
                        </div>
                        <div className={`flex items-center ${isSidebarCollapsed ? "flex-col gap-3" : "gap-2"}`}>
                            {isVaultOpen && !isSidebarCollapsed && (
                                <button
                                    onClick={handleVaultToggle}
                                    className="p-2 rounded-full text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                                    title="Lock Vault"
                                >
                                    <Unlock className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                onClick={() => setIsSidebarCollapsed(prev => !prev)}
                                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer hidden md:block"
                                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                            >
                                {isSidebarCollapsed ? <AlignEndVertical className="w-5 h-5" /> : <AlignStartVertical className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Hidden Vault Unlock */}
                    {!isSidebarCollapsed && (
                        <motion.div
                            animate={shakeLock ? { x: [-6, 6, -6, 6, 0] } : {}}
                            transition={{ duration: 0.3 }}
                            className="flex gap-2"
                        >
                            <div className="relative flex-1">
                                <Lock className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                                <input
                                    type="password"
                                    placeholder={isVaultOpen ? "Vault open — tap 🔓 to close" : "Hidden vault PIN…"}
                                    disabled={isVaultOpen}
                                    value={pinInput}
                                    onChange={(e) => setPinInput(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleVaultToggle()}
                                    className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
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
                    )}

                    {/* Search bar */}
                    {!isSidebarCollapsed && (
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setIsSearching(true);
                                }}
                                placeholder="Search by Hike ID or email…"
                                className="w-full pl-9 pr-8 py-2 rounded-xl bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                            />
                            {searchQuery && (
                                <button onClick={() => { setSearchQuery(""); setDebouncedSearchQuery(""); setIsSearching(false); }}
                                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Chat / Search list */}
                {!isSidebarCollapsed ? (
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
                                                className={`relative cursor-pointer transition-all flex items-center rounded-xl p-3 gap-3 ${isActive
                                                    ? "bg-indigo-500/15 border-l-4 border-indigo-600 pl-2"
                                                    : user.unreadCount > 0
                                                        ? "bg-indigo-500/5 border-l-4 border-indigo-500/40 pl-2 hover:bg-indigo-500/10"
                                                        : "hover:bg-muted/50"
                                                    }`}
                                            >
                                                {/* Dynamic DiceBear Profile Avatar */}
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.hikeId}&radius=50&backgroundType=gradientLinear`}
                                                    alt={user.hikeId}
                                                    className="w-11 h-11 rounded-full object-cover border border-border shadow-sm shrink-0"
                                                />

                                                {/* User Info & Last Message */}
                                                <div className="flex-1 min-w-0 overflow-hidden animate-fade-in">
                                                    <div className="flex justify-between items-baseline mb-0.5">
                                                        <p className={`font-semibold text-sm truncate ${user.unreadCount > 0 ? "text-indigo-600 font-bold dark:text-indigo-400" : "text-foreground"}`}>
                                                            {user.hikeId}
                                                        </p>
                                                        {latestMsg && (
                                                            <span className={`text-[10px] shrink-0 font-medium ml-1 ${user.unreadCount > 0 ? "text-indigo-600 font-bold dark:text-indigo-400" : "text-muted-foreground"}`}>
                                                                {formatMessageTime(latestMsg.createdAt)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex justify-between items-center pr-1 gap-2">
                                                        <p className={`text-xs truncate flex-1 ${user.unreadCount > 0 ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                                                            {latestMsg ? (
                                                                decryptedLastMessages[user._id]?.text || "🔒 [Decrypting...]"
                                                            ) : (
                                                                "No messages yet. Say hi! 👋"
                                                            )}
                                                        </p>
                                                        {user.unreadCount > 0 && (
                                                            <motion.span
                                                                initial={{ scale: 0 }}
                                                                animate={{ scale: 1 }}
                                                                className="bg-indigo-600 text-white text-[10px] font-bold h-5 min-w-5 px-1.5 rounded-full flex items-center justify-center shadow-md animate-pulse shrink-0"
                                                            >
                                                                {user.unreadCount}
                                                            </motion.span>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </AnimatePresence>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground px-4 text-center">
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
                ) : (
                    <div className="flex-1 animate-fade-in" />
                )}

                {/* User Profile & Action Bar */}
                <div className={`border-t border-border bg-muted/20 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? "p-3 items-center" : "p-3"}`}>
                    <div className={`w-full flex ${isSidebarCollapsed ? "flex-col items-center gap-3.5" : "items-center justify-between gap-3"
                        }`}>
                        {/* Clickable Profile Section (Opens Settings) */}
                        <div
                            onClick={() => {
                                if (currentUser) checkPrivateKey(currentUser.hikeId, currentUser.publicKey);
                                setIsSettingsOpen(true);
                            }}
                            className="flex items-center gap-2.5 overflow-hidden cursor-pointer shrink-0"
                            title="View Profile / Settings"
                        >
                            <div
                                className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0 border border-border shadow-xs"
                                title={isSidebarCollapsed ? "View Profile / Settings" : undefined}
                            >
                                {currentUser?.hikeId?.charAt(0).toUpperCase() || "?"}
                            </div>
                            {!isSidebarCollapsed && (
                                <div className="flex flex-col overflow-hidden max-w-42.5 animate-fade-in">
                                    <span className="text-sm font-semibold text-foreground truncate">
                                        {currentUser?.hikeId ? `${currentUser.hikeId}` : "User"}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate leading-none mt-0.5">
                                        {currentUser?.email || ""}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className={`flex ${isSidebarCollapsed ? "flex-col items-center gap-2.5" : "items-center"}`}>
                            {/* Logout Button */}
                            <button
                                onClick={handleLogout}
                                className="p-2 rounded-lg text-rose-500 hover:text-white hover:bg-rose-500/20 active:bg-rose-500/30 transition-all shrink-0 cursor-pointer"
                                title="Logout"
                            >
                                <LogOut className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Main Chat Area ────────────────────────────────── */}
            <motion.div
                animate={nudgeShake ? { x: [-15, 15, -15, 15, -8, 8, -4, 4, 0] } : {}}
                transition={{ duration: 0.5 }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex-1 flex flex-col relative transition-all duration-300 ${activeChat ? "flex w-full" : "hidden md:flex"
                    }`}
                style={{ background: "linear-gradient(135deg, var(--color-background), var(--color-muted))" }}
            >
                {/* Drag and Drop Blur Dropzone Overlay */}
                {isDraggingFile && (
                    <div className="absolute inset-0 z-50 bg-indigo-600/10 backdrop-blur-md border-4 border-dashed border-indigo-500 rounded-3xl m-4 flex flex-col items-center justify-center pointer-events-none animate-fade-in shadow-2xl">
                        <div className="bg-card/95 border border-border p-8 rounded-2xl flex flex-col items-center gap-4 text-center max-w-xs shadow-xl scale-102 transform transition-transform duration-200">
                            <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 animate-bounce">
                                <Paperclip className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-foreground">Drop media here</h3>
                                <p className="text-xs text-muted-foreground mt-1 font-medium">E2EE Secured & Shared Instantly</p>
                            </div>
                        </div>
                    </div>
                )}

                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/80 backdrop-blur-md z-10 shadow-sm">
                            <div className="flex items-center gap-3">
                                {/* Mobile Back Button */}
                                <button
                                    onClick={() => setActiveChat(null)}
                                    className="md:hidden p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1 cursor-pointer"
                                    title="Back to Chats"
                                >
                                    <ChevronLeft className="w-6 h-6" />
                                </button>

                                <div className="w-10 h-10 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold">
                                    {activeChat.hikeId.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h2 className="font-semibold text-foreground">{activeChat.hikeId}</h2>
                                    <p className="text-xs text-emerald-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                        End-to-End Encrypted
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground relative">
                                <button
                                    onClick={() => startCall("voice")}
                                    className="hover:text-indigo-500 transition-colors cursor-pointer"
                                    title="Voice Call"
                                >
                                    <Phone className="w-5 h-5" />
                                </button>

                                <button
                                    onClick={() => startCall("video")}
                                    className="hover:text-indigo-500 transition-colors cursor-pointer"
                                    title="Video Call"
                                >
                                    <Video className="w-5 h-5" />
                                </button>

                                <div className="relative">
                                    <button
                                        onClick={() => setIsMenuOpen(prev => !prev)}
                                        className="hover:text-indigo-500 transition-colors p-1 rounded-full hover:bg-muted cursor-pointer"
                                        title="More Options"
                                    >
                                        <MoreVertical className="w-5 h-5" />
                                    </button>

                                    {/* Dropdown Menu */}
                                    <AnimatePresence>
                                        {isMenuOpen && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-30"
                                                    onClick={() => setIsMenuOpen(false)}
                                                />
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                    transition={{ duration: 0.15 }}
                                                    className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-xl shadow-2xl py-1.5 z-40 text-foreground"
                                                >
                                                    <button
                                                        onClick={handleClearChat}
                                                        className="w-full text-left px-4 py-2 text-sm hover:bg-rose-500/10 text-rose-500 flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                                                    >
                                                        <Trash className="w-4 h-4" />
                                                        Clear Chat History
                                                    </button>

                                                    <button
                                                        onClick={handleToggleHideChat}
                                                        className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-foreground flex items-center gap-2.5 transition-colors font-medium cursor-pointer"
                                                    >
                                                        {chatSettings.find(s => s.peerId === activeChat._id && s.isHidden) ? (
                                                            <>
                                                                <Unlock className="w-4 h-4 text-indigo-500" />
                                                                Unhide Conversation
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Lock className="w-4 h-4 text-indigo-500" />
                                                                Hide Conversation
                                                            </>
                                                        )}
                                                    </button>

                                                    <button
                                                        onClick={() => {
                                                            setIsMenuOpen(false);
                                                            setIsE2EEInfoOpen(true);
                                                        }}
                                                        className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-foreground flex items-center gap-2.5 transition-colors font-medium border-t border-border mt-1 cursor-pointer"
                                                    >
                                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                                        View Encryption Info
                                                    </button>
                                                </motion.div>
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>
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
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50">
                                    <Lock className="w-10 h-10 mb-2" />
                                    <p className="text-sm">Messages are end-to-end encrypted</p>
                                    <p className="text-xs mt-1">Say hi to {activeChat.hikeId}!</p>
                                </div>
                            )}
                            <AnimatePresence>
                                {messages.map((msg, idx) => {
                                    const isMine = isSameId(msg.senderId, currentUser);
                                    const isFirstUnread = firstUnreadMessageId && msg._id === firstUnreadMessageId;

                                    return (
                                        <React.Fragment key={msg._id || idx}>
                                            {(() => {
                                                const showDateDivider = idx === 0 || (() => {
                                                    const prevMsg = messages[idx - 1];
                                                    if (!prevMsg) return true;
                                                    const prevDate = new Date(prevMsg.createdAt).toDateString();
                                                    const currDate = new Date(msg.createdAt).toDateString();
                                                    return prevDate !== currDate;
                                                })();

                                                return showDateDivider && (
                                                    <div className="col-span-full flex items-center justify-center my-4 select-none animate-fade-in w-full">
                                                        <div className="grow border-t border-border opacity-35"></div>
                                                        <span className="mx-4 text-[10px] font-bold text-muted-foreground tracking-wider uppercase bg-muted/65 px-3 py-1.5 rounded-full shadow-xs border border-border/40">
                                                            {formatDividerDate(msg.createdAt)}
                                                        </span>
                                                        <div className="grow border-t border-border opacity-35"></div>
                                                    </div>
                                                );
                                            })()}

                                            {isFirstUnread && (
                                                <div className="col-span-full flex items-center justify-center my-6">
                                                    <div className="grow border border-amber-100/50"/>
                                                    <span className="mx-4 text-xs font-semibold text-amber-100 tracking-wider uppercase bg-rose-500/10 px-3.5 py-1.5 rounded-full shadow-sm border border-rose-500/20">
                                                        New Messages
                                                    </span>
                                                    <div className="grow border-t border-amber-100/50"/>
                                                </div>
                                            )}

                                            {msg.isNudge ? (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="self-center my-2.5 px-4 py-2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs flex items-center gap-2 shadow-sm font-medium"
                                                >
                                                    <Zap className="w-4 h-4 text-amber-500 animate-bounce" />
                                                    <span>
                                                        {isMine ? "You sent a nudge!" : `${activeChat?.hikeId || "Someone"} sent you a nudge!`}
                                                    </span>
                                                </motion.div>
                                            ) : (
                                                <div
                                                    onMouseEnter={() => handleMessageMouseEnter(msg._id)}
                                                    onMouseLeave={() => handleMessageMouseLeave(msg._id)}
                                                    className={`flex flex-col relative max-w-[75%] group mb-2.5 ${isMine ? "self-end items-end" : "self-start items-start"
                                                        }`}
                                                >
                                                    {/* Floating Reaction & Action Bar */}
                                                    {hoveredMessageId === msg._id && (
                                                        <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 bg-card border border-border rounded-full p-1 shadow-lg backdrop-blur-md z-30 transition-all ${isMine ? "-left-23.75" : "-right-23.75"
                                                            }`}>
                                                            {/* Smile reaction picker */}
                                                            <div className="relative">
                                                                <button
                                                                    onClick={() => {
                                                                        setActiveMessageReactionId(prev => prev === msg._id ? null : msg._id);
                                                                        setExpandedMessageReactionId(null);
                                                                        setActiveReactionTab("smileys");
                                                                    }}
                                                                    className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors cursor-pointer animate-fade-in"
                                                                    title="React"
                                                                >
                                                                    <Smile className="w-3.5 h-3.5" />
                                                                </button>

                                                                <AnimatePresence>
                                                                    {activeMessageReactionId === msg._id && (
                                                                        <motion.div
                                                                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                                                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                                                            className={`absolute bottom-8 z-40 bg-card/95 border border-border shadow-2xl backdrop-blur-md items-center gap-1.5 p-1.5 rounded-full flex ${isMine ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"}`}
                                                                        >
                                                                            {/* Standard 6 Emojis Horizontal Bar */}
                                                                            {["❤️", "👍", "😂", "😮", "😢", "🔥"].map((emoji) => (
                                                                                <button
                                                                                    key={emoji}
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        const socket = getSocket();
                                                                                        socket?.emit("react_to_message", { messageId: msg._id, emoji });
                                                                                        setActiveMessageReactionId(null);
                                                                                    }}
                                                                                    className="text-base hover:scale-135 hover:-translate-y-1 transition-all duration-150 p-1 cursor-pointer transform origin-bottom active:scale-90"
                                                                                >
                                                                                    {emoji}
                                                                                </button>
                                                                            ))}

                                                                            {/* Plus Button */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setActiveMessageReactionId(null);
                                                                                    setExpandedMessageReactionId(msg._id);
                                                                                }}
                                                                                className="w-6 h-6 flex items-center justify-center text-xs font-bold bg-muted hover:bg-indigo-500 hover:text-white rounded-full text-muted-foreground transition-all cursor-pointer ml-0.5 active:scale-90 shrink-0"
                                                                                title="More Reactions"
                                                                            >
                                                                                +
                                                                            </button>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>

                                                            {/* Reply icon */}
                                                            <button
                                                                onClick={() => setReplyingToMessage(msg)}
                                                                className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors cursor-pointer animate-fade-in"
                                                                title="Reply"
                                                            >
                                                                <CornerUpLeft className="w-3.5 h-3.5" />
                                                            </button>

                                                            {/* Edit icon (Only for own messages sent within 1 hour) */}
                                                            {isMine && (new Date() - new Date(msg.createdAt)) < 60 * 60 * 1000 && (
                                                                <button
                                                                    onClick={() => {
                                                                        setEditingMessage(msg);
                                                                        setMessageInput(msg.text);
                                                                        setReplyingToMessage(null); // Cancel reply if editing
                                                                        setTimeout(() => {
                                                                            messageInputRef.current?.focus();
                                                                        }, 50);
                                                                    }}
                                                                    className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors cursor-pointer animate-fade-in"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}

                                                            {/* Unsend / Trash icon */}
                                                            {isMine && (
                                                                <button
                                                                    onClick={() => {
                                                                        const confirmUnsend = confirm("Are you sure you want to unsend this message? It will be deleted for everyone.");
                                                                        if (confirmUnsend) {
                                                                            const socket = getSocket();
                                                                            socket?.emit("unsend_message", { messageId: msg._id });
                                                                        }
                                                                    }}
                                                                    className="p-1 hover:bg-rose-500/10 text-rose-500 rounded-full transition-colors cursor-pointer animate-fade-in"
                                                                    title="Unsend"
                                                                >
                                                                    <Trash className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Message Bubble itself */}
                                                    {(() => {
                                                        const emojiCount = getEmojiOnlyCount(msg.text);
                                                        const isOnlyEmoji = emojiCount > 0 && emojiCount <= 8 && !msg.mediaUrl && !msg.replyTo;
                                                        
                                                        return (
                                                            <motion.div
                                                                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                                transition={{ type: "spring", bounce: 0.25, duration: 0.3 }}
                                                                className={isOnlyEmoji
                                                                    ? `relative p-0 select-none bg-transparent border-none shadow-none ${isMine ? "text-right" : "text-left"}`
                                                                    : `px-4 py-2.5 rounded-2xl shadow-xs relative ${isMine
                                                                        ? "bg-indigo-600 text-white rounded-tr-sm"
                                                                        : "bg-card text-foreground rounded-tl-sm border border-border"
                                                                    }`}
                                                            >
                                                                {/* Reply Quote Block inside bubble */}
                                                                {msg.replyTo && (() => {
                                                                    const parentMsg = messages.find(m => m._id === msg.replyTo);
                                                                    return (
                                                                        <div className={`text-xs p-2 mb-1.5 rounded-xl border-l-4 font-medium flex flex-col gap-0.5 max-w-full truncate ${isMine
                                                                            ? "bg-indigo-700/40 border-indigo-400 text-indigo-100"
                                                                            : "bg-muted/80 border-indigo-500 text-muted-foreground"
                                                                            }`}>
                                                                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-85">
                                                                                {parentMsg ? (isSameId(parentMsg.senderId, currentUser) ? "You" : activeChat.hikeId) : "Secure Reply"}
                                                                            </span>
                                                                            <span className="truncate italic text-[11px] opacity-90">
                                                                                {parentMsg ? parentMsg.text : "🔒 Quoted message is unavailable"}
                                                                            </span>
                                                                        </div>
                                                                    );
                                                                })()}

                                                                {/* Media Attachment Viewer */}
                                                                {msg.mediaUrl && (
                                                                    <div className="media-attachment-container select-none">
                                                                        {msg.mediaType?.startsWith("image/") ? (
                                                                            <div
                                                                                className="mb-2 max-w-xs overflow-hidden rounded-xl border border-white/10 shadow-md cursor-pointer hover:scale-[1.01] hover:opacity-95 transition-all duration-200"
                                                                                onClick={() => setActiveLightboxImage(msg.mediaUrl)}
                                                                                title="Open full size image"
                                                                            >
                                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                                <img
                                                                                    src={msg.mediaUrl}
                                                                                    alt={msg.mediaName || "Shared image"}
                                                                                    className="w-full h-auto object-cover max-h-64 rounded-xl"
                                                                                />
                                                                            </div>
                                                                        ) : msg.mediaType?.startsWith("video/") ? (
                                                                            <div className="mb-2 max-w-sm rounded-xl overflow-hidden shadow-md bg-black border border-white/10">
                                                                                <video src={msg.mediaUrl} controls className="w-full max-h-64 rounded-xl" />
                                                                            </div>
                                                                        ) : msg.mediaType?.startsWith("audio/") ? (
                                                                            <div className={`mb-2 w-72 rounded-xl shadow-xs p-2 border ${isMine ? "bg-indigo-700/30 border-indigo-500/30" : "bg-muted border-border"}`}>
                                                                                <audio src={msg.mediaUrl} controls className="w-full text-xs animate-fade-in" />
                                                                            </div>
                                                                        ) : (
                                                                            <div className={`mb-2 p-3 rounded-xl flex items-center gap-3 w-64 border shadow-xs ${isMine
                                                                                ? "bg-indigo-700/40 border-indigo-500/30 text-white"
                                                                                : "bg-muted border-border text-foreground"
                                                                                }`}>
                                                                                <FileText className="w-8 h-8 shrink-0 text-indigo-400 animate-pulse" />
                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="text-xs font-semibold truncate" title={msg.mediaName}>
                                                                                        {msg.mediaName || "Shared Document"}
                                                                                    </p>
                                                                                    <p className="text-[10px] opacity-70">
                                                                                        {msg.mediaSize ? (msg.mediaSize / (1024 * 1024)).toFixed(2) + " MB" : "Unknown size"}
                                                                                    </p>
                                                                                </div>
                                                                                <a
                                                                                    href={msg.mediaUrl}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className={`p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0 ${isMine ? "text-white" : "text-indigo-500"}`}
                                                                                    title="Download File"
                                                                                >
                                                                                    <Download className="w-4 h-4" />
                                                                                </a>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {/* Render Text Caption if it's not the default "Sent a file: filename" */}
                                                                {(!msg.mediaUrl || msg.text !== `Sent a file: ${msg.mediaName}`) && (
                                                                    <p className={isOnlyEmoji
                                                                        ? `wrap-break-word leading-normal select-text ${
                                                                            emojiCount <= 5 ? "text-3xl md:text-4xl py-1.5" :
                                                                            "text-2xl md:text-3xl py-1"
                                                                        }`
                                                                        : "text-sm wrap-break-word leading-relaxed"
                                                                    }>
                                                                        {msg.text}
                                                                    </p>
                                                                )}

                                                                {/* Bubble Timestamp */}
                                                                <span className={`text-[9px] select-none block mt-1 leading-none ${
                                                                    isOnlyEmoji 
                                                                        ? "text-muted-foreground/60 text-right" 
                                                                        : isMine 
                                                                            ? "text-indigo-200/80 text-right" 
                                                                            : "text-muted-foreground/80 text-left"
                                                                }`}>
                                                                    {msg.isEdited && <span className="opacity-75 mr-1 font-normal italic">(edited)</span>}
                                                                    {formatBubbleTime(msg.createdAt)}
                                                                </span>
                                                            </motion.div>
                                                        );
                                                    })()}

                                                    {/* Reactions Badges at Corner (Futuristic Half-in, Half-out) */}
                                                    {msg.reactions && msg.reactions.length > 0 && (
                                                        <motion.div
                                                            initial={{ opacity: 0, scale: 0.75, y: 5 }}
                                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                                            exit={{ opacity: 0, scale: 0.75, y: 5 }}
                                                            className={`absolute -bottom-2.5 flex items-center gap-0.5 bg-card/95 border border-border shadow-md rounded-full px-1.5 py-0.5 z-20 select-none backdrop-blur-md transition-all hover:scale-110 duration-150 cursor-pointer ${isMine ? "right-3.5" : "left-3.5"
                                                                }`}
                                                        >
                                                            {Array.from(new Set(msg.reactions.map(r => r.emoji))).map((emoji, eIdx) => (
                                                                <span
                                                                    key={eIdx}
                                                                    className="text-xs transition-transform hover:scale-125 duration-100"
                                                                    title={msg.reactions.filter(r => r.emoji === emoji).map(r => isSameId(r.userId, currentUser) ? "You" : activeChat.hikeId).join(", ")}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const socket = getSocket();
                                                                        socket?.emit("react_to_message", { messageId: msg._id, emoji });
                                                                    }}
                                                                >
                                                                    {emoji}
                                                                </span>
                                                            ))}
                                                            {msg.reactions.length > 1 && (
                                                                <span className="text-[10px] font-extrabold text-muted-foreground ml-0.5">
                                                                    {msg.reactions.length}
                                                                </span>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </AnimatePresence>
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Replying Quote Composer Preview */}
                        {replyingToMessage && (
                            <div className="bg-card border-t border-x border-border max-w-4xl mx-auto rounded-t-2xl px-5 py-3 flex items-center justify-between gap-4 animate-slide-up shadow-xs">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className="w-1 border-l-4 border-indigo-500 h-8 rounded-full shrink-0" />
                                    <div className="flex flex-col truncate">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">
                                            Replying to {isSameId(replyingToMessage.senderId, currentUser) ? "yourself" : activeChat.hikeId}
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate italic">
                                            {replyingToMessage.text}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setReplyingToMessage(null)}
                                    className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors shrink-0 cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Editing Message Composer Preview */}
                        {editingMessage && (
                            <div className="bg-card border-t border-x border-border max-w-4xl mx-auto rounded-t-2xl px-5 py-3 flex items-center justify-between gap-4 animate-slide-up shadow-xs">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className="w-1 border-l-4 border-amber-500 h-8 rounded-full shrink-0" />
                                    <div className="flex flex-col truncate">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-amber-500">
                                            Editing message
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate italic">
                                            {editingMessage.text}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingMessage(null);
                                        setMessageInput("");
                                    }}
                                    className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors shrink-0 cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        )}

                        {/* Uploading Status Overlay */}
                        {isUploading && (
                            <div className="bg-card border-t border-x border-border max-w-4xl mx-auto rounded-t-2xl px-5 py-3 flex items-center justify-between gap-4 animate-slide-up shadow-xs">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
                                    <div className="flex flex-col truncate">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500">
                                            Cloud Sharing Progress
                                        </span>
                                        <span className="text-xs text-muted-foreground truncate font-medium">
                                            {uploadStatus}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pending Attachment Card */}
                        {pendingFile && !isUploading && (
                            <div className="bg-card border-t border-x border-border max-w-4xl mx-auto rounded-t-2xl px-5 py-3.5 flex items-center justify-between gap-4 animate-slide-up shadow-xs">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    {/* Thumbnail Preview */}
                                    {pendingFilePreview ? (
                                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-border shrink-0 select-none">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={pendingFilePreview}
                                                alt="Local preview"
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    ) : pendingFile.type?.startsWith("audio/") ? (
                                        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/10 text-indigo-500">
                                            <Music className="w-5 h-5 animate-pulse" />
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/10 text-indigo-500">
                                            <FileText className="w-5 h-5" />
                                        </div>
                                    )}

                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-500 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block animate-ping" />
                                            Pending Media Attachment
                                        </span>
                                        <span className="text-xs text-foreground truncate font-semibold">
                                            {pendingFile.name}
                                        </span>
                                        <span className="text-[9px] text-muted-foreground">
                                            {(pendingFile.size / (1024 * 1024)).toFixed(2)} MB
                                        </span>
                                    </div>
                                </div>

                                {/* Dismiss Button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPendingFile(null);
                                        setPendingFilePreview(null);
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }}
                                    className="p-1 hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 rounded-full transition-colors shrink-0 cursor-pointer"
                                    title="Remove Attachment"
                                >
                                    <X className="w-4.5 h-4.5" />
                                </button>
                            </div>
                        )}

                        {/* Input Bar */}
                        <form
                            onSubmit={sendMessage}
                            className={`p-4 bg-card/80 backdrop-blur-md border-t border-border ${replyingToMessage || isUploading || pendingFile ? "rounded-b-2xl border-t-0" : ""}`}
                        >
                            <div className="flex items-center gap-2 max-w-4xl mx-auto">
                                {/* Nudge Button */}
                                <motion.button
                                    type="button"
                                    onClick={sendNudge}
                                    whileHover={{ scale: 1.12 }}
                                    whileTap={{ scale: 0.88 }}
                                    className="p-3 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-full transition-all shrink-0"
                                    title="Send a Nudge! ⚡"
                                >
                                    <Zap className="w-5 h-5" />
                                </motion.button>

                                {/* File Attachment Button */}
                                <motion.button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    whileHover={{ scale: 1.12 }}
                                    whileTap={{ scale: 0.88 }}
                                    disabled={isUploading || isSending}
                                    className="p-3 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-600 hover:text-white rounded-full transition-all shrink-0 cursor-pointer disabled:opacity-50"
                                    title="Share Media (Limit 100MB)"
                                >
                                    {isUploading ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                                    ) : (
                                        <Paperclip className="w-5 h-5" />
                                    )}
                                </motion.button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                />

                                <div className="flex-1 relative">
                                    <input
                                        ref={messageInputRef}
                                        type="text"
                                        placeholder={pendingFile ? `Add secure caption for ${pendingFile.name}…` : "Type a secure message…"}
                                        value={messageInput}
                                        onChange={(e) => setMessageInput(e.target.value)}
                                        onPaste={handlePaste}
                                        disabled={isSending || isUploading}
                                        className="w-full pl-4 pr-12 py-3 rounded-full bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50 transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isSending || isUploading || (!pendingFile && !messageInput.trim())}
                                        className="absolute right-1.5 top-1.5 p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-full transition-colors"
                                    >
                                        {isSending || isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
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
                            className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
                        >
                            {/* Modal Header */}
                            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                                <div className="flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-indigo-500" />
                                    <h3 className="font-bold text-lg text-foreground">Settings</h3>
                                </div>
                                <button
                                    onClick={() => {
                                        setIsSettingsOpen(false);
                                        setPinMessage("");
                                        setNewPin("");
                                    }}
                                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-5 space-y-6 overflow-y-auto max-h-[70vh]">
                                {/* Profile Section */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Profile Information
                                    </h4>
                                    <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                                {currentUser?.hikeId?.charAt(0).toUpperCase() || "?"}
                                            </div>
                                            <div>
                                                <p className="font-bold text-base text-foreground">
                                                    {currentUser?.hikeId || "unknown"}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {currentUser?.email || "unknown"}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Public Key Display */}
                                        {currentUser?.publicKey && (
                                            <div className="pt-2 border-t border-border space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-muted-foreground">
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
                                                <div className="bg-card border border-border rounded-lg p-2 font-mono text-[10px] break-all max-h-20 overflow-y-auto text-muted-foreground select-all leading-tight">
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
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            Hidden Vault Security
                                        </h4>
                                    </div>

                                    <form onSubmit={handleSetPin} className="space-y-3">
                                        <p className="text-xs text-muted-foreground leading-relaxed">
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
                                                className="flex-1 px-3 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
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
                                <div className="space-y-3 pt-4 border-t border-border">
                                    <div className="flex items-center gap-2">
                                        <Unlock className="w-4 h-4 text-amber-500" />
                                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                            End-to-End Encryption Keys
                                        </h4>
                                    </div>

                                    <div className="space-y-3">
                                        {!hasPrivateKey ? (
                                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                                                <p className="text-xs text-amber-400 font-semibold leading-relaxed flex items-center gap-1.5">
                                                    ⚠️ Private key missing from this browser!
                                                </p>
                                                <p className="text-[11px] text-muted-foreground leading-normal">
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
                                                <p className="text-[11px] text-muted-foreground leading-normal">
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
                            <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
                                <button
                                    onClick={() => {
                                        setIsSettingsOpen(false);
                                        setPinMessage("");
                                        setNewPin("");
                                    }}
                                    className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Call Overlay */}
            {callStatus !== "disconnected" && (
                <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between p-8 z-50 text-white animate-fade-in">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                            {callType === "video" ? "Secure E2EE Video Call" : "Secure E2EE Voice Call"}
                        </span>
                        <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Encrypted</span>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative my-8">
                        {callType === "video" && callStatus === "connected" ? (
                            <div className="w-full h-full max-w-2xl aspect-video bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-2xl">
                                <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-indigo-950/50 to-slate-900">
                                    <motion.img
                                        animate={{ scale: [1, 1.05, 1] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                        src={"https://api.dicebear.com/7.x/initials/svg?seed=" + activeChat.hikeId + "&radius=50&backgroundType=gradientLinear"}
                                        alt={activeChat.hikeId}
                                        className="w-28 h-28 rounded-full border-4 border-indigo-500/30 shadow-2xl"
                                    />
                                    <div className="absolute bottom-4 left-4 text-xs font-semibold tracking-wider bg-black/50 px-3.5 py-1.5 rounded-xl backdrop-blur-md border border-white/5">
                                        {activeChat.hikeId}
                                    </div>
                                </div>

                                {isCameraOn && (
                                    <div className="absolute top-4 right-4 w-32 aspect-video bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-md flex items-center justify-center bg-cover bg-center">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded">You</span>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="relative">
                                <motion.div
                                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                                    transition={{ duration: 2.5, repeat: Infinity }}
                                    className="absolute inset-0 bg-indigo-500 rounded-full"
                                />
                                <motion.div
                                    animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                                    className="absolute inset-0 bg-purple-500 rounded-full"
                                />
                                <Image
                                    src={"https://api.dicebear.com/7.x/initials/svg?seed=" + activeChat.hikeId + "&radius=50&backgroundType=gradientLinear"}
                                    alt={activeChat.hikeId}
                                    className="w-32 h-32 rounded-full border-4 border-indigo-600 relative z-10 shadow-2xl"
                                />
                            </div>
                        )}

                        <div className="mt-8 text-center relative z-10">
                            <h3 className="text-3xl font-black tracking-tight">{activeChat.hikeId}</h3>
                            <p className="text-xs text-indigo-400 mt-2 tracking-widest uppercase font-black">
                                {callStatus === "calling" ? "Calling..." : "Connected — " + Math.floor(callTimer / 60).toString().padStart(2, "0") + ":" + (callTimer % 60).toString().padStart(2, "0")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-center gap-6 py-4 border-t border-slate-900">
                        <button
                            onClick={() => setIsMuted(prev => !prev)}
                            className={"p-4 rounded-full transition-all border cursor-pointer " +
                                (isMuted
                                    ? "bg-rose-600 border-rose-600 hover:bg-rose-700"
                                    : "bg-slate-900 border-slate-800 hover:bg-slate-800")
                            }
                            title={isMuted ? "Unmute" : "Mute"}
                        >
                            <Phone className="w-6 h-6 rotate-135" />
                        </button>

                        <button
                            onClick={endCall}
                            className="p-5 bg-rose-600 hover:bg-rose-700 rounded-full shadow-lg hover:shadow-rose-600/20 transition-all border border-rose-500 cursor-pointer"
                            title="Hang Up"
                        >
                            <Phone className="w-8 h-8 rotate-135" />
                        </button>

                        {callType === "video" && (
                            <button
                                onClick={() => setIsCameraOn(prev => !prev)}
                                className={"p-4 rounded-full transition-all border cursor-pointer " +
                                    (!isCameraOn
                                        ? "bg-rose-600 border-rose-600 hover:bg-rose-700"
                                        : "bg-slate-900 border-slate-800 hover:bg-slate-800")
                                }
                                title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                            >
                                <Video className="w-6 h-6" />
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* E2EE Info Modal */}
            <AnimatePresence>
                {isE2EEInfoOpen && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ type: "spring", duration: 0.4 }}
                            className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
                        >
                            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                                <div className="flex items-center gap-2 text-emerald-500">
                                    <ShieldCheck className="w-5 h-5" />
                                    <h3 className="font-bold text-lg text-foreground">Encryption Status</h3>
                                </div>
                                <button
                                    onClick={() => setIsE2EEInfoOpen(false)}
                                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="p-5 space-y-4">
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Conversations with <span className="font-semibold text-foreground">{activeChat.hikeId}</span> are end-to-end encrypted (E2EE). Messages are secured in your browser using standard AES-GCM-256 before being sent to the server. Neither ChatX nor any third party can read them.
                                </p>

                                <div className="space-y-1.5 pt-2 border-t border-border">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        {activeChat.hikeId}&apos;s Public Key
                                    </span>
                                    <div className="bg-muted border border-border rounded-xl p-3 font-mono text-[10px] break-all max-h-24 overflow-y-auto text-muted-foreground leading-normal select-all">
                                        {activeChat.publicKey || "No E2EE public key available."}
                                    </div>
                                </div>

                                <div className="space-y-1 pt-2 border-t border-border">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                        Verification Fingerprint
                                    </span>
                                    <p className="text-[11px] font-mono text-indigo-500 font-bold tracking-wider select-all">
                                        {activeChat.publicKey
                                            ? activeChat.publicKey.substring(0, 16).match(/.{1,4}/g).join(" ") + " ... " + activeChat.publicKey.substring(activeChat.publicKey.length - 16).match(/.{1,4}/g).join(" ")
                                            : "N/A"}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Compare these key segments with your contact to verify the security of this connection.
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
                                <button
                                    onClick={() => setIsE2EEInfoOpen(false)}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md cursor-pointer"
                                >
                                    Verified
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Centered Full Emoji Picker Modal Overlay */}
            <AnimatePresence>
                {expandedMessageReactionId && (
                    <div
                        onClick={() => setExpandedMessageReactionId(null)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
                    >
                        <motion.div
                            onClick={(e) => e.stopPropagation()}
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            transition={{ type: "spring", duration: 0.3 }}
                            className="bg-card border border-border shadow-2xl rounded-2xl w-80 h-80 flex flex-col overflow-hidden text-foreground"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20 shrink-0">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                    <Smile className="w-4 h-4 text-indigo-500" />
                                    React to Message
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setExpandedMessageReactionId(null)}
                                    className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Category Selection Tabs */}
                            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border bg-card shrink-0 overflow-x-auto scrollbar-none">
                                {[
                                    { id: "smileys", label: "Smileys", icon: "😀" },
                                    { id: "gestures", label: "Gestures", icon: "👍" },
                                    { id: "expressive", label: "Expressive", icon: "🔥" }
                                ].map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveReactionTab(tab.id)}
                                        className={`px-2.5 py-1 text-xs rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer ${activeReactionTab === tab.id
                                            ? "bg-indigo-600 text-white shadow-sm"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                            }`}
                                    >
                                        <span>{tab.icon}</span>
                                        <span>{tab.label}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Emoji Grid list */}
                            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-6 gap-2 align-middle scrollbar-thin overflow-x-hidden select-none">
                                {(() => {
                                    const emojisList =
                                        activeReactionTab === "smileys"
                                            ? ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "😎", "🥳", "😏", "😒", "😔", "🥺", "😢", "😭", "😤", "😡", "🤯", "😳", "🥵", "🥶", "😱", "🤔", "🫣", "🤭", "🤫", "😶", "😐", "😑", "😬", "🫠", "🙄", "😯", "😴", "🥴"]
                                            : activeReactionTab === "gestures"
                                                ? ["👍", "👎", "👊", "✊", "🤛", "🤜", "🙌", "👏", "🫶", "👐", "🤲", "🤝", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "👋", "✍️", "💪", "🙏", "🖕", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝"]
                                                : ["🔥", "✨", "🌟", "⭐", "🎉", "💯", "🚀", "💡", "👀", "🎈", "🎁", "🎨", "🎭", "🎮", "🎯", "🍿", "🍔", "🍕", "🌮", "🍣", "🍩", "🍪", "🎂", "🧁", "🍫", "🍬", "🍺", "🍻", "🥂", "🍷", "☕", "🍵", "🌏", "☀️", "🌙", "☁️", "🌈", "☔", "⛄", "🐾", "🐱", "🐶", "🦁", "🦄", "🐼", "🐨", "🦊"];

                                    return emojisList.map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => {
                                                const socket = getSocket();
                                                socket?.emit("react_to_message", { messageId: expandedMessageReactionId, emoji });
                                                setActiveMessageReactionId(null);
                                                setExpandedMessageReactionId(null);
                                            }}
                                            className="text-xl hover:scale-135 hover:-translate-y-1 transition-all duration-150 p-1 flex items-center justify-center cursor-pointer transform origin-bottom active:scale-90"
                                        >
                                            {emoji}
                                        </button>
                                    ));
                                })()}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Image Lightbox Overlay with Blurred Background */}
            <AnimatePresence>
                {activeLightboxImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setActiveLightboxImage(null)}
                        className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 cursor-zoom-out p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            transition={{ type: "spring", duration: 0.3 }}
                            className="relative max-w-5xl max-h-[90vh] flex items-center justify-center select-none"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setActiveLightboxImage(null)}
                                className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer z-50 border border-white/10"
                                title="Close Preview"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Lightboxed Image */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={activeLightboxImage}
                                alt="Enlarged E2EE shared media preview"
                                className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/5"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
