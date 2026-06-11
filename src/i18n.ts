// 최소 i18n — ko 우선. en은 dict만 추가하면 동작 (구조만 대비).
const ko = {
  loading: "불러오는 중…",
} as const;

type Key = keyof typeof ko;
const dict: Record<string, Record<Key, string>> = { ko };
let locale = "ko";

export function t(key: Key): string {
  return dict[locale]?.[key] ?? key;
}
export function setLocale(l: string) {
  locale = l;
}
