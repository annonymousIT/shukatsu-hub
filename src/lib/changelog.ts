import { Bell, KeyRound, ShieldCheck, type LucideIcon } from "lucide-react";

export interface ChangelogItem {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface ChangelogEntry {
  /** "YYYY-MM-DD"。最新を先頭に置く。WhatsNew の表示判定キーにも使う。 */
  date: string;
  items: ChangelogItem[];
}

/**
 * 更新履歴(新しい順)。
 * 新しい更新を出すときは、先頭にエントリを足すだけ。
 * → 「更新のお知らせ」モーダルが先頭エントリで全ユーザーに1回出る＋設定の履歴にも残る。
 */
export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-06-20",
    items: [
      {
        icon: KeyRound,
        title: "企業ごとにログインID・会員番号を保存",
        body: "ピン留めすれば一覧からワンタップでコピー。「••••」で隠して表示もできます。",
      },
      {
        icon: Bell,
        title: "アプリアイコンに件数バッジ ＋ 通知の改善",
        body: "直近の予定数をアイコンに表示。毎朝のまとめ／前日・〇日前のリマインドも選べます。",
      },
      {
        icon: ShieldCheck,
        title: "プライバシーの説明を明確化",
        body: "あなたのデータは本人だけがアクセス可能。開発者は閲覧せず、パスワードは保存しません。",
      },
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG[0];
