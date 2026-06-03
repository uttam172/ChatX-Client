import React, { useState } from "react";
import { motion } from "framer-motion";
import { Settings, X, Copy, Check, Lock, Unlock } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function SettingsModal({
    currentUser,
    hasPrivateKey,
    handleRestorePrivateKey,
    handleRegenerateKeys,
    setIsSettingsOpen
}) {
    const [newPin, setNewPin] = useState("");
    const [pinMessage, setPinMessage] = useState("");
    const [pinSuccess, setPinSuccess] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);

    const handleSetPin = async (e) => {
        e.preventDefault();
        if (!newPin.trim()) return;

        try {
            const token = localStorage.getItem("token");
            const res = await fetch(`${API_URL}/api/auth/set-pin`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ pin: newPin }),
            });

            const data = res.ok ? await res.json() : null;
            if (res.ok) {
                setPinSuccess(true);
                setPinMessage("Hidden vault PIN updated successfully!");
                setNewPin("");
                setTimeout(() => {
                    setPinMessage("");
                    setPinSuccess(false);
                }, 3000);
            } else {
                const errMsg = data?.error || "Failed to update PIN";
                setPinSuccess(false);
                setPinMessage(errMsg);
            }
        } catch {
            setPinSuccess(false);
            setPinMessage("Error updating PIN");
        }
    };

    const copyToClipboard = () => {
        if (!currentUser?.publicKey) return;
        navigator.clipboard.writeText(currentUser.publicKey);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: "spring", duration: 0.4 }}
                className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Modal Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                    <div className="flex items-center gap-2">
                        <Settings className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-bold text-lg text-foreground">Settings</h3>
                    </div>
                    <button
                        onClick={() => {
                            setIsSettingsOpen(false);
                            setPinMessage("");
                            setNewPin("");
                        }}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 space-y-6 overflow-y-auto max-h-[70vh]">
                    {/* Profile Section */}
                    <div className="space-y-3">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Profile Information
                        </h4>
                        <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-linear-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                                    {currentUser?.hikeId?.charAt(0).toUpperCase() || "?"}
                                </div>
                                <div>
                                    <p className="font-bold text-base text-foreground">
                                        {currentUser?.hikeId || "unknown"}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        {currentUser?.email || "unknown"}
                                    </p>
                                </div>
                            </div>

                            {/* Public Key Display */}
                            {currentUser?.publicKey && (
                                <div className="pt-2 border-t border-border space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            E2EE Public Key
                                        </span>
                                        <button
                                            onClick={copyToClipboard}
                                            className="text-xs text-indigo-500 hover:text-indigo-400 font-medium flex items-center gap-1 transition-colors"
                                        >
                                            {copiedKey ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5" /> Copied!
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" /> Copy Key
                                                </>
                                            )}
                                        </button>
                                    </div>
                                    <div className="bg-card border border-border rounded-lg p-2 font-mono text-[10px] break-all max-h-20 overflow-y-auto text-muted-foreground select-all leading-tight">
                                        {currentUser.publicKey}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Vault PIN Section */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-indigo-500" />
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Hidden Vault Security
                            </h4>
                        </div>

                        <form onSubmit={handleSetPin} className="space-y-3">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Set or update your 4-digit PIN. This PIN is used to encrypt and lock/unlock your hidden conversational vault from the sidebar.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="password"
                                    pattern="[0-9]*"
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Enter 4-digit PIN"
                                    value={newPin}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/[^0-9]/g, "");
                                        setNewPin(val);
                                    }}
                                    className="flex-1 px-3 py-2 rounded-xl bg-muted text-foreground border border-border focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                />
                                <button
                                    type="submit"
                                    disabled={newPin.length !== 4}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                                >
                                    Update PIN
                                </button>
                            </div>
                            {pinMessage && (
                                <p className={`text-xs font-medium ${pinSuccess ? "text-emerald-500" : "text-rose-500"}`}>
                                    {pinMessage
                                }</p>
                            )}
                        </form>
                    </div>

                    {/* E2EE Key Management Section */}
                    <div className="space-y-3 pt-4 border-t border-border">
                        <div className="flex items-center gap-2">
                            <Unlock className="w-4 h-4 text-amber-500" />
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                End-to-End Encryption Keys
                            </h4>
                        </div>

                        <div className="space-y-3">
                            {!hasPrivateKey ? (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2">
                                    <p className="text-xs text-amber-400 font-semibold leading-relaxed flex items-center gap-1.5">
                                        ⚠️ Private key missing from this browser!
                                    </p>
                                    <p className="text-[11px] text-muted-foreground leading-normal">
                                        You won&apos;t be able to decrypt past or future messages on this browser unless you regenerate your encryption keys or restore from a password-protected backup.
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRestorePrivateKey}
                                            className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-colors"
                                        >
                                            Restore from Backup
                                        </button>
                                        <button
                                            onClick={handleRegenerateKeys}
                                            className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold transition-colors"
                                        >
                                            Regenerate Keys
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-2">
                                    <p className="text-xs text-emerald-500 font-semibold leading-relaxed flex items-center gap-1.5">
                                        ✓ Secure E2EE Key Active
                                    </p>
                                    <p className="text-[11px] text-muted-foreground leading-normal">
                                        Your private key is securely stored in this browser&apos;s IndexedDB. If you are having issues decrypting messages or logged in on a new device, you can reset your key pair below.
                                    </p>
                                    <button
                                        onClick={handleRegenerateKeys}
                                        className="w-full px-3 py-1.5 border border-indigo-500/30 hover:bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-medium transition-colors"
                                    >
                                        Regenerate E2EE Keys
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t border-border bg-muted/10 flex justify-end">
                    <button
                        onClick={() => {
                            setIsSettingsOpen(false);
                            setPinMessage("");
                            setNewPin("");
                        }}
                        className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-sm font-semibold transition-colors"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
