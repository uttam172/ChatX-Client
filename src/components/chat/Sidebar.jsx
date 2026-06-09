import React, { useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedIcon from "@/components/common/AnimatedIcon";
import { logo } from "@/assets/logo";
import { isSameId, formatMessageTime } from "@/utils/chatHelpers";
import Avatar from "./Avatar";

export default function Sidebar({
    currentUser,
    activeChat,
    selectChat,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    recentChats,
    allUsers,
    chatSettings,
    isVaultOpen,
    handleVaultToggle,
    pinInput,
    setPinInput,
    shakeLock,
    pinError,
    searchQuery,
    setSearchQuery,
    isSearching,
    setIsSearching,
    debouncedSearchQuery,
    decryptedLastMessages,
    toggleNotificationPermission,
    notificationPermission,
    isNotificationMuted,
    handleLogout,
    checkPrivateKey,
    setIsSettingsOpen,
    groups = [],
    setIsCreateGroupOpen,
    isSettingsOpen
}) {

    // Unified user list sorted like WhatsApp: recent conversation partners at the top, others below
    const sortedUnifiedUsers = useMemo(() => {
        const recentIds = recentChats.map(c => c._id);

        // Determine which peers are hidden
        const hiddenPeerIds = chatSettings
            .filter(s => s.isHidden)
            .map(s => s.peerId.toString());

        // Filter recent chats (hide if hidden in settings AND vault is closed)
        const activeChats = recentChats
            .filter(c => !isSameId(c._id, currentUser))
            .filter(c => {
                const isHidden = hiddenPeerIds.includes(c._id.toString());
                return isVaultOpen || !isHidden;
            });

        // Filter groups (they are always visible to members)
        const activeGroups = groups.map(g => ({ ...g, isGroup: true }));

        // Other users who don't have conversations yet
        const otherUsers = allUsers
            .filter(user => !isSameId(user._id, currentUser))
            .filter(user => !recentIds.includes(user._id))
            .filter(user => {
                const isHidden = hiddenPeerIds.includes(user._id.toString());
                return isVaultOpen || !isHidden;
            });

        // Combine active 1-on-1 chats and groups, then sort chronologically by latest message
        const combinedActive = [...activeChats, ...activeGroups];
        combinedActive.sort((a, b) => {
            const timeA = a.latestMessage ? new Date(a.latestMessage.createdAt).getTime() : 0;
            const timeB = b.latestMessage ? new Date(b.latestMessage.createdAt).getTime() : 0;
            return timeB - timeA;
        });

        return [...combinedActive, ...otherUsers];
    }, [allUsers, recentChats, groups, chatSettings, isVaultOpen, currentUser]);

    // Filter unified users based on the debounced search query
    const filteredUsers = useMemo(() => {
        if (!debouncedSearchQuery.trim()) {
            return sortedUnifiedUsers;
        }
        const query = debouncedSearchQuery.toLowerCase().replace(/^@/, '');
        return sortedUnifiedUsers.filter(user =>
            user.isGroup
                ? user.name.toLowerCase().includes(query)
                : (user.hikeId.toLowerCase().includes(query) || (user.email && user.email.toLowerCase().includes(query)))
        );
    }, [sortedUnifiedUsers, debouncedSearchQuery]);

    return (
        <div
            className={`h-full border-r border-border flex flex-col bg-card z-20 transition-all duration-300 ${
                (activeChat || isSettingsOpen) ? "hidden md:flex" : "flex w-full md:flex"
            } ${isSidebarCollapsed ? "md:w-20" : "md:w-80"}`}
        >
            {/* Header */}
            <div className={`p-4 border-b border-border flex flex-col gap-3 transition-all ${isSidebarCollapsed ? "items-center px-2" : ""}`}>
                <div className={`flex w-full ${isSidebarCollapsed ? "flex-col items-center gap-4" : "items-center justify-between"}`}>
                    <div className="flex items-center gap-2">
                        <Image src={logo} alt="" width={35} className="shrink-0 animate-pulse" />
                        {!isSidebarCollapsed && (
                            <h1 className="text-xl font-bold tracking-tight text-foreground animate-fade-in bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">ChatX</h1>
                        )}
                    </div>
                    <div className={`flex items-center ${isSidebarCollapsed ? "flex-col gap-3" : "gap-2"}`}>
                        {isVaultOpen && !isSidebarCollapsed && (
                            <button
                                onClick={handleVaultToggle}
                                className="p-2 rounded-full text-indigo-500 hover:bg-indigo-500/10 transition-colors cursor-pointer"
                                title="Lock Vault"
                            >
                                <AnimatedIcon name="Unlock" animation="unlock" size={16} />
                            </button>
                        )}
                        {!isSidebarCollapsed && !isSettingsOpen && (
                            <button
                                onClick={() => setIsCreateGroupOpen(true)}
                                className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-indigo-500 transition-all cursor-pointer"
                                title="Create Group"
                            >
                                <AnimatedIcon name="UserPlus" animation="plus" size={20} />
                            </button>
                        )}

                        <button
                            onClick={() => setIsSidebarCollapsed(prev => !prev)}
                            className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer hidden md:block"
                            title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                        >
                            {isSidebarCollapsed ? (
                                <AnimatedIcon name="AlignEndVertical" animation="scale" size={20} />
                            ) : (
                                <AnimatedIcon name="AlignStartVertical" animation="scale" size={20} />
                            )}
                        </button>
                    </div>
                </div>

                {/* Hidden Vault Unlock */}
                {!isSidebarCollapsed && !isSettingsOpen && (
                    <motion.div
                        animate={shakeLock ? { x: [-6, 6, -6, 6, 0] } : {}}
                        transition={{ duration: 0.3 }}
                        className="flex gap-2"
                    >
                        <div className="relative flex-1 group">
                            <AnimatedIcon name="Lock" animation="lock" size={16} className="absolute left-2.5 top-2.5 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
                            <input
                                type="password"
                                placeholder={isVaultOpen ? "Vault open — tap 🔓 to close" : "Hidden vault PIN…"}
                                disabled={isVaultOpen}
                                value={pinInput}
                                onChange={(e) => setPinInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleVaultToggle()}
                                className="w-full pl-8 pr-3 py-2 rounded-lg bg-muted text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/80 disabled:opacity-50 border border-transparent transition-all duration-300 focus:shadow-[0_0_10px_rgba(99,102,241,0.15)]"
                            />
                        </div>
                        {!isVaultOpen && (
                            <button
                                onClick={handleVaultToggle}
                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all shadow-[0_2px_10px_rgba(99,102,241,0.2)] hover:shadow-[0_2px_15px_rgba(99,102,241,0.4)] active:scale-95 cursor-pointer"
                            >
                                {pinError ? "Retry" : "Unlock"}
                            </button>
                        )}
                    </motion.div>
                )}

                {/* Search bar */}
                {!isSidebarCollapsed && !isSettingsOpen && (
                    <div className="relative group">
                        <AnimatedIcon name="Search" animation="search" size={16} className="absolute left-3 top-2.5 text-muted-foreground group-hover:text-indigo-400 transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setIsSearching(true);
                            }}
                            placeholder="Search by Hike ID or email…"
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-muted text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/80 border border-transparent transition-all duration-300 text-sm focus:shadow-[0_0_10px_rgba(99,102,241,0.15)]"
                        />
                        {searchQuery && (
                            <button onClick={() => { setSearchQuery(""); }}
                                className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer">
                                <AnimatedIcon name="X" animation="scale" size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Chat / Search list */}
            {isSettingsOpen ? (
                <div className="flex-1" />
            ) : !isSidebarCollapsed ? (
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {isSearching && (
                        <div className="flex justify-center py-6">
                            <AnimatedIcon name="Loader2" animation="spin" size={20} className="text-indigo-500" />
                        </div>
                    )}

                    {/* Unified WhatsApp-style user list with client-side search */}
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
                                            className={`relative cursor-pointer transition-all flex items-center rounded-xl p-3 gap-3 ${
                                                isActive
                                                    ? "bg-indigo-500/15 border-l-4 border-indigo-600 pl-2"
                                                    : user.unreadCount > 0
                                                        ? "bg-indigo-500/5 border-l-4 border-indigo-500/40 pl-2 hover:bg-indigo-500/10"
                                                        : "hover:bg-muted/50"
                                            }`}
                                        >
                                             {/* Dynamic Profile Avatar */}
                                             <Avatar user={user} className="w-11 h-11" />

                                            {/* User Info & Last Message */}
                                            <div className="flex-1 min-w-0 overflow-hidden animate-fade-in">
                                                <div className="flex justify-between items-baseline mb-0.5">
                                                    <p className={`font-semibold text-sm truncate ${user.unreadCount > 0 ? "text-indigo-600 font-bold dark:text-indigo-400" : "text-foreground"}`}>
                                                        {user.isGroup ? user.name : user.hikeId}
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
                                <AnimatedIcon name="Search" animation="scale" size={40} className="opacity-20 mb-3 text-muted-foreground" />
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
                <div className={`w-full flex ${isSidebarCollapsed ? "flex-col items-center gap-3.5" : "items-center justify-between gap-3"}`}>
                    {/* Clickable Profile Section (Opens Settings) */}
                    <div
                        onClick={() => {
                            if (currentUser) checkPrivateKey(currentUser.hikeId, currentUser.publicKey);
                            setIsSettingsOpen(true);
                        }}
                        className="flex items-center gap-2.5 overflow-hidden cursor-pointer shrink-0"
                        title="View Profile / Settings"
                    >
                        <Avatar user={currentUser} className="w-9 h-9 border border-border shadow-xs" />
                        {!isSidebarCollapsed && (
                            <div className="flex flex-col overflow-hidden max-w-[170px] animate-fade-in">
                                <span className="text-sm font-semibold text-foreground truncate">
                                    {currentUser?.hikeId ? `${currentUser.hikeId}` : "User"}
                                </span>
                                <span className="text-xs text-muted-foreground truncate leading-none mt-0.5">
                                    {currentUser?.email || ""}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className={`flex ${isSidebarCollapsed ? "flex-col items-center gap-2.5" : "items-center gap-1.5"}`}>
                        {/* Desktop Notification Toggle */}
                        <button
                            onClick={toggleNotificationPermission}
                            className={`p-2 rounded-lg transition-all shrink-0 cursor-pointer ${
                                notificationPermission === "granted"
                                    ? isNotificationMuted
                                        ? "text-amber-500 hover:bg-amber-500/10 active:bg-amber-500/20"
                                        : "text-emerald-500 hover:bg-emerald-500/10 active:bg-emerald-500/20"
                                    : notificationPermission === "denied"
                                    ? "text-rose-400 hover:bg-rose-500/10 active:bg-rose-500/20"
                                    : "text-amber-500 hover:bg-amber-500/10 active:bg-amber-500/20 animate-pulse"
                            }`}
                            title={
                                notificationPermission === "granted"
                                    ? isNotificationMuted
                                        ? "Notifications Muted. Click to Unmute. 🔔"
                                        : "Mute Desktop Notifications 🔕"
                                    : notificationPermission === "denied"
                                    ? "Notifications Blocked. Reset site settings in your browser address bar to enable."
                                    : "Enable Desktop Notifications 🔔"
                            }
                        >
                            {notificationPermission === "granted" ? (
                                isNotificationMuted ? (
                                    <AnimatedIcon name="BellOff" animation="scale" size={20} />
                                ) : (
                                    <AnimatedIcon name="Bell" animation="bell" size={20} />
                                )
                            ) : notificationPermission === "denied" ? (
                                <AnimatedIcon name="BellOff" animation="scale" size={20} />
                            ) : (
                                <AnimatedIcon name="BellRing" animation="bell" size={20} />
                            )}
                        </button>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-rose-500 hover:text-white hover:bg-rose-500/20 active:bg-rose-500/30 transition-all shrink-0 cursor-pointer"
                            title="Logout"
                        >
                            <AnimatedIcon name="LogOut" animation="logout" size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
