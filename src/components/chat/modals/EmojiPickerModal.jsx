import React from "react";
import { motion } from "framer-motion";
import { Smile, X } from "lucide-react";
import { getSocket } from "@/utils/socket";

export default function EmojiPickerModal({
    expandedMessageReactionId,
    setExpandedMessageReactionId,
    activeReactionTab,
    setActiveReactionTab,
    setActiveMessageReactionId
}) {
    if (!expandedMessageReactionId) return null;

    return (
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
    );
}
