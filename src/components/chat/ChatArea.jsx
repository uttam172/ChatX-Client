import React from "react";
import { motion } from "framer-motion";
import { Paperclip, MessageSquare } from "lucide-react";
import { formatLastSeenText } from "@/utils/chatHelpers";
import { getChatTheme } from "@/utils/themeHelper";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import MessageComposer from "./MessageComposer";

export default function ChatArea({
    activeChat,
    setActiveChat,
    currentUser,
    messages,
    typingUsers,
    onlineStatuses,
    startCall,
    isMenuOpen,
    setIsMenuOpen,
    handleClearChat,
    handleToggleHideChat,
    chatSettings,
    setIsE2EEInfoOpen,
    hasPrivateKey,
    handleRestorePrivateKey,
    setIsSettingsOpen,
    firstUnreadMessageId,
    lastSeenMyMessageIndex,
    hoveredMessageId,
    activeMessageReactionId,
    setActiveMessageReactionId,
    setExpandedMessageReactionId,
    setActiveReactionTab,
    replyingToMessage,
    setReplyingToMessage,
    editingMessage,
    setEditingMessage,
    messageInput,
    setMessageInput,
    messageInputRef,
    isSending,
    isUploading,
    uploadStatus,
    pendingFile,
    setPendingFile,
    pendingFilePreview,
    setPendingFilePreview,
    fileInputRef,
    handleFileChange,
    handlePaste,
    sendMessage,
    sendNudge,
    nudgeShake,
    isDraggingFile,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    setActiveLightboxImage,
    messagesEndRef,
    handleMessageMouseEnter,
    handleMessageMouseLeave,
    onViewDetails
}) {
    const theme = getChatTheme(chatSettings, activeChat);
    const isImageBg = theme.isCustomImage || (theme.background && theme.background.includes("url("));

    return (
        <motion.div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`flex-1 flex flex-col relative transition-all duration-300 ${
                activeChat ? "flex w-full" : "hidden md:flex"
            } ${nudgeShake ? "animate-shake" : ""}`}
            style={
                isImageBg 
                    ? { 
                        backgroundImage: theme.background, 
                        backgroundSize: "cover", 
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat"
                      } 
                    : { background: theme.background }
            }
        >
            {/* Image Background Dark Overlay */}
            {isImageBg && (
                <div className="absolute inset-0 bg-slate-950/45 pointer-events-none z-0" />
            )}
            {/* Drag and Drop Blur Dropzone Overlay */}
            {isDraggingFile && (
                <div className="absolute inset-0 z-50 bg-indigo-600/10 backdrop-blur-md border-4 border-dashed border-indigo-500 rounded-3xl m-4 flex flex-col items-center justify-center pointer-events-none animate-fade-in shadow-2xl">
                    <div className="bg-card/95 border border-border p-8 rounded-2xl flex flex-col items-center gap-4 text-center max-w-xs shadow-xl scale-[1.02] transform transition-transform duration-200">
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
                    <ChatHeader
                        activeChat={activeChat}
                        setActiveChat={setActiveChat}
                        typingUsers={typingUsers}
                        onlineStatuses={onlineStatuses}
                        formatLastSeenText={formatLastSeenText}
                        startCall={startCall}
                        isMenuOpen={isMenuOpen}
                        setIsMenuOpen={setIsMenuOpen}
                        handleClearChat={handleClearChat}
                        handleToggleHideChat={handleToggleHideChat}
                        chatSettings={chatSettings}
                        setIsE2EEInfoOpen={setIsE2EEInfoOpen}
                        onViewDetails={onViewDetails}
                    />

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

                    {/* Messages List */}
                    <MessageList
                        messages={messages}
                        currentUser={currentUser}
                        activeChat={activeChat}
                        theme={theme}
                        firstUnreadMessageId={firstUnreadMessageId}
                        lastSeenMyMessageIndex={lastSeenMyMessageIndex}
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
                        messagesEndRef={messagesEndRef}
                    />

                    {/* Message Composer Panel */}
                    <MessageComposer
                        activeChat={activeChat}
                        isUploading={isUploading}
                        isSending={isSending}
                        uploadStatus={uploadStatus}
                        pendingFile={pendingFile}
                        setPendingFile={setPendingFile}
                        pendingFilePreview={pendingFilePreview}
                        setPendingFilePreview={setPendingFilePreview}
                        fileInputRef={fileInputRef}
                        handleFileChange={handleFileChange}
                        messageInput={messageInput}
                        setMessageInput={setMessageInput}
                        messageInputRef={messageInputRef}
                        sendMessage={sendMessage}
                        sendNudge={sendNudge}
                        replyingToMessage={replyingToMessage}
                        setReplyingToMessage={setReplyingToMessage}
                        editingMessage={editingMessage}
                        setEditingMessage={setEditingMessage}
                        handlePaste={handlePaste}
                        currentUser={currentUser}
                        theme={theme}
                    />
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
    );
}
