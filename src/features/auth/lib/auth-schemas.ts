import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "كلمة المرور يجب ألا تقل عن 8 أحرف")
  .max(72, "كلمة المرور طويلة جداً")
  .regex(/[A-Za-z]/, "يجب أن تحتوي على حرف واحد على الأقل")
  .regex(/[0-9]/, "يجب أن تحتوي على رقم واحد على الأقل");

export const emailSchema = z
  .string()
  .trim()
  .email("بريد إلكتروني غير صالح")
  .max(255, "البريد الإلكتروني طويل جداً");

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "الحقل مطلوب").max(255),
  password: z.string().min(1, "كلمة المرور مطلوبة"),
});

export const signupSchema = z
  .object({
    storeName: z.string().trim().min(2, "اسم المتجر مطلوب").max(120),
    contactPerson: z.string().trim().min(2, "اسم المسؤول مطلوب").max(120),
    phone: z.string().trim().min(6, "رقم الهاتف مطلوب"),
    city: z.string().trim().min(1, "اختر المدينة"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export const forgotSchema = z.object({ email: emailSchema });

export const resetSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ResetValues = z.infer<typeof resetSchema>;

export function friendlyAuthError(err: unknown): string {
  const msg = (err as { message?: string })?.message ?? "";
  const code = (err as { code?: string })?.code ?? "";
  if (/invalid[_ ]?credentials/i.test(code) || /invalid login/i.test(msg)) {
    return "بيانات الدخول غير صحيحة";
  }
  if (/email[_ ]not[_ ]confirmed/i.test(msg) || /not.+confirm/i.test(msg)) {
    return "البريد غير مؤكد — تحقق من بريدك أولاً";
  }
  if (/already.+registered/i.test(msg) || /user already/i.test(msg)) {
    return "هذا البريد مسجّل مسبقاً — جرّب تسجيل الدخول";
  }
  if (/pwned|leaked|hibp/i.test(msg)) {
    return "كلمة المرور هذه مكشوفة في تسريبات سابقة — اختر كلمة أقوى";
  }
  if (/rate.?limit|too many/i.test(msg)) {
    return "محاولات كثيرة — انتظر دقيقة ثم حاول مجدداً";
  }
  return msg || "حدث خطأ غير متوقع";
}