import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Zap } from "lucide-react";
import { isSameId, formatDividerDate } from "@/utils/chatHelpers";
import MessageBubble from "./MessageBubble";
import Avatar from "./Avatar";

export default function MessageList({
    messages,
    currentUser,
    activeChat,
    firstUnreadMessageId,
    lastSeenMyMessageIndex,
    hoveredMessageId,
    activeMessageReactionId,
    setActiveMessageReactionId,
    setExpandedMessageReactionId,
    setActiveReactionTab,
    setReplyingToMessage,
    setEditingMessage,
    setMessageInput,
    messageInputRef,
    handleMessageMouseEnter,
    handleMessageMouseLeave,
    setActiveLightboxImage,
    messagesEndRef
}) {
    const groupLastReadUsers = React.useMemo(() => {
        if (!activeChat?.isGroup || !messages.length) return {};
        
        const indices = {};
        const groupMembers = activeChat.members || [];
        
        groupMembers.forEach(member => {
            if (isSameId(member._id, currentUser._id)) return;
            
            let lastIdx = -1;
            for (let i = messages.length - 1; i >= 0; i--) {
                const msg = messages[i];
                const isSender = isSameId(msg.senderId, member._id);
                const isRead = msg.readBy?.some(uid => isSameId(uid, member._id));
                
                if (isSender || isRead) {
                    lastIdx = i;
                    break;
                }
            }
            
            if (lastIdx !== -1) {
                if (!indices[lastIdx]) indices[lastIdx] = [];
                indices[lastIdx].push(member);
            }
        });
        
        return indices;
    }, [messages, activeChat, currentUser]);

    return (
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
                                <MessageBubble
                                    msg={msg}
                                    currentUser={currentUser}
                                    activeChat={activeChat}
                                    messages={messages}
                                    hoveredMessageId={hoveredMessageId}
                                    activeMessageReactionId={activeMessageReactionId}
                                    setActiveMessageReactionId={setActiveMessageReactionId}
                                    setExpandedMessageReactionId={setExpandedMessageReactionId}
                                    setActiveReactionTab={setActiveReactionTab}
                                    setReplyingToMessage={setReplyingToMessage}
                                    setEditingMessage={setEditingMessage}
                                    setMessageInput={setMessageInput}
                                    messageInputRef={messageInputRef}
                                    handleMessageMouseEnter={handleMessageMouseEnter}
                                    handleMessageMouseLeave={handleMessageMouseLeave}
                                    setActiveLightboxImage={setActiveLightboxImage}
                                />
                            )}
                            
                            {idx === lastSeenMyMessageIndex && !activeChat?.isGroup && (
                                <motion.div
                                    initial={{ opacity: 0, y: -2 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-[10px] text-indigo-500 font-bold dark:text-indigo-400 select-none self-end pr-2.5 -mt-2 mb-1"
                                >
                                    Seen
                                </motion.div>
                            )}

                            {activeChat?.isGroup && groupLastReadUsers[idx] && groupLastReadUsers[idx].length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: -2 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-0.5 select-none self-end pr-2.5 -mt-2 mb-1"
                                >
                                    {groupLastReadUsers[idx].map((u) => (
                                        <Avatar
                                            key={u._id}
                                            user={u}
                                            className="w-4 h-4 border border-border shadow-xs shrink-0"
                                            title={`Seen by @${u.hikeId}`}
                                        />
                                    ))}
                                </motion.div>
                            )}
                        </React.Fragment>
                    );
                })}
            </AnimatePresence>
            <div ref={messagesEndRef} />
        </div>
    );
}
