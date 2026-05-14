import { useMemo } from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";

interface Props {
  password: string;
}

function score(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

const LABELS = ["ضعيفة جداً", "ضعيفة", "متوسطة", "قوية", "قوية جداً"];
const COLORS = [
  "bg-destructive",
  "bg-destructive/80",
  "bg-yellow-500",
  "bg-primary/80",
  "bg-primary",
];

export function PasswordStrengthMeter({ password }: Props) {
  const s = useMemo(() => score(password), [password]);
  const checks = useMemo(
    () => [
      { ok: password.length >= 8, label: "٨ أحرف على الأقل" },
      { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "حروف وأرقام" },
      { ok: /[^A-Za-z0-9]/.test(password), label: "رمز خاص (اختياري)" },
    ],
    [password]
  );

  if (!password) return null;

  return (
    <div className="space-y-2 mt-1">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className={`h-1 flex-1 rounded-full origin-start ${
              i < s ? COLORS[s] : "bg-muted"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          القوة:{" "}
          <span
            className={
              s >= 3 ? "text-primary font-medium" : s >= 2 ? "text-yellow-500 font-medium" : "text-destructive font-medium"
            }
          >
            {LABELS[s]}
          </span>
        </span>
        <div className="flex gap-2.5">
          {checks.map((c) => (
            <span
              key={c.label}
              className={`inline-flex items-center gap-1 text-[10px] ${
                c.ok ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {c.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
              {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
