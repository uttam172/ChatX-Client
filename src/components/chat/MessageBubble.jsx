import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import AnimatedIcon from "@/components/common/AnimatedIcon";
import { getSocket } from "@/utils/socket";
import { isSameId, getEmojiOnlyCount, formatBubbleTime } from "@/utils/chatHelpers";
import MediaAttachment from "./MediaAttachment";
import Avatar from "./Avatar";

export default function MessageBubble({
    msg,
    currentUser,
    activeChat,
    messages,
    theme = {},
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
    showAvatar,
    senderUser
}) {
    const isMine = isSameId(msg.senderId, currentUser);
    const emojiCount = getEmojiOnlyCount(msg.text);
    const isOnlyEmoji = emojiCount > 0 && emojiCount <= 8 && !msg.mediaUrl && !msg.replyTo;

    const handleQuickReact = (emoji) => {
        const socket = getSocket();
        socket?.emit("react_to_message", { messageId: msg._id, emoji });
        setActiveMessageReactionId(null);
    };

    const handleUnsendMessage = () => {
        const confirmUnsend = confirm("Are you sure you want to unsend this message? It will be deleted for everyone.");
        if (confirmUnsend) {
            const socket = getSocket();
            socket?.emit("unsend_message", { messageId: msg._id });
        }
    };

    return (
        <div
            onMouseEnter={() => handleMessageMouseEnter(msg._id)}
            onMouseLeave={() => handleMessageMouseLeave(msg._id)}
            className={`flex flex-col relative max-w-[85%] group mb-2.5 ${isMine ? "self-end items-end" : "self-start items-start"}`}
        >
            {/* Floating Reaction & Action Bar */}
            {hoveredMessageId === msg._id && (
                <div className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 bg-card border border-border rounded-full p-1 shadow-lg backdrop-blur-md z-30 transition-all ${
                    isMine ? "-left-[95px]" : "-right-[95px]"
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
                            <AnimatedIcon name="Smile" animation="scale" size={14} />
                        </button>

                        <AnimatePresence>
                            {activeMessageReactionId === msg._id && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                    className={`absolute bottom-8 z-40 bg-card/95 border border-border shadow-2xl backdrop-blur-md items-center gap-1.5 p-1.5 rounded-full flex ${
                                        isMine ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"
                                    }`}
                                >
                                    {/* Standard 6 Emojis Horizontal Bar */}
                                    {["❤️", "👍", "😂", "😮", "😢", "🔥"].map((emoji) => (
                                        <button
                                            key={emoji}
                                            type="button"
                                            onClick={() => handleQuickReact(emoji)}
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
                        <AnimatedIcon name="CornerUpLeft" animation="scale" size={14} />
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
                            <AnimatedIcon name="Pencil" animation="bounce" size={14} />
                        </button>
                    )}

                    {/* Unsend / Trash icon */}
                    {isMine && (
                        <button
                            onClick={handleUnsendMessage}
                            className="p-1 hover:bg-rose-500/10 text-rose-500 rounded-full transition-colors cursor-pointer animate-fade-in"
                            title="Unsend"
                        >
                            <AnimatedIcon name="Trash" animation="shake" size={14} />
                        </button>
                    )}
                </div>
            )}

            {/* Horizontal Container for Avatar + Message */}
            <div className={`flex items-end gap-2.5 max-w-full ${isMine ? "flex-row-reverse" : "flex-row"}`}>

                {/* Profile Icon / Spacer */}
                {showAvatar ? (
                    <Avatar 
                        user={senderUser} 
                        className="w-7 h-7 border border-border shadow-xs shrink-0 select-none cursor-pointer mb-0.5 animate-fade-in"
                        title={`@${senderUser?.hikeId || "User"}`}
                    />
                ) : (
                    <div className="w-7 h-7 shrink-0" />
                )}

                {/* Vertical Stack: Sender Name (if group & !isMine) + Bubble */}
                <div className={`flex flex-col min-w-0 ${isMine ? "items-end" : "items-start"}`}>
                    {!isMine && activeChat?.isGroup && (
                        <span className="text-[11px] font-bold text-indigo-500 mb-0.5 ml-1 select-none">
                            {msg.senderHikeId || (typeof msg.senderId === 'object' && msg.senderId?.hikeId) || "User"}
                        </span>
                    )}
                    <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", bounce: 0.25, duration: 0.3 }}
                        className={isOnlyEmoji
                            ? `relative p-0 select-none bg-transparent border-none shadow-none ${isMine ? "text-right" : "text-left"}`
                            : `px-4 py-2.5 rounded-2xl shadow-md relative ${isMine
                                ? (theme.bubbleSent || "bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-600 text-white rounded-br-sm shadow-[0_4px_15px_rgba(99,102,241,0.2)]")
                                : (theme.bubbleReceived || "bg-slate-900/35 backdrop-blur-md text-foreground rounded-bl-sm border border-slate-800/80 shadow-[0_4px_15px_rgba(0,0,0,0.15)]")}`}
                    >
                {/* Reply Quote Block inside bubble */}
                {msg.replyTo && (() => {
                    const parentMsg = messages.find(m => m._id === msg.replyTo);
                    const parentSenderName = parentMsg 
                        ? (isSameId(parentMsg.senderId, currentUser) 
                            ? "You" 
                            : (parentMsg.senderHikeId || (typeof parentMsg.senderId === 'object' && parentMsg.senderId?.hikeId) || activeChat.hikeId)) 
                        : "Secure Reply";
                    return (
                        <div className={`text-xs p-2 mb-1.5 rounded-xl border-l-4 font-medium flex flex-col gap-0.5 max-w-full truncate ${isMine
                            ? "bg-indigo-700/40 border-indigo-400 text-indigo-100"
                            : "bg-muted/80 border-indigo-500 text-muted-foreground"
                            }`}>
                            <span className="text-[9px] font-bold uppercase tracking-wider opacity-85">
                                {parentSenderName}
                            </span>
                            <span className="truncate italic text-[11px] opacity-90">
                                {parentMsg ? parentMsg.text : "🔒 Quoted message is unavailable"}
                            </span>
                        </div>
                    );
                })()}

                {/* Media Attachment Viewer */}
                <MediaAttachment
                    msg={msg}
                    isMine={isMine}
                    setActiveLightboxImage={setActiveLightboxImage}
                />

                {/* Render Text Caption if it's not the default "Sent a file: filename" */}
                {(!msg.mediaUrl || msg.text !== `Sent a file: ${msg.mediaName}`) && (
                    <p className={isOnlyEmoji
                        ? `wrap-break-word leading-normal select-text whitespace-pre-wrap ${
                            emojiCount <= 5 ? "text-3xl md:text-4xl py-1.5" : "text-2xl md:text-3xl py-1"
                        }`
                        : "text-sm wrap-break-word leading-relaxed whitespace-pre-wrap"
                    }>
                        {msg.text}
                    </p>
                )}

                {/* Bubble Timestamp & Status */}
                <div className={`flex items-center gap-1.5 mt-1 leading-none ${
                    isOnlyEmoji 
                        ? "justify-end" 
                        : isMine 
                            ? "justify-end" 
                            : "justify-start"
                }`}>
                    <span className={`text-[9px] select-none block ${
                        isOnlyEmoji 
                            ? "text-muted-foreground/60 text-right" 
                            : isMine 
                                ? "text-white/80 text-right" 
                                : "text-white/80 text-left"
                    }`}>
                        {msg.isEdited && <span className="opacity-75 mr-1 font-normal italic">(edited)</span>}
                        {formatBubbleTime(msg.createdAt)}
                    </span>
                </div>

                {/* Reactions Badges at Corner (Futuristic Half-in, Half-out) */}
                {msg.reactions && msg.reactions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.75, y: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.75, y: 5 }}
                        className={`absolute -bottom-2.5 flex items-center gap-0.5 bg-card/95 border border-border shadow-md rounded-full px-1.5 py-0.5 z-20 select-none backdrop-blur-md transition-all hover:scale-110 duration-150 cursor-pointer ${
                            isMine ? "right-3.5" : "left-3.5"
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
            </motion.div>
                </div>
            </div>
        </div>
    );
}
