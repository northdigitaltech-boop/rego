import { Reveal } from "@/components/ui/reveal";
import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  light?: boolean;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  light = false,
}: SectionHeadingProps) {
  return (
    <Reveal
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center"
      )}
    >
      {eyebrow && (
        <span className="inline-block rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-gold-700">
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "mt-4 font-display text-3xl font-bold leading-tight sm:text-4xl",
          light ? "text-white" : "text-forest"
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed",
            light ? "text-white/75" : "text-muted-foreground"
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}
