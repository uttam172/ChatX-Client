import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function LightboxModal({
    activeLightboxImage,
    setActiveLightboxImage
}) {
    if (!activeLightboxImage) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveLightboxImage(null)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 cursor-zoom-out p-4"
        >
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ type: "spring", duration: 0.3 }}
                className="relative max-w-5xl max-h-[90vh] flex items-center justify-center select-none"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={() => setActiveLightboxImage(null)}
                    className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer z-50 border border-white/10"
                    title="Close Preview"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Lightboxed Image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={activeLightboxImage}
                    alt="Enlarged E2EE shared media preview"
                    className="max-w-full max-h-[85vh] object-contain rounded-2xl shadow-2xl border border-white/5"
                />
            </motion.div>
        </motion.div>
    );
}
