import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, Phone, Video, MoreVertical, Trash, Unlock, Lock, ShieldCheck } from "lucide-react";
import { isSameId } from "@/utils/chatHelpers";
import Avatar from "./Avatar";

export default function ChatHeader({
    activeChat,
    setActiveChat,
    typingUsers,
    onlineStatuses,
    formatLastSeenText,
    startCall,
    isMenuOpen,
    setIsMenuOpen,
    handleClearChat,
    handleToggleHideChat,
    chatSettings,
    setIsE2EEInfoOpen,
    onViewDetails
}) {
    const isTyping = typingUsers[activeChat._id];
    const userStatus = onlineStatuses[activeChat._id];
    const isOnline = userStatus?.isOnline;
    const lastSeen = userStatus?.lastSeen;

    const isChatHidden = chatSettings.find(s => isSameId(s.peerId, activeChat._id) && s.isHidden);

    return (
        <div className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/80 backdrop-blur-md z-10 shadow-sm">
            <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setActiveChat(null);
                    }}
                    className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors mr-1 cursor-pointer"
                    title="Back to Chats"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>

                <div
                    onClick={onViewDetails}
                    className="flex items-center gap-3 cursor-pointer select-none hover:opacity-85 active:scale-98 transition-all duration-150"
                    title={activeChat.isGroup ? "View Group Details" : "View User Details"}
                >
                    <Avatar user={activeChat} className="w-10 h-10 border border-border/40" />
                    <div>
                        <h2 className="font-semibold text-foreground leading-tight hover:text-indigo-500 transition-colors">
                            {activeChat.isGroup ? activeChat.name : activeChat.hikeId}
                        </h2>
                        {(() => {
                            if (activeChat.isGroup) {
                                return (
                                    <p className="text-xs text-muted-foreground font-normal leading-none mt-1">
                                        Group • {activeChat.members?.length || 0} members
                                    </p>
                                );
                            } else if (isTyping) {
                                return (
                                    <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold animate-pulse italic leading-none mt-1">
                                        typing...
                                    </p>
                                );
                            } else if (isOnline) {
                                return (
                                    <p className="text-xs text-emerald-500 flex items-center gap-1 font-medium leading-none mt-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
                                        Active now
                                    </p>
                                );
                            } else {
                                return (
                                    <p className="text-xs text-muted-foreground font-normal leading-none mt-1">
                                        {formatLastSeenText(lastSeen)}
                                    </p>
                                );
                            }
                        })()}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground relative">
                {!activeChat.isGroup && (
                    <>
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
                    </>
                )}

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
                                    {!activeChat.isGroup && (
                                        <>
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
                                                {isChatHidden ? (
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
                                        </>
                                    )}

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
    );
}
