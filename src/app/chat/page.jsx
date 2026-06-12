"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { initiateSocketConnection, getSocket, disconnectSocket } from "@/utils/socket";
import {
    encryptMessage,
    encryptGroupMessage,
    decryptMessage,
    getPrivateKey,
    generateE2EEKeys,
    storePrivateKey,
    encryptPrivateKeyWithPassword,
    verifyKeyPair,
    decryptPrivateKeyWithPassword
} from "@/utils/crypto";

// Sub-components
import Sidebar from "@/components/chat/Sidebar";
import ChatArea from "@/components/chat/ChatArea";

// Modals
import SettingsPage from "@/components/chat/SettingsPage";
import CallOverlay from "@/components/chat/modals/CallOverlay";
import E2EEInfoModal from "@/components/chat/modals/E2EEInfoModal";
import EmojiPickerModal from "@/components/chat/modals/EmojiPickerModal";
import LightboxModal from "@/components/chat/modals/LightboxModal";
import CreateGroupModal from "@/components/chat/modals/CreateGroupModal";
import ChatDetailsPage from "@/components/chat/ChatDetailsPage";
import GroupDetailsPage from "@/components/chat/GroupDetailsPage";

// Utilities
import { isSameId, formatLastSeenText } from "@/utils/chatHelpers";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ChatPage() {
    const router = useRouter();

    const [currentUser, setCurrentUser] = useState(() => {
        if (typeof window !== "undefined") {
            const user = localStorage.getItem("user");
            return user ? JSON.parse(user) : null;
        }
        return null;
    });
    const currentUserRef = useRef(null);
    useEffect(() => {
        currentUserRef.current = currentUser;
    }, [currentUser]);
    const [activeChat, _setActiveChat] = useState(null);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [recentChats, setRecentChats] = useState([]);
    const [groups, setGroups] = useState([]);
    const groupsRef = useRef([]);
    useEffect(() => {
        groupsRef.current = groups;
    }, [groups]);
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isChatDetailsOpen, setIsChatDetailsOpen] = useState(false);
    const [isGroupDetailsOpen, setIsGroupDetailsOpen] = useState(false);

    const setActiveChat = useCallback((value) => {
        _setActiveChat((prev) => {
            const next = typeof value === "function" ? value(prev) : value;
            if (!prev || !next || prev._id !== next._id) {
                setIsGroupDetailsOpen(false);
                setIsChatDetailsOpen(false);
            }
            return next;
        });
    }, []);
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
    const [callPeer, setCallPeer] = useState(null);

    const callingAudioRef = useRef(null);
    const incomingAudioRef = useRef(null);
    const callTimeoutRef = useRef(null);
    const callNotificationRef = useRef(null);

    // Custom Dialog Modal States
    const [promptModal, setPromptModal] = useState({
        isOpen: false,
        title: "",
        description: "",
        onConfirm: null,
        onCancel: null
    });
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: "",
        description: "",
        onConfirm: null,
        onCancel: null
    });
    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: "",
        message: ""
    });

    const showPasswordPrompt = (title, description) => {
        return new Promise((resolve) => {
            setPromptModal({
                isOpen: true,
                title,
                description,
                onConfirm: (password) => {
                    setPromptModal(prev => ({ ...prev, isOpen: false }));
                    resolve(password);
                },
                onCancel: () => {
                    setPromptModal(prev => ({ ...prev, isOpen: false }));
                    resolve(null);
                }
            });
        });
    };

    const showConfirm = (title, description) => {
        return new Promise((resolve) => {
            setConfirmModal({
                isOpen: true,
                title,
                description,
                onConfirm: () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    resolve(false);
                }
            });
        });
    };

    const showAlert = useCallback((title, message) => {
        setAlertModal({
            isOpen: true,
            title,
            message
        });
    }, []);

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

    // Online Status & Typing states
    const [onlineStatuses, setOnlineStatuses] = useState({});
    const [typingUsers, setTypingUsers] = useState({});

    // Notification states & refs
    const [notificationPermission, setNotificationPermission] = useState(() => {
        if (typeof window !== "undefined" && "Notification" in window) {
            return Notification.permission;
        }
        return "default";
    });
    const [inAppToasts, setInAppToasts] = useState([]);
    const [isNotificationMuted, setIsNotificationMuted] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("chatx_notifications_muted") === "true";
        }
        return false;
    });
    const isNotificationMutedRef = useRef(isNotificationMuted);
    useEffect(() => {
        isNotificationMutedRef.current = isNotificationMuted;
    }, [isNotificationMuted]);
    const selectChatRef = useRef(null);

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
    const [hasPrivateKey, setHasPrivateKey] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    const messagesEndRef = useRef(null);
    const activeChatRef = useRef(null);
    const messageInputRef = useRef(null);

    useEffect(() => {
        activeChatRef.current = activeChat;
    }, [activeChat]);

    // Fetch all groups from backend
    const fetchGroups = useCallback(async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const res = await fetch(`${API_URL}/api/groups`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.ok) {
                const data = await res.json();
                setGroups(data.map(g => {
                    if (activeChatRef.current && isSameId(g._id, activeChatRef.current)) {
                        return { ...g, unreadCount: 0 };
                    }
                    return g;
                }));
            }
        } catch (err) {
            console.error("Failed to fetch groups", err);
        }
    }, []);

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

            // Also synchronize groups
            fetchGroups();
        } catch (err) {
            console.error("Failed to fetch users", err);
        }
    }, [fetchGroups]);

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

    // Update Chat Theme and Background
    const handleUpdateChatTheme = useCallback(async (chatId, isGroup, themeKey, customBackground) => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const body = {};
            if (isGroup) {
                body.groupId = chatId;
            } else {
                body.peerId = chatId;
            }
            if (themeKey !== undefined) {
                body.theme = themeKey;
            }
            if (customBackground !== undefined) {
                body.customBackground = customBackground;
            }

            const res = await fetch(API_URL + "/api/users/chat-settings/theme", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + token
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to update theme");
            }

            await fetchChatSettings();
        } catch (err) {
            console.error("Failed to update chat theme:", err);
            showAlert("Error", err.message || "Failed to update chat theme.");
        }
    }, [fetchChatSettings, showAlert]);

    // Fetch chat settings on mount & when activeChat changes
    useEffect(() => {
        let active = true;
        const timer = setTimeout(() => {
            if (active) {
                fetchChatSettings();
            }
        }, 0);
        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [fetchChatSettings, activeChat]);

    // Fetch message history with selected contact/group and decrypt it
    const fetchHistory = useCallback(async (peer, parsedUser) => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const url = peer.isGroup
                ? `${API_URL}/api/groups/history/${peer._id}`
                : `${API_URL}/api/users/history/${peer._id}`;

            const res = await fetch(url, {
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

                    if (peer.isGroup) {
                        const targetKey = isMine
                            ? msg.encryptedAesKeySender
                            : msg.groupAesKeys?.find(k => isSameId(k.userId, parsedUser))?.encryptedAesKey;

                        if (!targetKey) {
                            return { ...msg, text: "🔒 [E2EE key not available for your user]" };
                        }

                        try {
                            const decryptedText = await decryptMessage(
                                targetKey,
                                msg.ciphertext,
                                msg.iv,
                                privateKey
                            );
                            return { ...msg, text: decryptedText };
                        } catch {
                            console.warn("Failed to decrypt group message (could be old key)");
                            return { ...msg, text: "🔒 [Could not decrypt]" };
                        }
                    } else {
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
                        } catch {
                            try {
                                const decryptedText = await decryptMessage(
                                    fallbackKey,
                                    msg.ciphertext,
                                    msg.iv,
                                    privateKey
                                );
                                return { ...msg, text: decryptedText };
                            } catch {
                                console.warn("Failed to decrypt history message with both keys (could be old key)");
                                return { ...msg, text: "🔒 [Could not decrypt]" };
                            }
                        }
                    }
                })
            );

            // Find the first unread message from the peer
            const firstUnread = decrypted.find(m => 
                !m.isNudge && 
                !isSameId(m.senderId, parsedUser) && 
                (peer.isGroup ? !m.readBy?.some(uid => isSameId(uid, parsedUser)) : !m.read)
            );
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

    // Decrypt all recent chats and groups' last messages asynchronously
    useEffect(() => {
        const decryptAll = async () => {
            if (!currentUser?.hikeId) return;
            if (recentChats.length === 0 && groups.length === 0) return;

            const privateKey = await getPrivateKey(currentUser.hikeId);
            if (!privateKey) return;

            const allConversations = [
                ...recentChats,
                ...groups.map(g => ({ ...g, isGroup: true }))
            ];

            for (const chat of allConversations) {
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

                const isMine = isSameId(msg.senderId, currentUser);

                if (msg.isNudge) {
                    const prefix = chat.isGroup
                        ? `${isMine ? "You" : (msg.senderHikeId || (typeof msg.senderId === 'object' && msg.senderId?.hikeId) || "User")}: `
                        : "";
                    setDecryptedLastMessages(prev => ({
                        ...prev,
                        [chat._id]: { text: `${prefix}⚡ Sent a Nudge!`, msgId: msg._id }
                    }));
                    continue;
                }

                if (chat.isGroup) {
                    const targetKey = isMine
                        ? msg.encryptedAesKeySender
                        : msg.groupAesKeys?.find(k => isSameId(k.userId, currentUser))?.encryptedAesKey;

                    if (!targetKey) {
                        setDecryptedLastMessages(prev => ({
                            ...prev,
                            [chat._id]: { text: "🔒 [E2EE key not available]", msgId: msg._id }
                        }));
                        continue;
                    }

                    try {
                        const decText = await decryptMessage(
                            targetKey,
                            msg.ciphertext,
                            msg.iv,
                            privateKey
                        );
                        const senderName = isMine ? "You" : (msg.senderHikeId || (typeof msg.senderId === 'object' && msg.senderId?.hikeId) || "User");
                        setDecryptedLastMessages(prev => ({
                            ...prev,
                            [chat._id]: { text: `${senderName}: ${decText}`, msgId: msg._id }
                        }));
                    } catch {
                        console.warn("Failed to decrypt sidebar group message (could be old key)");
                        setDecryptedLastMessages(prev => ({
                            ...prev,
                            [chat._id]: { text: "🔒 [Could not decrypt]", msgId: msg._id }
                        }));
                    }
                } else {
                    const primaryKey = isMine ? msg.encryptedAesKeySender : msg.encryptedAesKeyReceiver;
                    const fallbackKey = isMine ? msg.encryptedAesKeyReceiver : msg.encryptedAesKeySender;

                    try {
                        const decText = await decryptMessage(primaryKey, msg.ciphertext, msg.iv, privateKey);
                        setDecryptedLastMessages(prev => ({
                            ...prev,
                            [chat._id]: { text: decText, msgId: msg._id }
                        }));
                    } catch {
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
            }
        };

        decryptAll();
    }, [recentChats, groups, currentUser]);

    // ── Robust Notification System ──────────────────────────

    const toggleNotificationPermission = async () => {
        if (typeof window === "undefined" || !("Notification" in window)) {
            alert("This browser does not support desktop notifications.");
            return;
        }

        if (Notification.permission === "denied") {
            alert("Notification permission is currently blocked. Please reset site permissions in your browser's address bar to enable notifications.");
            return;
        }

        if (Notification.permission === "default") {
            const res = await Notification.requestPermission();
            setNotificationPermission(res);
            if (res === "granted") {
                setIsNotificationMuted(false);
                localStorage.setItem("chatx_notifications_muted", "false");
                try {
                    const audio = new Audio("/media/bubble-pop-up-alert-notification.mp3");
                    audio.play().catch(() => {});
                } catch {}
                new Notification("Notifications Enabled! 🔔", {
                    body: "You will now receive secure notifications for incoming messages and nudges.",
                    icon: "/favicon.ico",
                    silent: true
                });
            }
        } else if (Notification.permission === "granted") {
            // Toggle application-level mute
            setIsNotificationMuted(prev => {
                const newValue = !prev;
                localStorage.setItem("chatx_notifications_muted", String(newValue));
                
                if (!newValue) {
                    try {
                        const audio = new Audio("/media/bubble-pop-up-alert-notification.mp3");
                        audio.play().catch(() => {});
                    } catch {}
                    new Notification("Notifications Unmuted 🔔", {
                        body: "You will receive message alerts again.",
                        icon: "/favicon.ico",
                        silent: true
                    });
                }
                return newValue;
            });
        }
    };

    const showDesktopNotification = useCallback((contactUser, decryptedText, msg) => {
        if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted" || isNotificationMutedRef.current) return;

        const title = msg.isNudge 
            ? `⚡ Nudge from ${contactUser.hikeId}` 
            : `Message from ${contactUser.hikeId}`;

        let body = decryptedText;
        if (msg.mediaUrl) {
            if (msg.mediaType?.startsWith("image/")) body = "📷 Shared an image";
            else if (msg.mediaType?.startsWith("video/")) body = "🎥 Shared a video";
            else if (msg.mediaType?.startsWith("audio/")) body = "🎵 Shared an audio message";
            else body = `📄 Shared a file: ${msg.mediaName || "document"}`;
        }

        const options = {
            body: body,
            icon: "/favicon.ico",
            tag: contactUser._id,
            requireInteraction: false,
            silent: true
        };

        try {
            const n = new Notification(title, options);
            n.onclick = (e) => {
                e.preventDefault();
                window.focus();
                if (selectChatRef.current) {
                    selectChatRef.current(contactUser);
                }
                n.close();
            };
        } catch (err) {
            console.error("Failed to render desktop notification:", err);
        }
    }, []);

    const addInAppToast = useCallback((contactUser, decryptedText, msg) => {
        if (isNotificationMutedRef.current) return;

        const id = Date.now() + Math.random().toString();
        
        let body = decryptedText;
        if (msg.mediaUrl) {
            if (msg.mediaType?.startsWith("image/")) body = "📷 Image";
            else if (msg.mediaType?.startsWith("video/")) body = "🎥 Video";
            else if (msg.mediaType?.startsWith("audio/")) body = "🎵 Audio";
            else body = `📄 File: ${msg.mediaName || "document"}`;
        } else if (msg.isNudge) {
            body = "⚡ Sent a Nudge!";
        }

        setInAppToasts(prev => [...prev, { id, contactUser, text: body }]);

        setTimeout(() => {
            setInAppToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    // Blinking tab title when tab is hidden and unread messages accumulate
    useEffect(() => {
        if (typeof window === "undefined") return;

        let titleInterval = null;
        let isBlinking = false;

        const updateTitle = () => {
            const totalUnread = recentChats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

            if (totalUnread > 0 && document.visibilityState === "hidden" && !isNotificationMuted) {
                if (!titleInterval) {
                    titleInterval = setInterval(() => {
                        document.title = isBlinking 
                            ? `💬 (${totalUnread}) New Message!`
                            : `ChatX - E2EE Secure Chat`;
                        isBlinking = !isBlinking;
                    }, 1500);
                }
            } else {
                if (titleInterval) {
                    clearInterval(titleInterval);
                    titleInterval = null;
                }
                document.title = "ChatX - E2EE Secure Chat";
            }
        };

        updateTitle();

        document.addEventListener("visibilitychange", updateTitle);
        return () => {
            document.removeEventListener("visibilitychange", updateTitle);
            if (titleInterval) clearInterval(titleInterval);
        };
    }, [recentChats, isNotificationMuted]);

    // ── Auth & Socket setup ─────────────────────────────────
    useEffect(() => {
        let usersTimer;
        const token = localStorage.getItem("token");
        const user = localStorage.getItem("user");
        if (!token || !user) {
            router.push("/auth");
            return;
        }

        const parsedUser = JSON.parse(user);

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
        usersTimer = setTimeout(() => {
            fetchUsers();
        }, 0);
        initiateSocketConnection(token);
        const socket = getSocket();

        socket?.on("receive_message", async (msg) => {
            const isGroupMsg = !!msg.groupId;
            // Ignore private messages that do not involve the current user
            if (!isGroupMsg && !isSameId(msg.senderId, parsedUser) && !isSameId(msg.receiverId, parsedUser)) {
                return;
            }
            const contactId = isGroupMsg ? msg.groupId : (isSameId(msg.senderId, parsedUser) ? msg.receiverId : msg.senderId);

            let contactUser;
            if (isGroupMsg) {
                contactUser = groupsRef.current.find(g => isSameId(g._id, contactId));
                if (!contactUser) {
                    await fetchGroups();
                    contactUser = groupsRef.current.find(g => isSameId(g._id, contactId));
                }
            } else {
                contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
                if (!contactUser) {
                    await fetchUsers();
                    contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
                }
            }

            const isActive = isSameId(contactId, activeChatRef.current);
            const isPeerMessage = !isSameId(msg.senderId, parsedUser);

            if (isGroupMsg) {
                setGroups(prev => {
                    const filtered = prev.filter(c => !isSameId(c._id, contactId));
                    const existing = prev.find(c => isSameId(c._id, contactId)) || contactUser;

                    if (!existing) return prev;

                    let currentUnread = existing.unreadCount || 0;
                    if (!isActive && isPeerMessage) {
                        currentUnread += 1;
                    }

                    const updatedGroup = {
                        ...existing,
                        latestMessage: msg,
                        unreadCount: currentUnread,
                        isGroup: true
                    };
                    return [updatedGroup, ...filtered];
                });

                if (isActive && isPeerMessage) {
                    const token = localStorage.getItem("token");
                    if (token) {
                        fetch(`${API_URL}/api/groups/read/${contactId}`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` }
                        }).catch(err => console.error("Error marking group read:", err));
                    }
                }
            } else if (contactUser) {
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
                    const token = localStorage.getItem("token");
                    if (token) {
                        fetch(`${API_URL}/api/users/read/${contactId}`, {
                            method: "POST",
                            headers: { Authorization: `Bearer ${token}` }
                        }).catch(err => console.error("Error marking read:", err));
                    }
                }
            }

            let decryptedText = msg.isNudge ? "⚡ Sent a Nudge!" : (msg.isSystemEvent ? `changed the background to ${msg.systemEventData}` : "🔒 [Encrypted Message]");
            if (isPeerMessage && !msg.isNudge && !msg.isSystemEvent) {
                try {
                    const privateKey = await getPrivateKey(parsedUser.hikeId);
                    if (privateKey) {
                        if (isGroupMsg) {
                            const groupKeyObj = msg.groupAesKeys?.find(k => isSameId(k.userId, parsedUser));
                            if (groupKeyObj) {
                                try {
                                    decryptedText = await decryptMessage(
                                        groupKeyObj.encryptedAesKey,
                                        msg.ciphertext,
                                        msg.iv,
                                        privateKey
                                    );
                                } catch {
                                    console.warn("Group decryption failed (could be old key)");
                                    decryptedText = "🔒 [Could not decrypt]";
                                }
                            }
                        } else {
                            try {
                                decryptedText = await decryptMessage(
                                    msg.encryptedAesKeyReceiver,
                                    msg.ciphertext,
                                    msg.iv,
                                    privateKey
                                );
                            } catch {
                                try {
                                    decryptedText = await decryptMessage(
                                        msg.encryptedAesKeySender,
                                        msg.ciphertext,
                                        msg.iv,
                                        privateKey
                                    );
                                } catch {
                                    console.warn("Decryption failed in socket receive_message (could be old key)");
                                    decryptedText = "🔒 [Could not decrypt]";
                                }
                            }
                        }
                    }
                } catch {
                    console.warn("Failed to load key for real-time decryption");
                }
            }

            if (isPeerMessage) {
                const sidebarText = isGroupMsg ? `${msg.senderHikeId || "User"}: ${decryptedText}` : decryptedText;
                setDecryptedLastMessages(prev => ({
                    ...prev,
                    [contactId]: { text: sidebarText, msgId: msg._id }
                }));
            }

            if (isPeerMessage && !isNotificationMutedRef.current) {
                try {
                    const audio = new Audio(msg.isNudge ? "/media/bell-notification.mp3" : "/media/bubble-pop-up-alert-notification.mp3");
                    audio.play().catch(e => console.log("Audio playback was blocked or failed:", e));
                } catch { }
            }

            if (msg.isNudge) {
                setNudgeShake(true);
                setTimeout(() => setNudgeShake(false), 800);

                if (isActive) {
                    setMessages(prev => [...prev, { ...msg, text: "⚡ Sent a Nudge!" }]);
                    if (!isGroupMsg) {
                        const socketObj = getSocket();
                        socketObj?.emit("mark_read", { senderId: msg.senderId });
                    }
                }
            } else if (msg.isSystemEvent) {
                if (msg.systemEventType === 'BACKGROUND_CHANGED') {
                    fetchChatSettings();
                }
                if (isActive) {
                    const newMsg = { ...msg, text: decryptedText, read: true };
                    setMessages(prev => [...prev, newMsg]);
                    if (!isGroupMsg) {
                        const socketObj = getSocket();
                        socketObj?.emit("mark_read", { senderId: msg.senderId });
                    }
                }
            } else {
                if (isActive) {
                    const newMsg = { ...msg, text: decryptedText, read: true };
                    setMessages(prev => [...prev, newMsg]);
                    if (!isGroupMsg) {
                        const socketObj = getSocket();
                        socketObj?.emit("mark_read", { senderId: msg.senderId });
                    }
                }
            }

            if (isPeerMessage && contactUser) {
                const isTabHidden = typeof document !== "undefined" && document.visibilityState === "hidden";
                const displayUser = isGroupMsg ? { ...contactUser, hikeId: `${msg.senderHikeId || "User"} @ ${contactUser.name}` } : contactUser;
                if (isTabHidden || !isActive) {
                    showDesktopNotification(displayUser, decryptedText, msg);
                }
                if (!isTabHidden && !isActive) {
                    addInAppToast(displayUser, decryptedText, msg);
                }
            }
        });

        socket?.on("message_sent", async (msg) => {
            const isGroupMsg = !!msg.groupId;
            // Ignore private messages that do not involve the current user
            if (!isGroupMsg && !isSameId(msg.senderId, parsedUser) && !isSameId(msg.receiverId, parsedUser)) {
                return;
            }
            const contactId = isGroupMsg ? msg.groupId : (isSameId(msg.senderId, parsedUser) ? msg.receiverId : msg.senderId);

            let contactUser;
            if (isGroupMsg) {
                contactUser = groupsRef.current.find(g => isSameId(g._id, contactId));
                if (!contactUser) {
                    await fetchGroups();
                    contactUser = groupsRef.current.find(g => isSameId(g._id, contactId));
                }
            } else {
                contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
                if (!contactUser) {
                    await fetchUsers();
                    contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
                }
            }

            if (isGroupMsg) {
                setGroups(prev => {
                    const filtered = prev.filter(c => !isSameId(c._id, contactId));
                    const existing = prev.find(c => isSameId(c._id, contactId)) || contactUser;

                    if (!existing) return prev;

                    const updatedGroup = {
                        ...existing,
                        latestMessage: msg,
                        unreadCount: existing.unreadCount || 0,
                        isGroup: true
                    };
                    return [updatedGroup, ...filtered];
                });
            } else if (contactUser) {
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
                            if (!isGroupMsg) {
                                decryptedText = await decryptMessage(
                                    msg.encryptedAesKeyReceiver,
                                    msg.ciphertext,
                                    msg.iv,
                                    privateKey
                                );
                            } else {
                                console.warn("Sender failed group decryption");
                                decryptedText = "🔒 [Could not decrypt]";
                            }
                        }
                        setMessages(prev => [...prev, { ...msg, text: decryptedText }]);
                    }
                } catch {
                    console.warn("Failed to decrypt sent message with both keys");
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
            const isGroupMsg = !!msg.groupId;
            // Ignore private messages that do not involve the current user
            if (!isGroupMsg && !isSameId(msg.senderId, parsedUser) && !isSameId(msg.receiverId, parsedUser)) {
                return;
            }
            const contactId = isGroupMsg ? msg.groupId : (isSameId(msg.senderId, parsedUser) ? msg.receiverId : msg.senderId);
            const isActive = isSameId(contactId, activeChatRef.current);

            let decryptedText = "🔒 [Could not decrypt]";
            try {
                const privateKey = await getPrivateKey(parsedUser.hikeId);
                if (privateKey) {
                    const isMine = isSameId(msg.senderId, parsedUser);
                    if (isGroupMsg) {
                        const targetKey = isMine
                            ? msg.encryptedAesKeySender
                            : msg.groupAesKeys?.find(k => isSameId(k.userId, parsedUser))?.encryptedAesKey;

                        if (targetKey) {
                            decryptedText = await decryptMessage(
                                targetKey,
                                msg.ciphertext,
                                msg.iv,
                                privateKey
                            );
                        }
                    } else {
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
                            } catch {
                                console.warn("Failed to decrypt edited message with fallback key");
                            }
                        }
                    }
                }
            } catch {
                console.warn("Failed to decrypt edited message");
            }

            const updatedMsg = { ...msg, text: decryptedText };

            if (isActive) {
                setMessages(prev => prev.map(m => m._id === msg._id ? updatedMsg : m));
            }

            const isPeerMessage = !isSameId(msg.senderId, parsedUser);
            if (isPeerMessage && !isNotificationMutedRef.current) {
                try {
                    const audio = new Audio("/media/bubble-pop-up-alert-notification.mp3");
                    audio.play().catch(e => console.log("Audio playback was blocked or failed:", e));
                } catch { }
            }

            let contactUser;
            if (isGroupMsg) {
                contactUser = groupsRef.current.find(g => isSameId(g._id, contactId));
                if (!contactUser) {
                    await fetchGroups();
                    contactUser = groupsRef.current.find(g => isSameId(g._id, contactId));
                }
            } else {
                contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
                if (!contactUser) {
                    await fetchUsers();
                    contactUser = allUsersRef.current.find(u => isSameId(u._id, contactId));
                }
            }

            if (isGroupMsg) {
                setGroups(prev => {
                    const filtered = prev.filter(c => !isSameId(c._id, contactId));
                    const existing = prev.find(c => isSameId(c._id, contactId)) || contactUser;

                    if (!existing) return prev;

                    let currentUnread = existing.unreadCount || 0;
                    if (!isActive && isPeerMessage) {
                        currentUnread += 1;
                    }

                    const updatedGroup = {
                        ...existing,
                        latestMessage: msg,
                        unreadCount: currentUnread,
                        isGroup: true
                    };
                    return [updatedGroup, ...filtered];
                });
            } else if (contactUser) {
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

            const sidebarText = isGroupMsg ? `${msg.senderHikeId || "User"}: ${decryptedText}` : decryptedText;
            setDecryptedLastMessages(prev => ({
                ...prev,
                [contactId]: { text: sidebarText, msgId: msg._id }
            }));
        });

        socket?.on("group_created", (newGroup) => {
            setGroups(prev => {
                if (prev.some(g => isSameId(g._id, newGroup._id))) return prev;
                return [{ ...newGroup, isGroup: true, unreadCount: 0 }, ...prev];
            });
        });

        socket?.on("group_messages_seen", ({ groupId, readerId }) => {
            if (activeChatRef.current && isSameId(groupId, activeChatRef.current)) {
                setMessages(prev => prev.map(m => {
                    const readByArr = m.readBy || [];
                    if (!readByArr.some(uid => isSameId(uid, readerId))) {
                        return { ...m, readBy: [...readByArr, readerId] };
                    }
                    return m;
                }));
            }
        });

        socket?.on("group_updated", (updatedGroup) => {
            setGroups(prev => prev.map(g => isSameId(g._id, updatedGroup._id) ? { ...updatedGroup, isGroup: true, unreadCount: g.unreadCount } : g));
            if (activeChatRef.current && isSameId(updatedGroup._id, activeChatRef.current)) {
                setActiveChat(prev => ({ ...prev, ...updatedGroup }));
            }
        });

        socket?.on("group_removed", ({ groupId, reason }) => {
            setGroups(prev => prev.filter(g => !isSameId(g._id, groupId)));
            if (activeChatRef.current && isSameId(groupId, activeChatRef.current)) {
                setActiveChat(null);
                if (reason === "left") {
                    showAlert("Group Left", "You have successfully left the group.");
                } else if (reason === "deleted") {
                    showAlert("Group Deleted", "This group has been deleted by the admin.");
                } else {
                    showAlert("Removed from Group", "You have been removed from this group by the admin.");
                }
            }
        });

        socket?.on("online_users_list", (data) => {
            setOnlineStatuses(data || {});
        });

        socket?.on("user_status", ({ userId, isOnline, lastSeen }) => {
            setOnlineStatuses(prev => ({
                ...prev,
                [userId]: { isOnline, lastSeen }
            }));
        });

        socket?.on("typing_status", ({ senderId, isTyping }) => {
            setTypingUsers(prev => ({
                ...prev,
                [senderId]: isTyping
            }));
        });

        socket?.on("messages_delivered", ({ receiverId, messageIds }) => {
            const messageIdSet = new Set(messageIds.map(id => id.toString()));
            if (activeChatRef.current && isSameId(receiverId, activeChatRef.current)) {
                setMessages(prev => prev.map(m => messageIdSet.has(m._id?.toString()) ? { ...m, delivered: true } : m));
            }
            setRecentChats(prev => prev.map(c => {
                if (isSameId(c._id, receiverId) && c.latestMessage && messageIdSet.has(c.latestMessage._id?.toString())) {
                    return { ...c, latestMessage: { ...c.latestMessage, delivered: true } };
                }
                return c;
            }));
        });

        socket?.on("messages_seen", ({ readerId }) => {
            if (activeChatRef.current && isSameId(readerId, activeChatRef.current)) {
                setMessages(prev => prev.map(m => isSameId(m.senderId, currentUserRef.current) ? { ...m, read: true, delivered: true } : m));
            }
            setRecentChats(prev => prev.map(c => {
                if (isSameId(c._id, readerId) && c.latestMessage && isSameId(c.latestMessage.senderId, currentUserRef.current)) {
                    return { ...c, latestMessage: { ...c.latestMessage, read: true, delivered: true } };
                }
                return c;
            }));
        });

        socket?.on("incoming_call", ({ senderId, senderHikeId, type }) => {
            const callerUser = allUsersRef.current.find(u => isSameId(u._id, senderId)) || {
                _id: senderId,
                hikeId: senderHikeId
            };
            setCallPeer(callerUser);
            setCallType(type);
            setCallStatus("incoming");
            setCallTimer(0);
            setIsMuted(false);
            setIsCameraOn(true);

            // Show Desktop Notification for incoming call
            if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted" && !isNotificationMutedRef.current) {
                const title = type === "video" ? `📹 Incoming Video Call from @${senderHikeId}` : `📞 Incoming Voice Call from @${senderHikeId}`;
                const options = {
                    body: "Click to focus and answer the call.",
                    icon: "/favicon.ico",
                    tag: `call_${senderId}`,
                    requireInteraction: true,
                    silent: true
                };
                try {
                    const n = new Notification(title, options);
                    n.onclick = (e) => {
                        e.preventDefault();
                        window.focus();
                        n.close();
                    };
                    callNotificationRef.current = n;
                } catch (err) {
                    console.error("Failed to render call desktop notification:", err);
                }
            }

            try {
                const audio = new Audio("/media/guitar-notification.mp3");
                audio.loop = true;
                audio.play().catch(e => console.log("Ringtone failed to play:", e));
                incomingAudioRef.current = audio;
            } catch { }
        });

        socket?.on("call_accepted", () => {
            if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
            }

            if (callingAudioRef.current) {
                callingAudioRef.current.pause();
                callingAudioRef.current = null;
            }

            if (callNotificationRef.current) {
                callNotificationRef.current.close();
                callNotificationRef.current = null;
            }

            try {
                const connectedAudio = new Audio("/media/sci-fi-confirmation.mp3");
                connectedAudio.play().catch(e => console.log("Connected sound failed to play:", e));
            } catch { }

            setCallStatus("connected");
            setCallTimer(0);
        });

        socket?.on("call_declined", () => {
            if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
            }

            if (callingAudioRef.current) {
                callingAudioRef.current.pause();
                callingAudioRef.current = null;
            }

            if (callNotificationRef.current) {
                callNotificationRef.current.close();
                callNotificationRef.current = null;
            }

            setCallStatus("disconnected");
            setCallPeer(null);
            showAlert("Call Declined", "The recipient declined your call request.");
        });

        socket?.on("call_ended", () => {
            if (callingAudioRef.current) {
                callingAudioRef.current.pause();
                callingAudioRef.current = null;
            }

            if (incomingAudioRef.current) {
                incomingAudioRef.current.pause();
                incomingAudioRef.current = null;
            }

            if (callNotificationRef.current) {
                callNotificationRef.current.close();
                callNotificationRef.current = null;
            }

            setCallStatus("disconnected");
            setCallTimer(0);
            setCallPeer(null);
        });

        return () => {
            if (usersTimer) clearTimeout(usersTimer);
            disconnectSocket();
            if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
            if (callingAudioRef.current) callingAudioRef.current.pause();
            if (incomingAudioRef.current) incomingAudioRef.current.pause();
            if (callNotificationRef.current) {
                callNotificationRef.current.close();
                callNotificationRef.current = null;
            }
        };
    }, [router, fetchUsers, checkPrivateKey, addInAppToast, showDesktopNotification, fetchGroups, setActiveChat, showAlert]);

    // ── Auto-scroll to latest message ──────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // ── Auto-focus message input on typing ──────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (
                e.key.length === 1 &&
                /^[a-zA-Z0-9]$/.test(e.key) &&
                !e.ctrlKey &&
                !e.altKey &&
                !e.metaKey
            ) {
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
        if (activeChat && !activeChat.isGroup) {
            const socket = getSocket();
            socket?.emit("typing", { receiverId: activeChat._id, isTyping: false });
        }

        setSearchQuery("");
        setReplyingToMessage(null);
        setExpandedMessageReactionId(null);
        setActiveReactionTab("smileys");
        setMessages([]); // Instantly clear chat area messages
        setActiveChat(user);

        const token = localStorage.getItem("token");
        if (user.isGroup) {
            if (token) {
                fetch(`${API_URL}/api/groups/read/${user._id}`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(err => console.error("Error marking group read:", err));
            }
        } else {
            const socket = getSocket();
            socket?.emit("mark_read", { senderId: user._id });
        }

        if (messageInputRef.current) {
            messageInputRef.current.style.height = "auto";
        }
        if (currentUser) {
            fetchHistory(user, currentUser);
        }

        if (user.isGroup) {
            setGroups(prev => prev.map(g => isSameId(g._id, user._id) ? { ...g, unreadCount: 0 } : g));
        } else {
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
        }

        fetchUsers();
        fetchChatSettings();
    }, [currentUser, fetchHistory, fetchUsers, fetchChatSettings, activeChat, setActiveChat]);

    useEffect(() => {
        selectChatRef.current = selectChat;
    }, [selectChat]);

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

        if (!pendingFile && !messageInput.trim()) return;

        if (!activeChat.isGroup && !activeChat.publicKey) {
            alert("Cannot encrypt: peer has no public key.");
            return;
        }

        const myPublicKey = currentUser?.publicKey;
        if (!myPublicKey) {
            alert("Cannot encrypt: your public key is missing. Please log out and log back in.");
            return;
        }

        const socket = getSocket();

        if (editingMessage) {
            setIsSending(true);
            try {
                let payload;
                if (activeChat.isGroup) {
                    const membersKeys = activeChat.members.filter(m => !isSameId(m._id, currentUser._id)).map(m => ({ userId: m._id, publicKey: m.publicKey }));
                    payload = await encryptGroupMessage(messageInput, membersKeys, myPublicKey);
                } else {
                    payload = await encryptMessage(messageInput, activeChat.publicKey, myPublicKey);
                }

                socket?.emit("edit_message", {
                    messageId: editingMessage._id,
                    ...payload,
                });
                setMessageInput("");
                setEditingMessage(null);
                if (messageInputRef.current) messageInputRef.current.style.height = "auto";
            } catch (err) {
                console.error("Encryption failed for edit:", err.message);
                alert(`Encryption failed: ${err.message}`);
            } finally {
                setIsSending(false);
            }
            return;
        }

        if (pendingFile) {
            setIsUploading(true);
            setUploadStatus(`Uploading ${pendingFile.name}...`);

            try {
                const token = localStorage.getItem("token");
                if (!token) throw new Error("No authorization token found. Please log in again.");

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

                const captionText = messageInput.trim() ? messageInput.trim() : `Sent a file: ${pendingFile.name}`;
                
                let payload;
                if (activeChat.isGroup) {
                    const membersKeys = activeChat.members.filter(m => !isSameId(m._id, currentUser._id)).map(m => ({ userId: m._id, publicKey: m.publicKey }));
                    payload = await encryptGroupMessage(captionText, membersKeys, myPublicKey);
                } else {
                    payload = await encryptMessage(captionText, activeChat.publicKey, myPublicKey);
                }

                socket?.emit("send_message", {
                    receiverId: activeChat.isGroup ? null : activeChat._id,
                    groupId: activeChat.isGroup ? activeChat._id : null,
                    ...payload,
                    isNudge: false,
                    replyTo: replyingToMessage ? replyingToMessage._id : null,
                    mediaUrl: fileUrl,
                    mediaType: pendingFile.type || "application/octet-stream",
                    mediaName: pendingFile.name,
                    mediaSize: pendingFile.size
                });

                setPendingFile(null);
                setPendingFilePreview(null);
                setMessageInput("");
                setReplyingToMessage(null);
                if (messageInputRef.current) messageInputRef.current.style.height = "auto";
                if (fileInputRef.current) fileInputRef.current.value = "";

            } catch (err) {
                console.error("Upload/Send error:", err);
                alert(`Media Sharing Error: ${err.message}`);
            } finally {
                setIsUploading(false);
                setUploadStatus("");
            }

        } else {
            setIsSending(true);
            try {
                let payload;
                if (activeChat.isGroup) {
                    const membersKeys = activeChat.members.filter(m => !isSameId(m._id, currentUser._id)).map(m => ({ userId: m._id, publicKey: m.publicKey }));
                    payload = await encryptGroupMessage(messageInput, membersKeys, myPublicKey);
                } else {
                    payload = await encryptMessage(messageInput, activeChat.publicKey, myPublicKey);
                }

                socket?.emit("send_message", {
                    receiverId: activeChat.isGroup ? null : activeChat._id,
                    groupId: activeChat.isGroup ? activeChat._id : null,
                    ...payload,
                    isNudge: false,
                    replyTo: replyingToMessage ? replyingToMessage._id : null,
                });
                setMessageInput("");
                setReplyingToMessage(null);
                if (messageInputRef.current) messageInputRef.current.style.height = "auto";
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
        if (!activeChat.isGroup && !activeChat.publicKey) {
            alert("Cannot send nudge: peer has no E2EE public key.");
            return;
        }
        if (!currentUser?.publicKey) {
            alert("Cannot send nudge: your public key is missing. Please log out and log back in.");
            return;
        }
        const socket = getSocket();
        try {
            let payload;
            if (activeChat.isGroup) {
                const membersKeys = activeChat.members.filter(m => !isSameId(m._id, currentUser._id)).map(m => ({ userId: m._id, publicKey: m.publicKey }));
                payload = await encryptGroupMessage("NUDGE", membersKeys, currentUser.publicKey);
            } else {
                payload = await encryptMessage("NUDGE", activeChat.publicKey, currentUser.publicKey);
            }

            socket?.emit("send_message", {
                receiverId: activeChat.isGroup ? null : activeChat._id,
                groupId: activeChat.isGroup ? activeChat._id : null,
                ...payload,
                isNudge: true
            });
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

    const handleRegenerateKeys = async () => {
        if (!currentUser?.hikeId) return;
        const confirmRegen = await showConfirm(
            "Regenerate E2EE Keys",
            "Warning: Regenerating your E2EE keys will update your public key on the server. You will be able to decrypt all FUTURE messages, but any PAST messages encrypted with your old key will remain locked. Do you want to proceed?"
        );
        if (!confirmRegen) return;

        const password = await showPasswordPrompt(
            "Account Password Verification",
            "Please enter your ChatX account password to securely back up your new private key on the server:"
        );
        if (!password) {
            showAlert("Verification Failed", "Password is required to regenerate keys securely.");
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
                await storePrivateKey(currentUser.hikeId, keys.privateKey);

                const updatedUser = {
                    ...currentUser,
                    publicKey: keys.publicKeyBase64,
                    encryptedPrivateKey: encryptedBackup
                };
                setCurrentUser(updatedUser);
                localStorage.setItem("user", JSON.stringify(updatedUser));

                setHasPrivateKey(true);
            } else {
                alert("Failed to update keys on server.");
            }
        } catch (err) {
            console.error("Regeneration failed", err);
            alert("Failed to regenerate keys.");
        }
    };

    const handleCreateGroup = async (name, memberIds) => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const res = await fetch(`${API_URL}/api/groups`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name, members: memberIds })
            });

            if (res.ok) {
                const newGroup = await res.json();
                newGroup.isGroup = true;
                // Fetch groups again to sync
                await fetchGroups();
                // Select the new group chat
                selectChat(newGroup);
            } else {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to create group");
            }
        } catch (err) {
            console.error("Create group error:", err);
            alert(`Failed to create group: ${err.message}`);
        }
    };

    const handleUpdateGroup = async (groupId, name, memberIds, profilePicture, avatarSeed, avatarStyle) => {
        try {
            const token = localStorage.getItem("token");
            if (!token) return;

            const res = await fetch(`${API_URL}/api/groups/${groupId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    name,
                    members: memberIds,
                    profilePicture,
                    avatarSeed,
                    avatarStyle
                })
            });

            if (res.ok) {
                const updatedGroup = await res.json();
                updatedGroup.isGroup = true;
                
                // Update groups list locally
                setGroups(prev => prev.map(g => isSameId(g._id, updatedGroup._id) ? { ...updatedGroup, unreadCount: g.unreadCount } : g));
                
                // Update active chat if it is the current one
                if (activeChatRef.current && isSameId(updatedGroup._id, activeChatRef.current)) {
                    setActiveChat(prev => ({ ...prev, ...updatedGroup }));
                }
            } else {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to update group");
            }
        } catch (err) {
            console.error("Update group error:", err);
            alert(`Failed to update group details: ${err.message}`);
            throw err;
        }
    };

    const handleRestorePrivateKey = async () => {
        if (!currentUser?.hikeId) return;
        const password = await showPasswordPrompt(
            "Account Password Verification",
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
                showAlert("Backup Not Found", "No private key backup found on the server. Please regenerate your E2EE keys in Settings.");
                return;
            }

            const decryptedKey = await decryptPrivateKeyWithPassword(meData.encryptedPrivateKey, password);
            await storePrivateKey(currentUser.hikeId, decryptedKey);

            setHasPrivateKey(true);
            showAlert("Success", "E2EE Private Key successfully restored! All your messages will now be decrypted.");

            if (activeChat) {
                fetchHistory(activeChat, currentUser);
            }
            fetchUsers();
        } catch (err) {
            console.error("Failed to restore private key:", err);
            showAlert("Error", "Restoration failed: Please check if your password is correct.");
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
        setCallPeer(activeChat);
        setCallType(type);
        setCallStatus("calling");
        setCallTimer(0);
        setIsMuted(false);
        setIsCameraOn(true);

        try {
            const audio = new Audio("/media/guitar-notification.mp3");
            audio.loop = true;
            audio.play().catch(e => console.log("Calling sound failed to play:", e));
            callingAudioRef.current = audio;
        } catch { }

        const socket = getSocket();
        socket?.emit("call_user", { receiverId: activeChat._id, type });

        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = setTimeout(() => {
            showAlert("Call Timeout", `No answer from @${activeChat.hikeId}.`);
            endCall();
        }, 30000);
    };

    const acceptCall = () => {
        if (!callPeer) return;

        if (incomingAudioRef.current) {
            incomingAudioRef.current.pause();
            incomingAudioRef.current = null;
        }

        if (callNotificationRef.current) {
            callNotificationRef.current.close();
            callNotificationRef.current = null;
        }

        try {
            const connectedAudio = new Audio("/media/sci-fi-confirmation.mp3");
            connectedAudio.play().catch(e => console.log("Connected sound failed to play:", e));
        } catch { }

        setCallStatus("connected");
        setCallTimer(0);

        const socket = getSocket();
        socket?.emit("accept_call", { callerId: callPeer._id });
    };

    const declineCall = () => {
        if (!callPeer) return;

        if (incomingAudioRef.current) {
            incomingAudioRef.current.pause();
            incomingAudioRef.current = null;
        }

        if (callNotificationRef.current) {
            callNotificationRef.current.close();
            callNotificationRef.current = null;
        }

        setCallStatus("disconnected");
        setCallPeer(null);

        const socket = getSocket();
        socket?.emit("decline_call", { callerId: callPeer._id });
    };

    const endCall = () => {
        if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
        }

        if (callingAudioRef.current) {
            callingAudioRef.current.pause();
            callingAudioRef.current = null;
        }

        if (incomingAudioRef.current) {
            incomingAudioRef.current.pause();
            incomingAudioRef.current = null;
        }

        if (callNotificationRef.current) {
            callNotificationRef.current.close();
            callNotificationRef.current = null;
        }

        if (callPeer) {
            const socket = getSocket();
            socket?.emit("end_call", { peerId: callPeer._id });
        }

        setCallStatus("disconnected");
        setCallTimer(0);
        setCallPeer(null);
    };

    // 3-dots Menu action: Clear Chat History persistently
    const handleClearChat = async () => {
        if (!activeChat) return;
        const confirmClear = await showConfirm(
            "Clear Chat History",
            "Are you sure you want to permanently clear all message history in this chat? This cannot be undone."
        );
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
                showAlert("Error", "Failed to clear chat history.");
            }
        } catch (err) {
            console.error("Error clearing chat:", err);
            showAlert("Error", "Error clearing chat history.");
        }
    };

    // 3-dots Menu action: Toggle Hide/Unhide chat setting
    const handleToggleHideChat = async () => {
        if (!activeChat) return;
        const existing = chatSettings.find(s => isSameId(s.peerId, activeChat._id));
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

    const lastSeenMyMessageIndex = (() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (isSameId(messages[i].senderId, currentUser) && !messages[i].isNudge && messages[i].read) {
                return i;
            }
        }
        return -1;
    })();

    if (!mounted) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full bg-background overflow-hidden">

            {/* Sliding In-App Toast Notifications Container */}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none w-[calc(100vw-2rem)] select-none">
                <AnimatePresence>
                    {inAppToasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: -20, scale: 0.9, x: 20 }}
                            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.15 } }}
                            onClick={() => {
                                selectChat(toast.contactUser);
                                setInAppToasts(prev => prev.filter(t => t.id !== toast.id));
                            }}
                            className="pointer-events-auto w-full p-3.5 bg-card/90 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl flex items-center gap-3 cursor-pointer hover:bg-muted/30 hover:scale-[1.01] active:scale-[0.99] transition-all"
                        >
                            <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm border border-white/10">
                                {toast.contactUser.hikeId?.charAt(0).toUpperCase() || "?"}
                            </div>
                            
                            <div className="flex-1 min-w-0 overflow-hidden pr-2">
                                <p className="text-xs font-bold text-indigo-500 dark:text-indigo-400 truncate leading-tight">
                                    {toast.contactUser.hikeId}
                                </p>
                                <p className="text-xs text-foreground/80 truncate mt-0.5 max-w-50 leading-snug">
                                    {toast.text}
                                </p>
                            </div>

                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setInAppToasts(prev => prev.filter(t => t.id !== toast.id));
                                }}
                                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Sidebar */}
            <Sidebar
                currentUser={currentUser}
                activeChat={activeChat}
                selectChat={selectChat}
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                recentChats={recentChats}
                allUsers={allUsers}
                chatSettings={chatSettings}
                isVaultOpen={isVaultOpen}
                handleVaultToggle={handleVaultToggle}
                pinInput={pinInput}
                setPinInput={setPinInput}
                shakeLock={shakeLock}
                pinError={pinError}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                isSearching={isSearching}
                setIsSearching={setIsSearching}
                debouncedSearchQuery={debouncedSearchQuery}
                decryptedLastMessages={decryptedLastMessages}
                toggleNotificationPermission={toggleNotificationPermission}
                notificationPermission={notificationPermission}
                isNotificationMuted={isNotificationMuted}
                handleLogout={handleLogout}
                checkPrivateKey={checkPrivateKey}
                setIsSettingsOpen={setIsSettingsOpen}
                groups={groups}
                setIsCreateGroupOpen={setIsCreateGroupOpen}
                isSettingsOpen={isSettingsOpen}
            />

            {/* Main Chat Area */}
            {isSettingsOpen ? (
                <SettingsPage
                    key={currentUser?._id}
                    currentUser={currentUser}
                    setCurrentUser={setCurrentUser}
                    hasPrivateKey={hasPrivateKey}
                    handleRestorePrivateKey={handleRestorePrivateKey}
                    handleRegenerateKeys={handleRegenerateKeys}
                    onClose={() => setIsSettingsOpen(false)}
                    socket={getSocket()}
                />
            ) : isGroupDetailsOpen && activeChat?.isGroup ? (
                <GroupDetailsPage
                    key={activeChat?._id}
                    activeChat={activeChat}
                    currentUser={currentUser}
                    allUsers={allUsers}
                    onUpdateGroup={handleUpdateGroup}
                    onClose={() => setIsGroupDetailsOpen(false)}
                    showConfirm={showConfirm}
                    onUpdateTheme={handleUpdateChatTheme}
                    chatSettings={chatSettings}
                />
            ) : isChatDetailsOpen && !activeChat?.isGroup ? (
                <ChatDetailsPage
                    key={activeChat?._id}
                    activeChat={activeChat}
                    onlineStatuses={onlineStatuses}
                    formatLastSeenText={formatLastSeenText}
                    onClose={() => setIsChatDetailsOpen(false)}
                    onUpdateTheme={handleUpdateChatTheme}
                    chatSettings={chatSettings}
                />
            ) : (
                <ChatArea
                    activeChat={activeChat}
                    setActiveChat={setActiveChat}
                    currentUser={currentUser}
                    messages={messages}
                    onViewDetails={() => {
                        if (activeChat?.isGroup) {
                            setIsGroupDetailsOpen(true);
                        } else {
                            setIsChatDetailsOpen(true);
                        }
                    }}
                    typingUsers={typingUsers}
                    onlineStatuses={onlineStatuses}
                    startCall={startCall}
                    isMenuOpen={isMenuOpen}
                    setIsMenuOpen={setIsMenuOpen}
                    handleClearChat={handleClearChat}
                    handleToggleHideChat={handleToggleHideChat}
                    chatSettings={chatSettings}
                    setIsE2EEInfoOpen={setIsE2EEInfoOpen}
                    hasPrivateKey={hasPrivateKey}
                    handleRestorePrivateKey={handleRestorePrivateKey}
                    setIsSettingsOpen={setIsSettingsOpen}
                    firstUnreadMessageId={firstUnreadMessageId}
                    lastSeenMyMessageIndex={lastSeenMyMessageIndex}
                    hoveredMessageId={hoveredMessageId}
                    activeMessageReactionId={activeMessageReactionId}
                    setActiveMessageReactionId={setActiveMessageReactionId}
                    setExpandedMessageReactionId={setExpandedMessageReactionId}
                    setActiveReactionTab={setActiveReactionTab}
                    replyingToMessage={replyingToMessage}
                    setReplyingToMessage={setReplyingToMessage}
                    editingMessage={editingMessage}
                    setEditingMessage={setEditingMessage}
                    messageInput={messageInput}
                    setMessageInput={setMessageInput}
                    messageInputRef={messageInputRef}
                    isSending={isSending}
                    isUploading={isUploading}
                    uploadStatus={uploadStatus}
                    pendingFile={pendingFile}
                    setPendingFile={setPendingFile}
                    pendingFilePreview={pendingFilePreview}
                    setPendingFilePreview={setPendingFilePreview}
                    fileInputRef={fileInputRef}
                    handleFileChange={handleFileChange}
                    handlePaste={handlePaste}
                    sendMessage={sendMessage}
                    sendNudge={sendNudge}
                    nudgeShake={nudgeShake}
                    isDraggingFile={isDraggingFile}
                    handleDragOver={handleDragOver}
                    handleDragLeave={handleDragLeave}
                    handleDrop={handleDrop}
                    setActiveLightboxImage={setActiveLightboxImage}
                    messagesEndRef={messagesEndRef}
                    handleMessageMouseEnter={handleMessageMouseEnter}
                    handleMessageMouseLeave={handleMessageMouseLeave}
                />
            )}



            <AnimatePresence>
                {callStatus !== "disconnected" && (
                    <CallOverlay
                        callStatus={callStatus}
                        callType={callType}
                        callTimer={callTimer}
                        isMuted={isMuted}
                        setIsMuted={setIsMuted}
                        isCameraOn={isCameraOn}
                        setIsCameraOn={setIsCameraOn}
                        endCall={endCall}
                        acceptCall={acceptCall}
                        declineCall={declineCall}
                        activeChat={callPeer || activeChat}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isE2EEInfoOpen && (
                    <E2EEInfoModal
                        isE2EEInfoOpen={isE2EEInfoOpen}
                        setIsE2EEInfoOpen={setIsE2EEInfoOpen}
                        activeChat={activeChat}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {expandedMessageReactionId && (
                    <EmojiPickerModal
                        expandedMessageReactionId={expandedMessageReactionId}
                        setExpandedMessageReactionId={setExpandedMessageReactionId}
                        activeReactionTab={activeReactionTab}
                        setActiveReactionTab={setActiveReactionTab}
                        setActiveMessageReactionId={setActiveMessageReactionId}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {activeLightboxImage && (
                    <LightboxModal
                        activeLightboxImage={activeLightboxImage}
                        setActiveLightboxImage={setActiveLightboxImage}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isCreateGroupOpen && (
                    <CreateGroupModal
                        allUsers={allUsers}
                        isOpen={isCreateGroupOpen}
                        onClose={() => setIsCreateGroupOpen(false)}
                        onCreateGroup={handleCreateGroup}
                    />
                )}
            </AnimatePresence>


            {/* Custom Prompt Modal */}
            <AnimatePresence>
                {promptModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4"
                        >
                            <div>
                                <h3 className="font-bold text-base text-foreground">{promptModal.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{promptModal.description}</p>
                            </div>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const val = e.target.passwordInput.value;
                                    promptModal.onConfirm(val);
                                }}
                                className="space-y-4"
                            >
                                <input
                                    type="password"
                                    name="passwordInput"
                                    required
                                    placeholder="Enter your password"
                                    autoFocus
                                    className="w-full px-3.5 py-2.5 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-semibold transition-all"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        type="button"
                                        onClick={promptModal.onCancel}
                                        className="px-4 py-2 hover:bg-muted text-foreground rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                        Confirm
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom Confirm Modal */}
            <AnimatePresence>
                {confirmModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4"
                        >
                            <div>
                                <h3 className="font-bold text-base text-foreground">{confirmModal.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{confirmModal.description}</p>
                            </div>
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={confirmModal.onCancel}
                                    className="px-4 py-2 hover:bg-muted text-foreground rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmModal.onConfirm}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                    Proceed
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Custom Alert Modal */}
            <AnimatePresence>
                {alertModal.isOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-card border border-border rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4"
                        >
                            <div>
                                <h3 className="font-bold text-base text-foreground">{alertModal.title}</h3>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{alertModal.message}</p>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                                >
                                    OK
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
