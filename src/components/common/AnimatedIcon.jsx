import React from "react";
import { motion } from "framer-motion";
import * as Icons from "lucide-react";

/**
 * AnimatedIcon wraps Lucide icons with smooth, modern micro-animations using framer-motion.
 * 
 * @param {string} name - Name of the Lucide icon (e.g., "Search", "Lock")
 * @param {string} animation - Animation preset: "bell", "send", "search", "lock", "unlock", "plus", "logout", "bounce", "pulse", "spin", "scale", "shake"
 * @param {string} className - Additional CSS classes
 * @param {number} size - Icon size
 * @param {object} animationProps - Overrides for motion animations
 */
export default function AnimatedIcon({
    name,
    animation = "scale",
    className = "",
    size = 20,
    animationProps = {}
}) {
    const IconComponent = Icons[name];

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in lucide-react`);
        return null;
    }

    // Define motion variants for different micro-animations
    const variants = {
        bell: {
            hover: {
                rotate: [0, -15, 12, -10, 8, -4, 0],
                transition: {
                    duration: 0.6,
                    ease: "easeInOut"
                }
            }
        },
        send: {
            hover: {
                x: [0, 4, -2, 0],
                y: [0, -4, 2, 0],
                scale: [1, 1.1, 0.95, 1],
                transition: {
                    duration: 0.4,
                    ease: "easeInOut"
                }
            }
        },
        search: {
            hover: {
                rotate: [0, 15, -10, 0],
                scale: 1.15,
                transition: {
                    duration: 0.4
                }
            }
        },
        lock: {
            hover: {
                scale: 1.1,
                y: -1,
                transition: {
                    type: "spring",
                    stiffness: 400,
                    damping: 10
                }
            }
        },
        unlock: {
            hover: {
                scale: 1.1,
                rotate: -15,
                transition: {
                    type: "spring",
                    stiffness: 300,
                    damping: 12
                }
            }
        },
        plus: {
            hover: {
                rotate: 90,
                scale: 1.15,
                transition: {
                    type: "spring",
                    stiffness: 200,
                    damping: 10
                }
            }
        },
        logout: {
            hover: {
                x: 4,
                scale: 1.05,
                transition: {
                    type: "spring",
                    stiffness: 300,
                    damping: 15
                }
            }
        },
        bounce: {
            hover: {
                y: [0, -4, 0],
                transition: {
                    duration: 0.4,
                    repeat: Infinity,
                    repeatType: "reverse",
                    ease: "easeInOut"
                }
            }
        },
        pulse: {
            hover: {
                scale: [1, 1.12, 1],
                transition: {
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "easeInOut"
                }
            }
        },
        spin: {
            animate: {
                rotate: 360,
                transition: {
                    duration: 1.2,
                    repeat: Infinity,
                    ease: "linear"
                }
            }
        },
        scale: {
            hover: {
                scale: 1.18,
                transition: {
                    type: "spring",
                    stiffness: 400,
                    damping: 10
                }
            },
            tap: {
                scale: 0.92
            }
        },
        shake: {
            hover: {
                x: [-2, 2, -2, 2, 0],
                transition: {
                    duration: 0.3
                }
            }
        }
    };

    const selectedVariant = variants[animation] || variants.scale;

    // Merge custom animationProps if supplied
    const mergedHover = { ...selectedVariant.hover, ...animationProps.hover };
    const mergedTap = { ...selectedVariant.tap, ...animationProps.tap };
    const mergedAnimate = { ...selectedVariant.animate, ...animationProps.animate };

    return (
        <motion.span
            className={`inline-flex items-center justify-center shrink-0 ${className}`}
            style={{ width: size, height: size }}
            whileHover={mergedHover ? "hover" : undefined}
            whileTap={mergedTap ? "tap" : undefined}
            animate={mergedAnimate ? "animate" : undefined}
            variants={variants[animation]}
        >
            <IconComponent size={size} />
        </motion.span>
    );
}
