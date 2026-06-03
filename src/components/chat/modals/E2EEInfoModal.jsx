import React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, X } from "lucide-react";

export default function E2EEInfoModal({
    isE2EEInfoOpen,
    setIsE2EEInfoOpen,
    activeChat
}) {
    if (!isE2EEInfoOpen || !activeChat) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            >
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-2 text-emerald-500">
                        <ShieldCheck className="w-5 h-5" />
                        <h3 className="font-bold text-lg text-foreground">Encryption Status</h3>
                    </div>
                    <button
                        onClick={() => setIsE2EEInfoOpen(false)}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-4">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Conversations with <span className="font-semibold text-foreground">{activeChat.hikeId}</span> are end-to-end encrypted (E2EE). Messages are secured in your browser using standard AES-GCM-256 before being sent to the server. Neither ChatX nor any third party can read them.
                    </p>

                    <div className="space-y-1.5 pt-2 border-t border-border">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            {activeChat.hikeId}&apos;s Public Key
                        </span>
                        <div className="bg-muted border border-border rounded-xl p-3 font-mono text-[10px] break-all max-h-24 overflow-y-auto text-muted-foreground leading-normal select-all">
                            {activeChat.publicKey || "No E2EE public key available."}
                        </div>
                    </div>

                    <div className="space-y-1 pt-2 border-t border-border">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Verification Fingerprint
                        </span>
                        <p className="text-[11px] font-mono text-indigo-500 font-bold tracking-wider select-all">
                            {activeChat.publicKey
                                ? activeChat.publicKey.substring(0, 16).match(/.{1,4}/g).join(" ") + " ... " + activeChat.publicKey.substring(activeChat.publicKey.length - 16).match(/.{1,4}/g).join(" ")
                                : "N/A"}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                            Compare these key segments with your contact to verify the security of this connection.
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
                    <button
                        onClick={() => setIsE2EEInfoOpen(false)}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-md cursor-pointer"
                    >
                        Verified
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
