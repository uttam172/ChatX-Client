import React from "react";
import { FileText, Download } from "lucide-react";

export default function MediaAttachment({
    msg,
    isMine,
    setActiveLightboxImage
}) {
    if (!msg.mediaUrl) return null;

    return (
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
    );
}
