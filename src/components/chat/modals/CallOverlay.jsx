import React from "react";
import { motion } from "framer-motion";
import { Phone, Video } from "lucide-react";

export default function CallOverlay({
    callStatus,
    callType,
    callTimer,
    isMuted,
    setIsMuted,
    isCameraOn,
    setIsCameraOn,
    endCall,
    activeChat
}) {
    if (callStatus === "disconnected" || !activeChat) return null;

    return (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col justify-between p-8 z-50 text-white animate-fade-in">
            <div className="flex justify-between items-center">
                <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                    {callType === "video" ? "Secure E2EE Video Call" : "Secure E2EE Voice Call"}
                </span>
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-semibold border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Encrypted</span>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative my-8">
                {callType === "video" && callStatus === "connected" ? (
                    <div className="w-full h-full max-w-2xl aspect-video bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden relative shadow-2xl">
                        <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-indigo-950/50 to-slate-900">
                            <motion.img
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                                src={"https://api.dicebear.com/7.x/initials/svg?seed=" + activeChat.hikeId + "&radius=50&backgroundType=gradientLinear"}
                                alt={activeChat.hikeId}
                                className="w-28 h-28 rounded-full border-4 border-indigo-500/30 shadow-2xl"
                            />
                            <div className="absolute bottom-4 left-4 text-xs font-semibold tracking-wider bg-black/50 px-3.5 py-1.5 rounded-xl backdrop-blur-md border border-white/5">
                                {activeChat.hikeId}
                            </div>
                        </div>

                        {isCameraOn && (
                            <div className="absolute top-4 right-4 w-32 aspect-video bg-slate-950 border border-slate-700 rounded-2xl overflow-hidden shadow-md flex items-center justify-center bg-cover bg-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-black/40 px-2 py-0.5 rounded">You</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="relative">
                        <motion.div
                            animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                            transition={{ duration: 2.5, repeat: Infinity }}
                            className="absolute inset-0 bg-indigo-500 rounded-full"
                        />
                        <motion.div
                            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.2, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                            className="absolute inset-0 bg-purple-500 rounded-full"
                        />
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={"https://api.dicebear.com/7.x/initials/svg?seed=" + activeChat.hikeId + "&radius=50&backgroundType=gradientLinear"}
                            alt={activeChat.hikeId}
                            className="w-32 h-32 rounded-full border-4 border-indigo-600 relative z-10 shadow-2xl"
                        />
                    </div>
                )}

                <div className="mt-8 text-center relative z-10">
                    <h3 className="text-3xl font-black tracking-tight">{activeChat.hikeId}</h3>
                    <p className="text-xs text-indigo-400 mt-2 tracking-widest uppercase font-black">
                        {callStatus === "calling" ? "Calling..." : "Connected — " + Math.floor(callTimer / 60).toString().padStart(2, "0") + ":" + (callTimer % 60).toString().padStart(2, "0")}
                    </p>
                </div>
            </div>

            <div className="flex items-center justify-center gap-6 py-4 border-t border-slate-900">
                <button
                    onClick={() => setIsMuted(prev => !prev)}
                    className={"p-4 rounded-full transition-all border cursor-pointer " +
                        (isMuted
                            ? "bg-rose-600 border-rose-600 hover:bg-rose-700"
                            : "bg-slate-900 border-slate-800 hover:bg-slate-800")
                    }
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    <Phone className="w-6 h-6 rotate-135" />
                </button>

                <button
                    onClick={endCall}
                    className="p-5 bg-rose-600 hover:bg-rose-700 rounded-full shadow-lg hover:shadow-rose-600/20 transition-all border border-rose-500 cursor-pointer"
                    title="Hang Up"
                >
                    <Phone className="w-8 h-8 rotate-135" />
                </button>

                {callType === "video" && (
                    <button
                        onClick={() => setIsCameraOn(prev => !prev)}
                        className={"p-4 rounded-full transition-all border cursor-pointer " +
                            (!isCameraOn
                                ? "bg-rose-600 border-rose-600 hover:bg-rose-700"
                                : "bg-slate-900 border-slate-800 hover:bg-slate-800")
                        }
                        title={isCameraOn ? "Turn Camera Off" : "Turn Camera On"}
                    >
                        <Video className="w-6 h-6" />
                    </button>
                )}
            </div>
        </div>
    );
}
