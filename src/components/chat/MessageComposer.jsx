import React, { useRef } from "react";
import { motion } from "framer-motion";
import AnimatedIcon from "@/components/common/AnimatedIcon";
import { getSocket } from "@/utils/socket";
import { isSameId } from "@/utils/chatHelpers";

export default function MessageComposer({
    activeChat,
    isUploading,
    isSending,
    uploadStatus,
    pendingFile,
    setPendingFile,
    pendingFilePreview,
    setPendingFilePreview,
    fileInputRef,
    handleFileChange,
    messageInput,
    setMessageInput,
    messageInputRef,
    sendMessage,
    sendNudge,
    replyingToMessage,
    setReplyingToMessage,
    editingMessage,
    setEditingMessage,
    handlePaste,
    currentUser,
    theme = {}
}) {
    // Dynamic Accent Colors based on theme
    const ringColorClass = {
        indigo: "focus:ring-indigo-500/30 focus:border-indigo-500/80 focus:shadow-[0_0_15px_rgba(99,102,241,0.15)]",
        pink: "focus:ring-pink-500/30 focus:border-pink-500/80 focus:shadow-[0_0_15px_rgba(236,72,153,0.15)]",
        orange: "focus:ring-orange-500/30 focus:border-orange-500/80 focus:shadow-[0_0_15px_rgba(249,115,22,0.15)]",
        emerald: "focus:ring-emerald-500/30 focus:border-emerald-500/80 focus:shadow-[0_0_15px_rgba(16,185,129,0.15)]",
        cyan: "focus:ring-cyan-500/30 focus:border-cyan-500/80 focus:shadow-[0_0_15px_rgba(6,182,212,0.15)]",
        rose: "focus:ring-rose-500/30 focus:border-rose-500/80 focus:shadow-[0_0_15px_rgba(244,63,94,0.15)]"
    }[theme?.accentColor] || "focus:ring-indigo-500/30 focus:border-indigo-500/80 focus:shadow-[0_0_15px_rgba(99,102,241,0.15)]";

    const accentBgTextClass = {
        indigo: "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-600",
        pink: "bg-pink-500/10 text-pink-500 hover:bg-pink-600",
        orange: "bg-orange-500/10 text-orange-500 hover:bg-orange-600",
        emerald: "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-600",
        cyan: "bg-cyan-500/10 text-cyan-500 hover:bg-cyan-600",
        rose: "bg-rose-500/10 text-rose-500 hover:bg-rose-600"
    }[theme?.accentColor] || "bg-indigo-500/10 text-indigo-500 hover:bg-indigo-600";

    const accentSolidBgClass = {
        indigo: "bg-indigo-600 hover:bg-indigo-700",
        pink: "bg-pink-600 hover:bg-pink-700",
        orange: "bg-orange-600 hover:bg-orange-700",
        emerald: "bg-emerald-600 hover:bg-emerald-700",
        cyan: "bg-cyan-600 hover:bg-cyan-700",
        rose: "bg-rose-600 hover:bg-rose-700"
    }[theme?.accentColor] || "bg-indigo-600 hover:bg-indigo-700";
    const isTypingRef = useRef(false);
    const typingTimeoutRef = useRef(null);

    const handleTextareaChange = (e) => {
        setMessageInput(e.target.value);
        
        // Auto-grow height logic
        e.target.style.height = "auto";
        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;

        if (activeChat) {
            const socket = getSocket();
            if (!isTypingRef.current) {
                isTypingRef.current = true;
                socket?.emit("typing", { receiverId: activeChat._id, isTyping: true });
            }
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
                isTypingRef.current = false;
                socket?.emit("typing", { receiverId: activeChat._id, isTyping: false });
            }, 2000);
        }
    };

    const handleTextareaKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage(e);
            
            // Clear typing status immediately on send
            isTypingRef.current = false;
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            const socket = getSocket();
            socket?.emit("typing", { receiverId: activeChat._id, isTyping: false });
        } else if (e.key === "Tab") {
            e.preventDefault();
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const val = textarea.value;
            const indent = "    "; // 4 spaces for elegant indentation
            const newValue = val.substring(0, start) + indent + val.substring(end);
            setMessageInput(newValue);
            
            // Adjust cursor position and trigger dynamic auto-grow height
            setTimeout(() => {
                textarea.selectionStart = textarea.selectionEnd = start + indent.length;
                textarea.style.height = "auto";
                textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
            }, 0);
        }
    };

    const resetComposerInputHeight = () => {
        if (messageInputRef.current) {
            messageInputRef.current.style.height = "auto";
        }
    };

    const removePendingAttachment = () => {
        setPendingFile(null);
        setPendingFilePreview(null);
        resetComposerInputHeight();
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <>
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
                        className="w-7 h-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors shrink-0 cursor-pointer"
                    >
                        <AnimatedIcon name="X" animation="scale" size={16} />
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
                            resetComposerInputHeight();
                        }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground rounded-full transition-colors shrink-0 cursor-pointer"
                    >
                        <AnimatedIcon name="X" animation="scale" size={16} />
                    </button>
                </div>
            )}

            {/* Uploading Status Overlay */}
            {isUploading && (
                <div className="bg-card border-t border-x border-border max-w-4xl mx-auto rounded-t-2xl px-5 py-3 flex items-center justify-between gap-4 animate-slide-up shadow-xs">
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <AnimatedIcon name="Loader2" animation="spin" size={16} className="text-indigo-500 shrink-0" />
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
                                <AnimatedIcon name="Music" animation="pulse" size={20} className="text-indigo-500" />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/10 text-indigo-500">
                                <AnimatedIcon name="FileText" animation="scale" size={20} className="text-indigo-500" />
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
                        onClick={removePendingAttachment}
                        className="w-8 h-8 flex items-center justify-center hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 rounded-full transition-colors shrink-0 cursor-pointer"
                        title="Remove Attachment"
                    >
                        <AnimatedIcon name="X" animation="scale" size={18} />
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
                        className="w-11 h-11 flex items-center justify-center bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded-full transition-all shrink-0 cursor-pointer"
                        title="Send a Nudge! ⚡"
                    >
                        <AnimatedIcon name="Zap" animation="bounce" size={20} />
                    </motion.button>

                    {/* File Attachment Button */}
                    <motion.button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        whileHover={{ scale: 1.12 }}
                        whileTap={{ scale: 0.88 }}
                        disabled={isUploading || isSending}
                        className={`w-11 h-11 flex items-center justify-center hover:text-white rounded-full transition-all shrink-0 cursor-pointer disabled:opacity-50 ${accentBgTextClass}`}
                        title="Share Media (Limit 100MB)"
                    >
                        {isUploading ? (
                            <AnimatedIcon name="Loader2" animation="spin" size={20} className="text-indigo-500" />
                        ) : (
                            <AnimatedIcon name="Paperclip" animation="scale" size={20} />
                        )}
                    </motion.button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    <div className="flex-1 relative">
                        <textarea
                            ref={messageInputRef}
                            rows={1}
                            placeholder={pendingFile ? `Add secure caption for ${pendingFile.name}…` : "Type a secure message…"}
                            value={messageInput}
                            onKeyDown={handleTextareaKeyDown}
                            onChange={handleTextareaChange}
                            onPaste={handlePaste}
                            disabled={isSending || isUploading}
                            className={`w-full pl-4 pr-12 py-3 rounded-2xl bg-muted text-foreground focus:outline-none focus:ring-2 border border-transparent text-sm disabled:opacity-50 transition-all duration-300 resize-none overflow-y-auto max-h-32 ${ringColorClass}`}
                        />
                        <button
                            type="submit"
                            disabled={isSending || isUploading || (!pendingFile && !messageInput.trim())}
                            className={`absolute right-2 bottom-2.5 w-8 h-8 flex items-center justify-center disabled:opacity-40 text-white rounded-full transition-colors cursor-pointer ${accentSolidBgClass}`}
                        >
                            {isSending || isUploading ? (
                                <AnimatedIcon name="Loader2" animation="spin" size={16} />
                            ) : (
                                <AnimatedIcon name="Send" animation="send" size={16} className="ml-0.5" />
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </>
    );
}
