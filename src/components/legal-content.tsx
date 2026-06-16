// プライバシーポリシー・利用規約の本文（静的）。
// legal-dialog から表示。制作者「AnIT」/ 連絡先 GitHub Issues。

const CONTACT_URL =
  "https://github.com/annonymousIT/shukatsu-dashboard/issues";
const UPDATED = "2026年6月16日";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function PrivacyPolicyBody() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">最終更新日: {UPDATED}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        就活Hub（以下「本アプリ」）は、個人開発者「AnIT」が提供する就職活動の進捗管理ツールです。
        本ポリシーは本アプリが扱う情報の取り扱いを定めるもので、標準的な雛形をもとに個人が作成・運営しています。
      </p>

      <Block title="1. 取得する情報">
        <ul className="list-disc space-y-1 pl-5">
          <li>クラウド同期を利用する場合のメールアドレス（ログイン認証のため）</li>
          <li>利用者が入力した就職活動の情報（企業名・選考ステップ・締切・ES設問と回答・メモ等）</li>
        </ul>
      </Block>

      <Block title="2. 保存先と方法">
        ログインせずに使う場合、データは利用者の端末内（ブラウザのローカルストレージ）にのみ保存されます。
        クラウド同期を利用する場合は、認証・データベース基盤である Supabase に保存され、通信は暗号化（HTTPS）されます。
      </Block>

      <Block title="3. 利用目的">
        取得した情報は、進捗管理機能を提供する目的にのみ利用します。広告・行動解析を目的とした第三者提供は行いません。
      </Block>

      <Block title="4. 第三者サービス">
        本アプリはインフラとして Supabase（認証・データ保存）および Vercel（ホスティング）を利用します。
        これら稼働に必要な範囲を超えて、利用者の情報を第三者へ提供することはありません。
      </Block>

      <Block title="5. データの管理・削除">
        メニューの「エクスポート（JSON）」でいつでもバックアップできます。各企業・各データは画面上で削除でき、
        全データの削除も可能です。アカウントごとの削除を希望する場合は、下記の連絡先までご連絡ください。
      </Block>

      <Block title="6. Cookie・ローカルストレージ">
        ログイン状態の保持、テーマ設定、初回ガイドの表示判定のためにローカルストレージを使用します。
        広告目的のトラッキングは行いません。
      </Block>

      <Block title="7. 制作者・お問い合わせ">
        制作者: AnIT
        <br />
        お問い合わせ:{" "}
        <a
          href={CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          GitHub Issues
        </a>
      </Block>

      <Block title="8. 改定">
        本ポリシーは、必要に応じて予告なく改定する場合があります。重要な変更がある場合はアプリ上でお知らせします。
      </Block>
    </div>
  );
}

export function TermsOfServiceBody() {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">最終更新日: {UPDATED}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        本利用規約（以下「本規約」）は、就活Hub（以下「本アプリ」）の利用条件を定めるものです。
        本アプリを利用した時点で、本規約に同意したものとみなします。
      </p>

      <Block title="1. 本サービスについて">
        本アプリは、就職活動の進捗管理を補助する個人開発の無償ツールです。
      </Block>

      <Block title="2. 利用者の責任（重要）">
        選考の締切・日程・会場などの最終確認は、必ず各企業の公式情報で行ってください。
        本アプリに登録された情報の誤り・見落としにより生じた不利益について、制作者は責任を負いません。
      </Block>

      <Block title="3. データの取り扱い">
        本アプリは現状有姿で提供され、データの保存・可用性・消失しないことを保証しません。
        重要なデータは、各自でエクスポート（バックアップ）してください。
      </Block>

      <Block title="4. 禁止事項">
        <ul className="list-disc space-y-1 pl-5">
          <li>法令または公序良俗に反する行為</li>
          <li>本アプリの運営を妨害する行為、不正アクセス、なりすまし</li>
          <li>本アプリやその基盤への過度な負荷・リバースエンジニアリング等による妨害</li>
        </ul>
      </Block>

      <Block title="5. 免責">
        本アプリの利用または利用できなかったことにより生じたいかなる損害についても、
        制作者は一切の責任を負いません。
      </Block>

      <Block title="6. 規約の変更">
        本規約は、必要に応じて予告なく変更される場合があります。
      </Block>

      <Block title="7. 準拠法">
        本規約は日本法に準拠し、解釈されるものとします。
      </Block>

      <Block title="8. お問い合わせ">
        <a
          href={CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          GitHub Issues
        </a>
      </Block>
    </div>
  );
}
