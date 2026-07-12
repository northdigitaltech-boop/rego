"use client";

import { motion, type Variants } from "framer-motion";
import * as React from "react";

import { cn } from "@/lib/utils";

const variants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut", delay: i * 0.08 },
  }),
};

interface RevealProps {
  index?: number;
  className?: string;
  children: React.ReactNode;
}

export function Reveal({ className, children, index = 0 }: RevealProps) {
  return (
    <motion.div
      custom={index}
      variants={variants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
