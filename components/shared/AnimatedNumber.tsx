"use client";

import { useEffect } from "react";
import { motion, useSpring, useTransform } from "motion/react";

/**
 * Oy sayacı — değer değişince yumuşakça kayar (BuildUI tekniği).
 * Motion+ gerektiren AnimateNumber yerine ücretsiz useSpring+useTransform.
 */
export function AnimatedNumber({
  value,
  className,
  style,
}: {
  value: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const spring = useSpring(value, { mass: 0.8, stiffness: 90, damping: 16 });
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString("tr-TR"));

  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  return (
    <motion.span className={className} style={style}>
      {display}
    </motion.span>
  );
}
