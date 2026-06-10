import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { 
    ChevronLeft, User, Mail, Shield, Check, Copy, Info, 
    Image as ImageIcon, Loader2
} from "lucide-react";
import { chatThemes } from "@/utils/themeHelper";
import Avatar from "./Avatar";

export default function ChatDetailsPage({
    activeChat,
    onlineStatuses,
    formatLastSeenText,
    onClose,
    onUpdateTheme,
    chatSettings
}) {
    const [copied, setCopied] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadError, setUploadError] = useState("");

    const currentSetting = useMemo(() => {
        if (!activeChat || activeChat.isGroup) return null;
        return chatSettings?.find(s => s.peerId?.toString() === activeChat._id.toString());
    }, [chatSettings, activeChat]);

    const activeThemeId = currentSetting?.theme || "default";

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement("canvas");
                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    const base64Url = canvas.toDataURL("image/jpeg", 0.7);
                    resolve(base64Url);
                };
                img.onerror = () => reject(new Error("Failed to load image for compression."));
            };
            reader.onerror = () => reject(new Error("Failed to read image file."));
        });
    };

    const handleWallpaperUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            setUploadError("File must be an image");
            return;
        }

        setUploadingImage(true);
        setUploadError("");

        try {
            const base64Data = await compressImage(file);
            await onUpdateTheme(activeChat._id, false, undefined, base64Data);
        } catch (err) {
            console.error("Wallpaper compression and upload failed:", err);
            setUploadError("Failed to compress or upload wallpaper image.");
        } finally {
            setUploadingImage(false);
        }
    };

    const handleCopyPublicKey = () => {
        if (!activeChat?.publicKey) return;
        navigator.clipboard.writeText(activeChat.publicKey);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!activeChat) return null;

    const userStatus = onlineStatuses[activeChat._id];
    const isOnline = userStatus?.isOnline;
    const lastSeen = userStatus?.lastSeen;

    return (
        <div className="w-full h-full flex flex-col overflow-y-auto bg-card/10 backdrop-blur-xs border border-border/30 rounded-3xl p-6 md:p-8 space-y-8 relative pr-3">
            
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="p-2 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-full transition-colors cursor-pointer border border-border/50 flex items-center justify-center"
                        title="Back to Chat Room"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-foreground tracking-tight">User Details</h2>
                        <p className="text-xs text-muted-foreground mt-0.5 font-medium">View contact profile, keys, and chat themes.</p>
                    </div>
                </div>
            </div>

            {/* Profile Presentation */}
            <div className="flex flex-col items-center justify-center p-4 gap-4 text-center">
                <div className="relative">
                    <Avatar user={activeChat} className="w-24 h-24 border-2 border-indigo-500 shadow-xl" />
                    {isOnline && (
                        <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card animate-pulse" />
                    )}
                </div>
                <div>
                    <h3 className="text-xl font-bold text-foreground">@{activeChat.hikeId}</h3>
                    {isOnline ? (
                        <p className="text-xs text-emerald-500 font-bold mt-1">Active now</p>
                    ) : (
                        <p className="text-xs text-muted-foreground font-medium mt-1">
                            Last seen {formatLastSeenText(lastSeen)}
                        </p>
                    )}
                </div>
            </div>

            {/* SECTION 1: ACCOUNT DETAILS */}
            <div className="space-y-4 border-t border-border/40 pt-6">
                <motion.div 
                    animate={{
                        background: [
                            "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.03) 50%, rgba(99, 102, 241, 0.08) 100%)",
                            "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(99, 102, 241, 0.03) 50%, rgba(139, 92, 246, 0.08) 100%)",
                            "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.03) 50%, rgba(99, 102, 241, 0.08) 100%)"
                        ],
                        borderColor: [
                            "rgba(99, 102, 241, 0.15)",
                            "rgba(139, 92, 246, 0.15)",
                            "rgba(99, 102, 241, 0.15)"
                        ]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="border rounded-2xl p-4 flex items-center gap-3.5 shadow-xs relative overflow-hidden"
                >
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 shrink-0">
                        <User className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground tracking-wide">Contact Information</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                            Profile particulars and security public keys.
                        </p>
                    </div>
                </motion.div>

                <div className="bg-card/45 border border-border/60 rounded-2xl p-5 space-y-4">
                    {activeChat.email && (
                        <div className="flex items-center gap-3.5 text-sm text-foreground">
                            <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
                            <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">Email</p>
                                <p className="truncate font-semibold">{activeChat.email}</p>
                            </div>
                        </div>
                    )}

                    {activeChat.publicKey && (
                        <div className="flex items-start gap-3.5 text-sm text-foreground">
                            <Shield className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mb-1">E2EE Public Key</p>
                                <p className="text-xs font-mono break-all line-clamp-2 bg-muted/60 p-2.5 rounded-xl border border-border/50 text-foreground/80">
                                    {activeChat.publicKey}
                                </p>
                                <button
                                    onClick={handleCopyPublicKey}
                                    className="mt-2.5 px-3 py-1.5 text-xs font-bold bg-muted hover:bg-muted-foreground/15 border border-border text-foreground hover:text-indigo-500 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    {copied ? (
                                        <>
                                            <Check className="w-3.5 h-3.5 text-emerald-500 stroke-[3]" />
                                            Copied Public Key
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="w-3.5 h-3.5" />
                                            Copy Public Key
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 2: CHAT THEME & WALLPAPER */}
            <div className="space-y-4 border-t border-border/40 pt-6">
                <motion.div 
                    animate={{
                        background: [
                            "linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 63, 94, 0.03) 50%, rgba(236, 72, 153, 0.08) 100%)",
                            "linear-gradient(135deg, rgba(244, 63, 94, 0.08) 0%, rgba(236, 72, 153, 0.03) 50%, rgba(244, 63, 94, 0.08) 100%)",
                            "linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(244, 63, 94, 0.03) 50%, rgba(236, 72, 153, 0.08) 100%)"
                        ],
                        borderColor: [
                            "rgba(236, 72, 153, 0.15)",
                            "rgba(244, 63, 94, 0.15)",
                            "rgba(236, 72, 153, 0.15)"
                        ]
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="border rounded-2xl p-4 flex items-center gap-3.5 shadow-xs relative overflow-hidden"
                >
                    <div className="p-2.5 rounded-lg bg-pink-500/10 text-pink-500 border border-pink-500/20 shrink-0">
                        <ImageIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground tracking-wide">Chat Theme & Wallpaper</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                            Personalize your chat background view and messaging bubble accent theme.
                        </p>
                    </div>
                </motion.div>

                <div className="bg-card/45 border border-border/60 rounded-2xl p-5 space-y-5">
                    {/* Preinstalled Themes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
                        {Object.values(chatThemes).map((themeObj) => {
                            const isSelected = activeThemeId === themeObj.id && !currentSetting?.customBackground;
                            return (
                                <button
                                    key={themeObj.id}
                                    type="button"
                                    onClick={() => onUpdateTheme(activeChat._id, false, themeObj.id, "")}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer ${
                                        isSelected 
                                            ? "border-indigo-500 ring-2 ring-indigo-500/20 scale-[1.02]" 
                                            : "border-border/60"
                                    }`}
                                >
                                    <div 
                                        className="w-10 h-10 rounded-full shadow-inner"
                                        style={{ 
                                            backgroundImage: themeObj.previewBg || themeObj.background,
                                            backgroundSize: "cover",
                                            backgroundPosition: "center"
                                        }}
                                    />
                                    <span className="text-[11px] font-bold text-foreground truncate w-full text-center">
                                        {themeObj.name}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Custom Wallpaper Section */}
                    <div className="flex flex-col gap-3 pt-2">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                type="button"
                                onClick={() => document.getElementById("wallpaper-upload-page")?.click()}
                                disabled={uploadingImage}
                                className="flex-1 py-3 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 hover:border-indigo-600 text-indigo-500 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                            >
                                {uploadingImage ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Compressing...
                                    </>
                                ) : (
                                    <>
                                        📷 Upload Custom Wallpaper
                                    </>
                                )}
                            </button>
                            {currentSetting?.customBackground && (
                                <button
                                    type="button"
                                    onClick={() => onUpdateTheme(activeChat._id, false, "default", "")}
                                    className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/20 hover:border-rose-500 text-rose-500 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                                    title="Remove custom wallpaper"
                                >
                                    Clear Wallpaper
                                </button>
                            )}
                        </div>
                        <input
                            id="wallpaper-upload-page"
                            type="file"
                            accept="image/*"
                            onChange={handleWallpaperUpload}
                            className="hidden"
                            disabled={uploadingImage}
                        />
                        {uploadError && (
                            <p className="text-xs font-semibold text-rose-500 text-center">
                                ⚠️ {uploadError}
                            </p>
                        )}
                        {currentSetting?.customBackground && !uploadError && (
                            <span className="text-[11px] text-emerald-500 font-bold text-center block animate-pulse">
                                ✨ Custom wallpaper active for this chat
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer encryption info */}
            <div className="w-full flex items-center gap-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 text-xs text-emerald-500/90 font-semibold shrink-0">
                <Info className="w-5 h-5 shrink-0" />
                <span>Your conversations with @{activeChat.hikeId} are fully secured with end-to-end encryption.</span>
            </div>
        </div>
    );
}
